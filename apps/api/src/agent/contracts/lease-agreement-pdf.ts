import {
  PDFDocument,
  PDFHexString,
  PDFPage,
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
import type { LeaseAgreementInput } from "@nestyk/types";

export const LEASE_AGREEMENT_VERSION = "v1";

type LeaseTextField = Exclude<
  keyof LeaseAgreementInput,
  "landlordSignaturePng" | "tenantSignaturePng"
>;

type Blank = {
  page: number;
  x: number;
  w: number;
  y: number;
  size?: number;
  align?: "left" | "center";
};

/**
 * Blank slots measured from pdf.js text runs on lease-agreement.pdf
 * (Letter 612×792). Coordinates are PDF space (origin bottom-left).
 */
const SLOTS: Partial<Record<LeaseTextField, Blank | Blank[]>> = {
  documentNo: { page: 0, x: 470.0, w: 100.0, y: 672.0 },
  issueDate: { page: 0, x: 480.0, w: 90.0, y: 686.0 },
  landlordName: { page: 0, x: 285.0, w: 250.0, y: 557.0 },
  landlordNationality: { page: 0, x: 285.0, w: 250.0, y: 546.0 },
  landlordId: { page: 0, x: 285.0, w: 250.0, y: 535.0 },
  landlordAddress: { page: 0, x: 285.0, w: 250.0, y: 522.0 },
  landlordPhone: { page: 0, x: 285.0, w: 88.0, y: 510.0 },
  landlordEmail: { page: 0, x: 445.0, w: 110.0, y: 510.0 },
  tenantName: { page: 0, x: 285.0, w: 250.0, y: 454.0 },
  tenantNationality: { page: 0, x: 285.0, w: 250.0, y: 443.0 },
  tenantId: { page: 0, x: 285.0, w: 250.0, y: 431.0 },
  tenantAddress: { page: 0, x: 285.0, w: 250.0, y: 420.0 },
  tenantPhone: { page: 0, x: 285.0, w: 88.0, y: 408.0 },
  tenantEmail: { page: 0, x: 445.0, w: 110.0, y: 408.0 },
  propertyType: { page: 0, x: 285.0, w: 250.0, y: 306.0 },
  project: { page: 0, x: 285.0, w: 250.0, y: 295.0 },
  houseNo: { page: 0, x: 285.0, w: 250.0, y: 283.0 },
  propertyAddress: { page: 0, x: 285.0, w: 250.0, y: 272.0 },
  roomType: { page: 0, x: 285.0, w: 250.0, y: 261.0 },
  floor: { page: 0, x: 285.0, w: 250.0, y: 249.0 },
  area: { page: 0, x: 285.0, w: 25.0, y: 238.0 },
  termMonths: { page: 0, x: 148.0, w: 48.0, y: 113.0, align: "center" },
  termFrom: { page: 0, x: 332.0, w: 60.0, y: 113.0, align: "center" },
  termTo: { page: 0, x: 458.0, w: 70.0, y: 113.0, align: "center" },
  monthlyRent: { page: 1, x: 135.0, w: 125.0, y: 621.0, align: "center" },
  monthlyRentWords: { page: 1, x: 295.0, w: 190.0, y: 621.0, align: "center" },
  rentDueDay: { page: 1, x: 185.0, w: 55.0, y: 608.0, align: "center" },
  graceDay: { page: 1, x: 422.0, w: 40.0, y: 608.0, align: "center" },
  latePenalty: { page: 1, x: 320.0, w: 45.0, y: 596.0, align: "center" },
  latePenaltyWords: { page: 1, x: 395.0, w: 90.0, y: 596.0, align: "center" },
  bankName: { page: 1, x: 220.0, w: 280.0, y: 478.0 },
  accountName: { page: 1, x: 220.0, w: 280.0, y: 467.0 },
  accountNo: { page: 1, x: 220.0, w: 280.0, y: 456.0 },
  otherPaymentMethod: { page: 1, x: 78.0, w: 450.0, y: 394.0 },
  advanceMonths: { page: 1, x: 198.0, w: 24.0, y: 254.0, align: "center" },
  advanceAmount: { page: 1, x: 430.0, w: 90.0, y: 254.0, align: "center" },
  depositMonths: { page: 1, x: 224.0, w: 20.0, y: 231.0, align: "center" },
  depositAmount: { page: 1, x: 430.0, w: 90.0, y: 231.0, align: "center" },
  otherInitialPayment: { page: 1, x: 120.0, w: 400.0, y: 208.0 },
  additionalTerms: [
    { page: 6, x: 78.0, w: 450.0, y: 593.0, size: 8 },
    { page: 6, x: 78.0, w: 450.0, y: 566.0, size: 8 },
    { page: 6, x: 78.0, w: 450.0, y: 540.0, size: 8 },
    { page: 6, x: 78.0, w: 450.0, y: 513.0, size: 8 },
  ],
  agentContact: { page: 6, x: 78.0, w: 450.0, y: 455.0, size: 8 },
  landlordSignName: {
    page: 6,
    x: 78.0,
    w: 124.0,
    y: 205.0,
    size: 8,
    align: "center",
  },
  tenantSignName: {
    page: 6,
    x: 319.0,
    w: 124.0,
    y: 205.0,
    size: 8,
    align: "center",
  },
  witnessSignName: {
    page: 6,
    x: 209.0,
    w: 124.0,
    y: 141.0,
    size: 8,
    align: "center",
  },
};

const SIGNATURE_SLOTS: Array<{
  key: "landlordSignaturePng" | "tenantSignaturePng";
  page: number;
  x: number;
  y: number;
  maxW: number;
  maxH: number;
}> = [
  // Footer Sign……Landlord / Tenant on pages 1–6 (0-based 0–5)
  ...[0, 1, 2, 3, 4, 5].flatMap((page) => [
    {
      key: "landlordSignaturePng" as const,
      page,
      x: 90.0,
      y: 42.0,
      maxW: 160,
      maxH: 24,
    },
    {
      key: "tenantSignaturePng" as const,
      page,
      x: 350.0,
      y: 42.0,
      maxW: 160,
      maxH: 24,
    },
  ]),
  // Formal signature boxes on page 7
  {
    key: "landlordSignaturePng",
    page: 6,
    x: 76.0,
    y: 228.0,
    maxW: 130,
    maxH: 36,
  },
  {
    key: "tenantSignaturePng",
    page: 6,
    x: 319.0,
    y: 228.0,
    maxW: 130,
    maxH: 36,
  },
];

function formatDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatMoney(value: string) {
  const clean = value.replace(/[,\s]/g, "").trim();
  if (!clean) return "";
  if (!/^\d+(\.\d+)?$/.test(clean)) return value.trim();
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
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function wrapLines(
  text: string,
  maxWidth: number,
  size: number,
  widthOf: (value: string, size: number) => number,
  maxLines: number,
) {
  const words = text.replace(/[\r\n\t]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (widthOf(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1]!;
    let clipped = last;
    while (clipped.length && widthOf(`${clipped}…`, size) > maxWidth)
      clipped = clipped.slice(0, -1);
    lines[maxLines - 1] = clipped ? `${clipped}…` : "…";
  }
  return lines;
}

/** Prefer dist assets; fall back to src when nest watch missed a new file. */
async function readAsset(name: string): Promise<Buffer> {
  const primary = join(__dirname, "assets", name);
  try {
    return await readFile(primary);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return readFile(
      join(process.cwd(), "src/agent/contracts/assets", name),
    );
  }
}

export async function createLeaseAgreementPdf(
  data: LeaseAgreementInput,
): Promise<Buffer> {
  const template = await readAsset("lease-agreement.pdf");
  const pdf = await PDFDocument.load(template);
  pdf.registerFontkit(fontkit);
  const bytes = await readAsset("NotoSansThai_400Regular.ttf");
  const font = await pdf.embedFont(bytes, { subset: true });
  const shaping = fontkit.create(bytes);
  const pages = pdf.getPages();
  const fontKeys = pages.map((page) =>
    page.node.newFontDictionary(font.name, font.ref),
  );
  const ink = rgb(0.12, 0.12, 0.12);
  const widthOf = (value: string, size: number) =>
    (shaping.layout(value).positions.reduce((sum, p) => sum + p.xAdvance, 0) *
      size) /
    shaping.unitsPerEm;

  function drawShaped(
    page: PDFPage,
    fontKey: ReturnType<PDFPage["node"]["newFontDictionary"]>,
    value: string,
    x: number,
    y: number,
    size: number,
  ) {
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
    const page = pages[slot.page];
    const fontKey = fontKeys[slot.page];
    if (!page || !fontKey) return;
    const preferred = slot.size ?? 9;
    const { text, size } = fit(value, slot.w - 2, preferred);
    if (!text) return;
    const textW = widthOf(text, size);
    const x =
      slot.align === "center"
        ? slot.x + Math.max(0, (slot.w - textW) / 2)
        : slot.x + 1;
    drawShaped(page, fontKey, text, x, slot.y + 0.8, size);
  }

  const values: LeaseAgreementInput = {
    ...data,
    issueDate: formatDate(data.issueDate),
    termFrom: formatDate(data.termFrom),
    termTo: formatDate(data.termTo),
    monthlyRent: formatMoney(data.monthlyRent),
    advanceAmount: formatMoney(data.advanceAmount),
    depositAmount: formatMoney(data.depositAmount),
    latePenalty: formatMoney(data.latePenalty),
  };

  (Object.keys(SLOTS) as LeaseTextField[]).forEach((key) => {
    const slot = SLOTS[key];
    if (!slot) return;
    const value = values[key];
    if (key === "additionalTerms" && Array.isArray(slot)) {
      const size = slot[0]?.size ?? 8;
      const lines = wrapLines(
        String(value ?? ""),
        (slot[0]?.w ?? 450) - 2,
        size,
        widthOf,
        slot.length,
      );
      slot.forEach((row, i) => write(lines[i] ?? "", row));
      return;
    }
    if (Array.isArray(slot)) slot.forEach((s) => write(String(value ?? ""), s));
    else write(String(value ?? ""), slot);
  });

  const signatureImages = new Map<
    "landlordSignaturePng" | "tenantSignaturePng",
    Awaited<ReturnType<PDFDocument["embedPng"]>>
  >();
  for (const slot of SIGNATURE_SLOTS) {
    const raw = values[slot.key];
    if (!raw) continue;
    const page = pages[slot.page];
    if (!page) continue;
    let image = signatureImages.get(slot.key);
    if (!image) {
      const png = await transparentSignaturePng(raw);
      image = await pdf.embedPng(png);
      signatureImages.set(slot.key, image);
    }
    const size = image.scaleToFit(slot.maxW, slot.maxH);
    page.drawImage(image, {
      x: slot.x + (slot.maxW - size.width) / 2,
      y: slot.y,
      width: size.width,
      height: size.height,
    });
  }

  pdf.setTitle("สัญญาเช่าเพื่ออยู่อาศัย");
  pdf.setCreator("NESTYK");
  return Buffer.from(await pdf.save());
}

/** D9: the witness signs once, in the box above the witness name on page 7. */
export const WITNESS_SIGNATURE_SLOT = { page: 6, x: 206.0, y: 164.0, maxW: 130, maxH: 36 } as const;

/** Stamp owner (landlord) + tenant PNGs onto a filled lease PDF (every page), and the witness PNG on page 7. */
export async function stampLeaseAgreementSignatures(
  base: Buffer,
  signatures: { owner: Buffer; tenant: Buffer; witness?: Buffer },
): Promise<Buffer> {
  const pdf = await PDFDocument.load(base);
  const pages = pdf.getPages();
  const byKey = {
    landlordSignaturePng: signatures.owner,
    tenantSignaturePng: signatures.tenant,
  } as const;
  const embedded = new Map<keyof typeof byKey, Awaited<ReturnType<PDFDocument["embedPng"]>>>();
  const witnessPage = pages[WITNESS_SIGNATURE_SLOT.page];
  if (signatures.witness && witnessPage) {
    const image = await pdf.embedPng(signatures.witness);
    const size = image.scaleToFit(WITNESS_SIGNATURE_SLOT.maxW, WITNESS_SIGNATURE_SLOT.maxH);
    witnessPage.drawImage(image, {
      x: WITNESS_SIGNATURE_SLOT.x + (WITNESS_SIGNATURE_SLOT.maxW - size.width) / 2,
      y: WITNESS_SIGNATURE_SLOT.y,
      width: size.width,
      height: size.height,
    });
  }
  for (const slot of SIGNATURE_SLOTS) {
    const page = pages[slot.page];
    if (!page) continue;
    let image = embedded.get(slot.key);
    if (!image) {
      image = await pdf.embedPng(byKey[slot.key]);
      embedded.set(slot.key, image);
    }
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
