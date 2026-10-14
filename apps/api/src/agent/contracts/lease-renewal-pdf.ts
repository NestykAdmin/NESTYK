import {
  PDFDocument,
  PDFHexString,
  rgb,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  setFillingRgbColor,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LeaseRenewalInput } from "@nestyk/types";

export const LEASE_RENEWAL_VERSION = "v1";

type RenewalTextField = Exclude<
  keyof LeaseRenewalInput,
  | "landlordSignaturePng"
  | "tenantSignaturePng"
  | "firstLeaseNo"
  | "firstLeaseDate"
  | "firstLeaseStart"
  | "firstLeaseEnd"
>;

type Blank = {
  x: number;
  w: number;
  y: number;
  size?: number;
  align?: "left" | "center";
};

/**
 * Blanks on lease-renewal.pdf (PDF user space, origin bottom-left).
 * Tuned against the printed underscores of หนังสือต่อสัญญาเช่า.
 */
const SLOTS: Record<RenewalTextField, Blank> = {
  documentNo: { x: 348, w: 70, y: 749 },
  issueDate: { x: 500, w: 70, y: 749 },
  landlordName: { x: 140, w: 160, y: 632 },
  tenantName: { x: 420, w: 140, y: 632 },
  propertyLine: { x: 64, w: 470, y: 604, size: 8 },
  originalLeaseNo: { x: 168, w: 150, y: 583 },
  originalLeaseDate: { x: 445, w: 110, y: 583 },
  originalExpiryDate: { x: 180, w: 180, y: 554 },
  renewMonths: { x: 146, w: 28, y: 518, align: "center" },
  startDate: { x: 110, w: 120, y: 468 },
  endDate: { x: 400, w: 140, y: 468 },
  monthlyRent: { x: 64, w: 120, y: 420 },
  dueDay: { x: 348, w: 40, y: 420, align: "center" },
  bankAccount: { x: 64, w: 470, y: 370 },
  depositCarried: { x: 255, w: 90, y: 342 },
  additionalChanges: { x: 64, w: 470, y: 173 },
  landlordSignName: { x: 90, w: 150, y: 148, size: 8, align: "center" },
  tenantSignName: { x: 370, w: 150, y: 148, size: 8, align: "center" },
};

const SIGNATURE_SLOTS = [
  { key: "landlordSignaturePng" as const, x: 90, y: 156, maxW: 130, maxH: 32 },
  { key: "tenantSignaturePng" as const, x: 370, y: 156, maxW: 130, maxH: 32 },
];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatMoney(value: string) {
  const clean = value.replace(/[,\s]/g, "").trim();
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) return value.trim();
  const [whole, fraction] = clean.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction != null ? `${grouped}.${fraction}` : grouped;
}

async function transparentSignaturePng(dataUrl: string): Promise<Buffer> {
  const input = Buffer.from(
    dataUrl.replace(/^data:image\/png;base64,/i, ""),
    "base64",
  );
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r >= 235 && g >= 235 && b >= 235) data[i + 3] = 0;
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function readAsset(name: string): Promise<Buffer> {
  const primary = join(__dirname, "assets", name);
  try {
    return await readFile(primary);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return readFile(join(process.cwd(), "src/agent/contracts/assets", name));
  }
}

export async function createLeaseRenewalPdf(
  data: LeaseRenewalInput,
): Promise<Buffer> {
  const template = await readAsset("lease-renewal.pdf");
  const pdf = await PDFDocument.load(template);
  pdf.registerFontkit(fontkit);
  const bytes = await readAsset("NotoSansThai_400Regular.ttf");
  const font = await pdf.embedFont(bytes, { subset: true });
  const shaping = fontkit.create(bytes);
  const page = pdf.getPages()[0];
  if (!page) throw new Error("Renewal template has no page");
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  const ink = rgb(0.12, 0.12, 0.12);
  const widthOf = (value: string, size: number) =>
    (shaping.layout(value).positions.reduce((sum, p) => sum + p.xAdvance, 0) *
      size) /
    shaping.unitsPerEm;

  function drawShaped(value: string, x: number, y: number, size: number) {
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

  function fit(value: string, maxWidth: number, preferredSize: number) {
    const clean = value.replace(/[\r\n\t]+/g, " ").trim();
    if (!clean) return { text: "", size: preferredSize };
    let size = preferredSize;
    while (size > 6.5 && widthOf(clean, size) > maxWidth) size -= 0.5;
    if (widthOf(clean, size) <= maxWidth) return { text: clean, size };
    let out = clean;
    while (out.length && widthOf(out, size) > maxWidth) out = out.slice(0, -1);
    if (out !== clean && out.length > 3) out = `${out.slice(0, -1)}…`;
    return { text: out, size };
  }

  function write(value: string, slot: Blank) {
    const preferred = slot.size ?? 9;
    const { text, size } = fit(value, slot.w - 2, preferred);
    if (!text) return;
    const textW = widthOf(text, size);
    const x =
      slot.align === "center"
        ? slot.x + Math.max(0, (slot.w - textW) / 2)
        : slot.x + 1;
    drawShaped(text, x, slot.y + 0.8, size);
  }

  const values: LeaseRenewalInput = {
    ...data,
    issueDate: formatDate(data.issueDate),
    originalLeaseDate: formatDate(data.originalLeaseDate),
    originalExpiryDate: formatDate(data.originalExpiryDate),
    startDate: formatDate(data.startDate),
    endDate: formatDate(data.endDate),
    monthlyRent: formatMoney(data.monthlyRent),
    depositCarried: formatMoney(data.depositCarried),
  };

  (Object.keys(SLOTS) as RenewalTextField[]).forEach((key) => {
    write(values[key], SLOTS[key]);
  });

  for (const slot of SIGNATURE_SLOTS) {
    const raw = values[slot.key];
    if (!raw) continue;
    const png = await transparentSignaturePng(raw);
    const image = await pdf.embedPng(png);
    const size = image.scaleToFit(slot.maxW, slot.maxH);
    page.drawImage(image, {
      x: slot.x + (slot.maxW - size.width) / 2,
      y: slot.y,
      width: size.width,
      height: size.height,
    });
  }

  pdf.setTitle("หนังสือต่อสัญญาเช่า");
  pdf.setCreator("NESTYK");
  return Buffer.from(await pdf.save());
}

export async function stampLeaseRenewalSignatures(
  base: Buffer,
  signatures: { owner: Buffer; tenant: Buffer },
): Promise<Buffer> {
  const pdf = await PDFDocument.load(base);
  const page = pdf.getPages()[0];
  if (!page) throw new Error("Renewal template has no page");
  const pairs = [
    { slot: SIGNATURE_SLOTS[0]!, png: signatures.owner },
    { slot: SIGNATURE_SLOTS[1]!, png: signatures.tenant },
  ];
  for (const { slot, png } of pairs) {
    const image = await pdf.embedPng(png);
    const size = image.scaleToFit(slot.maxW, slot.maxH);
    page.drawImage(image, {
      x: slot.x + (slot.maxW - size.width) / 2,
      y: slot.y,
      width: size.width,
      height: size.height,
    });
  }
  return Buffer.from(await pdf.save());
}
