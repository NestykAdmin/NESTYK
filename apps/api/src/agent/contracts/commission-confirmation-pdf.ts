import {
  PDFDocument,
  PDFHexString,
  beginText,
  endText,
  rgb,
  setFillingRgbColor,
  setFontAndSize,
  setTextMatrix,
  showText,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CommissionConfirmationInput } from "@nestyk/types";

type Field = keyof CommissionConfirmationInput;

const SLOT: Record<Field, { x: number; y: number; w: number }> = {
  documentNo: { x: 304, y: 727.2, w: 90 },
  issueDate: { x: 457, y: 727.2, w: 90 },
  landlordName: { x: 106, y: 601.3, w: 148 },
  landlordFirstName: { x: 0, y: 0, w: 0 },
  landlordLastName: { x: 0, y: 0, w: 0 },
  landlordNationality: { x: 336, y: 601.3, w: 36 },
  landlordId: { x: 468, y: 601.3, w: 72 },
  agentName: { x: 130, y: 568.3, w: 126 },
  agentNationality: { x: 336, y: 568.3, w: 36 },
  agentId: { x: 462, y: 568.3, w: 78 },
  propertyType: { x: 126, y: 535.5, w: 128 },
  project: { x: 297, y: 535.5, w: 88 },
  unitNo: { x: 458, y: 535.5, w: 80 },
  propertyAddress: { x: 134, y: 502.6, w: 400 },
  tenantName: { x: 98, y: 469.7, w: 148 },
  tenantFirstName: { x: 0, y: 0, w: 0 },
  tenantLastName: { x: 0, y: 0, w: 0 },
  tenantNationality: { x: 330, y: 469.7, w: 36 },
  tenantIdentity: { x: 462, y: 469.7, w: 78 },
  leasePeriod: { x: 121, y: 436.7, w: 124 },
  leaseStart: { x: 320, y: 436.7, w: 72 },
  leaseEnd: { x: 402, y: 436.7, w: 124 },
  monthlyRent: { x: 64, y: 346.8, w: 80 },
  agreedCommission: { x: 335, y: 346.8, w: 80 },
  bankAccount: { x: 214, y: 277, w: 320 },
  landlordSignName: { x: 108.2, y: 103.8, w: 108 },
  agentSignName: { x: 371.9, y: 103.8, w: 108 },
  landlordSignDate: { x: 109.2, y: 87.9, w: 108 },
  agentSignDate: { x: 373, y: 87.9, w: 108 },
};

const DATE_FIELDS = new Set<Field>([
  "issueDate",
  "leaseStart",
  "leaseEnd",
  "landlordSignDate",
  "agentSignDate",
]);

const MONEY_FIELDS = new Set<Field>(["monthlyRent", "agreedCommission"]);

async function readAsset(name: string): Promise<Buffer> {
  const primary = join(__dirname, "assets", name);
  try {
    return await readFile(primary);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return readFile(join(process.cwd(), "src/agent/contracts/assets", name));
  }
}

function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function formatMoney(value: string) {
  const clean = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return value.trim();
  const [whole, fraction] = clean.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export async function createCommissionConfirmationPdf(
  data: CommissionConfirmationInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(await readAsset("commission-confirmation.pdf"));
  pdf.registerFontkit(fontkit);
  const bytes = await readAsset("NotoSansThai_400Regular.ttf");
  const font = await pdf.embedFont(bytes, { subset: true });
  const shaping = fontkit.create(bytes);
  const page = pdf.getPages()[0];
  if (!page) throw new Error("แม่แบบเอกสารไม่มีหน้า");
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  const ink = rgb(0.13, 0.12, 0.12);
  const widthOf = (value: string, size: number) =>
    (shaping.layout(value).positions.reduce((sum, p) => sum + p.xAdvance, 0) *
      size) /
    shaping.unitsPerEm;

  function draw(value: string, x: number, y: number, size: number) {
    if (!value) return;
    const run = shaping.layout(value);
    const encoded = font.encodeText(value).asString();
    if (encoded.length !== run.glyphs.length * 4)
      throw new Error("Unexpected font encoding");
    let dx = 0;
    let dy = 0;
    const scale = size / shaping.unitsPerEm;
    page.pushOperators(
      beginText(),
      setFontAndSize(fontKey, size),
      setFillingRgbColor(ink.red, ink.green, ink.blue),
    );
    run.positions.forEach((pos, i) => {
      page.pushOperators(
        setTextMatrix(
          1,
          0,
          0,
          1,
          x + (dx + pos.xOffset) * scale,
          y + (dy + pos.yOffset) * scale,
        ),
        showText(PDFHexString.of(encoded.slice(i * 4, i * 4 + 4))),
      );
      dx += pos.xAdvance;
      dy += pos.yAdvance;
    });
    page.pushOperators(endText());
  }

  function fit(value: string, maxWidth: number) {
    const clean = value.replace(/[\r\n\t]+/g, " ").trim();
    if (!clean) return null;
    let size = 9;
    while (size > 6 && widthOf(clean, size) > maxWidth) size -= 0.25;
    if (widthOf(clean, size) <= maxWidth) return { text: clean, size };
    const glyphs = [
      ...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(clean),
    ].map((part) => part.segment);
    let out = "";
    for (const glyph of glyphs) {
      if (widthOf(`${out}${glyph}…`, size) > maxWidth) break;
      out += glyph;
    }
    return out ? { text: `${out}…`, size } : null;
  }

  for (const key of Object.keys(SLOT) as Field[]) {
    const slot = SLOT[key];
    if (!slot.w) continue;
    const raw = DATE_FIELDS.has(key)
      ? formatDate(data[key])
      : MONEY_FIELDS.has(key)
        ? formatMoney(data[key])
        : data[key];
    const fitted = fit(raw, slot.w);
    if (fitted) draw(fitted.text, slot.x, slot.y, fitted.size);
  }
  return Buffer.from(await pdf.save());
}

/**
 * D13 (AC-3.7): where the landlord's and the agent's signatures go, above their lines at the foot of the page
 * (points from the bottom left; the page is US Letter, 612 × 792). Measured on the rendered template.
 */
export const COMMISSION_SIGNATURE_SLOTS = {
  owner: { x: 66, y: 138, maxW: 146, maxH: 36 },
  agent: { x: 330, y: 138, maxW: 146, maxH: 36 },
} as const;

/** Puts the landlord's and the agent's signature images (PNG) on a commission confirmation. */
export async function stampCommissionSignatures(base: Buffer, owner: Buffer, agent: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.load(base);
  const page = pdf.getPages()[0];
  if (!page) throw new Error("แม่แบบเอกสารไม่มีหน้า");
  for (const [party, png] of [["owner", owner], ["agent", agent]] as const) {
    const slot = COMMISSION_SIGNATURE_SLOTS[party];
    const image = await pdf.embedPng(png);
    const size = image.scaleToFit(slot.maxW, slot.maxH);
    page.drawImage(image, { x: slot.x + (slot.maxW - size.width) / 2, y: slot.y, width: size.width, height: size.height });
  }
  return Buffer.from(await pdf.save());
}
