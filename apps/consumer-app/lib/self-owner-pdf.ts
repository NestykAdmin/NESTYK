import { pdfViewerHtml } from './pdf-viewer/html';

/**
 * The self owner contract file in the shared PDF viewer, continuous mode (Jom 25 Nov 2026, option B): every page one
 * under another. The viewer reports the page in view ("pdf-page:N/M") and the end of the document ("pdf-end"), so the
 * sign page knows when the owner has scrolled to the end.
 */
export function selfOwnerPdfHtml(dataUrl: string): string {
  return pdfViewerHtml(dataUrl, { continuous: true });
}

export type PdfViewerMessage = { type: 'ready' } | { type: 'error' } | { type: 'page'; page: number; total: number } | { type: 'end' };

/** "pdf-ready" / "pdf-error" → the file opened or not; "pdf-page:3/7" → the page in view; "pdf-end" → the end. */
export function parsePdfMessage(data: unknown): PdfViewerMessage | null {
  if (data === 'pdf-ready') return { type: 'ready' };
  if (data === 'pdf-error') return { type: 'error' };
  if (data === 'pdf-end') return { type: 'end' };
  if (typeof data !== 'string') return null;
  const match = /^pdf-page:(\d+)\/(\d+)$/.exec(data);
  if (!match) return null;
  const page = Number(match[1]);
  const total = Number(match[2]);
  return page >= 1 && total >= 1 && page <= total ? { type: 'page', page, total } : null;
}

/** Bytes → base64 (no Buffer on the phone). */
export function pdfBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** The bundled asset's URL: a string on the web, a module id resolved by the app on the phone. */
export type PdfAssetUrl = (source: number | string) => string;

/** Loads a bundled PDF as a data URL; the sandboxed viewer cannot fetch the dev server's files itself (no CORS). */
export async function loadPdfDataUrl(source: number | string, urlOf: PdfAssetUrl): Promise<string> {
  const response = await fetch(urlOf(source));
  if (!response.ok) throw new Error(`pdf ${response.status}`);
  return `data:application/pdf;base64,${pdfBase64(await response.arrayBuffer())}`;
}
