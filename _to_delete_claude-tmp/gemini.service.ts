import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { GoogleGenAI } from '@google/genai';

/** Vertex default — override with GEMINI_MODEL. */
const DEFAULT_MODEL = 'gemini-2.0-flash-001';
/**
 * Fallbacks when primary is overloaded.
 * Override via GEMINI_FALLBACK_MODELS=model-a,model-b
 */
const DEFAULT_FALLBACK_MODELS = ['gemini-2.0-flash-001', 'gemini-2.5-flash'] as const;
const MAX_ATTEMPTS = 3;

/** Circuit opens after this many overload failures in the window. */
const CIRCUIT_FAILURE_THRESHOLD = 5;
/** Sliding window for counting failures. */
const CIRCUIT_WINDOW_MS = 120_000;
/** Default cooldown once open (override with GEMINI_CIRCUIT_COOLDOWN_MS). */
const CIRCUIT_COOLDOWN_MS_DEFAULT = 45_000;

/** Public marker for clients — do not localize on the API. */
export const GEMINI_OVERLOAD_CODE = 'AI_OVERLOAD';

export type GeminiGenerateOptions = {
  prompt: string;
  systemInstruction?: string;
  /** Prefer JSON response from the model. */
  json?: boolean;
  temperature?: number;
  model?: string;
};

function isRetryableOverload(message: string): boolean {
  return /high demand|resource.?exhausted|429|503|unavailable|try again|fetch failed|ECONNRESET|ETIMEDOUT|AI_OVERLOAD|quota|rate.?limit/i.test(
    message,
  );
}

function isQuotaExceeded(message: string): boolean {
  return /exceeded your current quota|quota|billing details|rate.?limit/i.test(message);
}

function backoffMs(attempt: number): number {
  // ~1.2s, ~2.4s, ~4.8s + jitter up to 40%
  const base = Math.round(1200 * Math.pow(2, attempt - 1));
  const jitter = Math.floor(Math.random() * base * 0.4);
  return base + jitter;
}

function circuitCooldownMs(): number {
  const raw = process.env.GEMINI_CIRCUIT_COOLDOWN_MS?.trim();
  if (raw && /^\d+$/.test(raw)) return Math.max(5_000, Number(raw));
  // Local/dev: shorter lockout so a stuck circuit does not block drafts for minutes.
  if (process.env.NODE_ENV !== 'production') return 30_000;
  return CIRCUIT_COOLDOWN_MS_DEFAULT;
}

function circuitDisabled(): boolean {
  return /^(1|true|yes)$/i.test(String(process.env.GEMINI_CIRCUIT_DISABLED ?? '').trim());
}

