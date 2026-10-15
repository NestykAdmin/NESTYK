import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { GeminiService } from '../../gemini/gemini.service';
import { LISTING_PROMO_SYSTEM_PROMPT } from './prompts/listing-promo.system-prompt';
import { listingPromoLocaleStyle } from './prompts/listing-promo.locale-styles';
import type {
  GenerateListingPromoBody,
  GenerateListingPromoLocale,
  GenerateListingPromoResult,
} from './dto/generate-listing-promo.dto';

const TITLE_MAX = 100;
const DESCRIPTION_SOFT_MAX = 1200;

function normalizeLocale(value: string | undefined): GenerateListingPromoLocale {
  if (value !== undefined && typeof value !== 'string') throw new BadRequestException('outputLocale must be a string');
  const raw = (value || 'th').trim().toLowerCase();
  if (raw === 'en' || raw === 'zh' || raw === 'ja' || raw === 'th') return raw;
  return 'th';
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function softFitText(value: string, max: number): string {
  const raw = value.trim();
  if (raw.length <= max) return raw;
  const sliced = raw.slice(0, max);
  const breakAt = Math.max(
    sliced.lastIndexOf('\n'),
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf(' '),
  );
  if (breakAt >= Math.floor(max * 0.6)) {
    return sliced.slice(0, breakAt).trimEnd();
  }
  return sliced.trimEnd();
}

function parsePromoJson(text: string): GenerateListingPromoResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    throw new BadGatewayException('Gemini returned non-JSON listing promo');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new BadGatewayException('Gemini returned invalid listing promo shape');
  }
  const row = parsed as Record<string, unknown>;
  const listingTitle = typeof row.listingTitle === 'string' ? row.listingTitle.trim() : '';
  const listingDescription =
    typeof row.listingDescription === 'string' ? row.listingDescription.trim() : '';
  if (!listingTitle || !listingDescription) {
    throw new BadGatewayException('Gemini listing promo missing title or description');
  }
  return {
    listingTitle: softFitText(listingTitle, TITLE_MAX),
    listingDescription: softFitText(listingDescription, DESCRIPTION_SOFT_MAX),
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Deterministic draft for local/demo when GEMINI_MOCK=true (no Google call). */
function mockPromo(
  locale: GenerateListingPromoLocale,
  listing: Record<string, unknown>,
): GenerateListingPromoResult {
  const property = asString(listing.propertyName) || asString(listing.address) || 'NESTYK';
  const district = asString(listing.district);
  const bedroom = asString(listing.bedroom);
  const size = asString(listing.sizeSqm);
  const place = district ? `${property} · ${district}` : property;
  const specs = [bedroom ? `${bedroom} bed` : null, size ? `${size} sqm` : null]
    .filter(Boolean)
    .join(' · ');

  const prices = Array.isArray(listing.prices) ? listing.prices : [];
  const priceBits: string[] = [];
  for (const row of prices) {
    if (!row || typeof row !== 'object') continue;
    const p = row as Record<string, unknown>;
    const amount = asNumber(p.price);
    if (amount == null) continue;
    const months = asNumber(p.termMonths);
    priceBits.push(months ? `฿${amount.toLocaleString('en-US')} / ${months} mo` : `฿${amount.toLocaleString('en-US')}`);
  }

  const facilities = Array.isArray(listing.facilityLabels)
    ? listing.facilityLabels.map(asString).filter(Boolean).slice(0, 6)
    : [];
  const nearby = Array.isArray(listing.nearbyPlaces)
    ? listing.nearbyPlaces
        .map((row) => {
          if (!row || typeof row !== 'object') return '';
          const n = row as Record<string, unknown>;
          const name = asString(n.name);
          const d = asNumber(n.distanceMeters);
          if (!name) return '';
          return d != null ? `${name} (${d} m)` : name;
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];

  const copy: Record<GenerateListingPromoLocale, { title: string; desc: string }> = {
    th: {
      title: specs ? `${place} — ${specs} ✨` : `${place} พร้อมเข้าอยู่ ✨`,
      desc: [
        `คอนโด/ห้องเช่าที่ ${place} เหมาะกับชีวิตประจำวันในเมือง`,
        specs ? `รายละเอียดห้อง: ${specs}` : null,
        facilities.length ? `สิ่งอำนวยความสะดวก: ${facilities.join(', ')}` : null,
        nearby.length ? `ใกล้เคียง: ${nearby.join(', ')}` : null,
        priceBits.length ? `ราคาเช่า: ${priceBits.join(' · ')}` : null,
        'สนใจนัดดูห้องได้จากปุ่ม “นัดดูห้อง” ในหน้านี้',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    en: {
      title: specs ? `${place} — ${specs} ✨` : `Ready-to-move listing at ${place} ✨`,
      desc: [
        `A practical rental at ${place} for everyday city living.`,
        specs ? `Room: ${specs}` : null,
        facilities.length ? `Facilities: ${facilities.join(', ')}` : null,
        nearby.length ? `Nearby: ${nearby.join(', ')}` : null,
        priceBits.length ? `Rent: ${priceBits.join(' · ')}` : null,
        'Tap “Schedule a viewing” on this page to book a visit.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    zh: {
      title: specs ? `${place} — ${specs} ✨` : `${place} 即刻可入住 ✨`,
      desc: [
        `位于 ${place} 的实用出租房源，适合都市日常居住。`,
        specs ? `户型：${specs}` : null,
        facilities.length ? `设施：${facilities.join('、')}` : null,
        nearby.length ? `周边：${nearby.join('、')}` : null,
        priceBits.length ? `租金：${priceBits.join(' · ')}` : null,
        '请点击本页“预约看房”按钮安排参观。',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    ja: {
      title: specs ? `${place} — ${specs} ✨` : `${place} の入居可能な物件 ✨`,
      desc: [
        `${place} の暮らしやすい賃貸物件です。`,
        specs ? `間取り: ${specs}` : null,
        facilities.length ? `設備: ${facilities.join('、')}` : null,
        nearby.length ? `周辺: ${nearby.join('、')}` : null,
        priceBits.length ? `賃料: ${priceBits.join(' · ')}` : null,
        'ページ内の「内見を予約」からご予約ください。',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  };

  const picked = copy[locale];
  return {
    listingTitle: softFitText(picked.title, TITLE_MAX),
    listingDescription: softFitText(picked.desc, DESCRIPTION_SOFT_MAX),
  };
}

@Injectable()
export class ListingPromoService {
  private readonly logger = new Logger(ListingPromoService.name);

  constructor(private readonly gemini: GeminiService) {}

  async generate(body: GenerateListingPromoBody): Promise<GenerateListingPromoResult> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Body is required');
    }
    if (!body.listing || typeof body.listing !== 'object' || Array.isArray(body.listing)) {
      throw new BadRequestException('listing must be an object');
    }

    const locale = normalizeLocale(body.outputLocale ?? body.locale);
    const listing = body.listing as Record<string, unknown>;

    const mock = /^(1|true|yes)$/i.test(String(process.env.GEMINI_MOCK ?? '').trim());
    if (mock) {
      this.logger.log('GEMINI_MOCK=true — returning local listing promo draft');
      await new Promise((r) => setTimeout(r, 700));
      return mockPromo(locale, listing);
    }

    const userPayload = {
      locale,
      listing,
      outputLanguage: locale,
      softMaxDescriptionChars: DESCRIPTION_SOFT_MAX,
    };

    const systemInstruction = `${LISTING_PROMO_SYSTEM_PROMPT}\n\n${listingPromoLocaleStyle(locale)}`;

    const text = await this.gemini.generateContent({
      systemInstruction,
      prompt: `Write listingTitle (max ${TITLE_MAX} chars) and listingDescription (HARD MAX ${DESCRIPTION_SOFT_MAX} chars, including spaces/newlines) entirely in language "${locale}". Prefer a complete shorter description over exceeding the limit. Use ONLY facts in this JSON:\n${JSON.stringify(userPayload)}`,
      json: true,
      temperature: 0.7,
    });

    return parsePromoJson(text);
  }
}