function trimEnv(value: string | undefined): string {
  return (value || '').trim().replace(/^['"]|['"]$/g, '').trim();
}

/** Monorepo roots for resolving relative credential paths. */
function monorepoRoots(): string[] {
  return [
    resolve(__dirname, '../../../../'), // apps/api/src/gemini → root
    resolve(__dirname, '../../../'), // apps/api/dist/gemini → root
    resolve(process.cwd(), '../../'), // cwd apps/api
    process.cwd(),
  ];
}

/**
 * Resolve GOOGLE_APPLICATION_CREDENTIALS / VERTEX_CREDENTIALS to an absolute
 * existing path (relative paths are tried against monorepo root).
 */
export function resolveVertexCredentialsPath(): string | null {
  const raw = trimEnv(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.VERTEX_CREDENTIALS,
  );
  if (!raw) return null;

  if (isAbsolute(raw) && existsSync(raw)) return raw;
  if (!isAbsolute(raw) && existsSync(raw)) return resolve(raw);

  for (const root of monorepoRoots()) {
    const candidate = resolve(root, raw);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  /** Timestamps of recent overload/transient failures (process-local). */
  private failureTimestamps: number[] = [];
  private circuitOpenUntil = 0;
  private client: GoogleGenAI | null = null;

  private vertexProject(): string {
    const project = trimEnv(
      process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    );
    if (!project) {
      throw new ServiceUnavailableException(
        'Vertex AI is not configured — set VERTEX_PROJECT_ID in .env.api and restart the API',
      );
    }
    return project;
  }

  private vertexLocation(): string {
    return trimEnv(process.env.VERTEX_LOCATION) || 'us-central1';
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;

    const credentialsPath = resolveVertexCredentialsPath();
    if (!credentialsPath) {
      throw new ServiceUnavailableException(
        'Vertex AI credentials missing — set GOOGLE_APPLICATION_CREDENTIALS (or VERTEX_CREDENTIALS) to a service-account JSON path and restart the API',
      );
    }
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

    const project = this.vertexProject();
    const location = this.vertexLocation();
    this.logger.log(`Vertex AI client: project=${project} location=${location}`);
    this.client = new GoogleGenAI({
      vertexai: true,
      project,
      location,
      googleAuthOptions: { keyFile: credentialsPath },
    });
    return this.client;
  }

  defaultModel(): string {
    return trimEnv(process.env.GEMINI_MODEL) || DEFAULT_MODEL;
  }

  private fallbackModels(): string[] {
    const raw = process.env.GEMINI_FALLBACK_MODELS?.trim();
    if (raw) {
      return raw
        .split(',')
        .map((m) => m.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
    return [...DEFAULT_FALLBACK_MODELS];
  }

  private pruneFailures(now: number) {
    this.failureTimestamps = this.failureTimestamps.filter(
      (t) => now - t < CIRCUIT_WINDOW_MS,
    );
  }

  private assertCircuitClosed() {
    if (circuitDisabled()) return;
    const now = Date.now();
    if (now < this.circuitOpenUntil) {
      const waitSec = Math.ceil((this.circuitOpenUntil - now) / 1000);
      this.logger.warn(`Gemini circuit open — reject for ~${waitSec}s`);
      throw new ServiceUnavailableException(
        `${GEMINI_OVERLOAD_CODE}: AI is busy. Please try again in about ${waitSec}s.`,
      );
    }
  }

  private recordFailure(message: string) {
    if (circuitDisabled()) return;
    if (!isRetryableOverload(message)) return;
    const now = Date.now();
    this.pruneFailures(now);
    this.failureTimestamps.push(now);
    if (this.failureTimestamps.length >= CIRCUIT_FAILURE_THRESHOLD) {
      const cooldown = circuitCooldownMs();
      this.circuitOpenUntil = now + cooldown;
      this.failureTimestamps = [];
      this.logger.warn(
        `Gemini circuit OPEN for ${cooldown / 1000}s after repeated overloads`,
      );
    }
  }

  private recordSuccess() {
    this.failureTimestamps = [];
    this.circuitOpenUntil = 0;
  }

  /**
   * Vertex AI (Google Gen AI SDK) → models.generateContent
   * Exponential backoff + jitter, model fallbacks, process-local circuit breaker.
   */
  async generateContent(options: GeminiGenerateOptions): Promise<string> {
    this.assertCircuitClosed();

    const primary = options.model?.trim() || this.defaultModel();
    const models = [
      primary,
      ...this.fallbackModels().filter((m) => m !== primary),
    ];
    let lastError: unknown;
    let sawOverload = false;

    for (const model of models) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const text = await this.callModel(model, options);
          this.recordSuccess();
          return text;
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          const retryable = isRetryableOverload(message);
          if (retryable) sawOverload = true;
          this.logger.warn(
            `Vertex ${model} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message.slice(0, 220)}`,
          );
          this.recordFailure(message);
          // Circuit may have just opened — stop hammering.
          if (Date.now() < this.circuitOpenUntil) {
            throw new ServiceUnavailableException(
              `${GEMINI_OVERLOAD_CODE}: AI is busy. Please try again shortly.`,
            );
          }
          if (!retryable || attempt >= MAX_ATTEMPTS) break;
          await new Promise((r) => setTimeout(r, backoffMs(attempt)));
        }
      }
    }

    if (sawOverload) {
      const lastMsg =
        lastError instanceof Error ? lastError.message : String(lastError ?? '');
      if (isQuotaExceeded(lastMsg)) {
        throw new ServiceUnavailableException(
          `${GEMINI_OVERLOAD_CODE}: Vertex AI quota exceeded. Set GEMINI_MOCK=true for local drafts, or check GCP billing/quotas.`,
        );
      }
      throw new ServiceUnavailableException(
        `${GEMINI_OVERLOAD_CODE}: AI is busy. Please try again shortly.`,
      );
    }

    const message =
      lastError instanceof Error ? lastError.message : 'Vertex AI request failed';
    throw new BadGatewayException(message);
  }

  private async callModel(
    model: string,
    options: GeminiGenerateOptions,
  ): Promise<string> {
    const ai = this.getClient();
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          temperature: options.temperature ?? 0.7,
          ...(options.systemInstruction
            ? { systemInstruction: options.systemInstruction }
            : {}),
          ...(options.json ? { responseMimeType: 'application/json' } : {}),
        },
      });
      const text = (response.text ?? '').trim();
      if (text) return text;

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const joined = parts
        .map((part) =>
          part && typeof part === 'object' && 'text' in part && typeof part.text === 'string'
            ? part.text
            : '',
        )
        .join('')
        .trim();
      if (joined) return joined;
      throw new Error('Vertex AI returned an empty response');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    }
  }
}
