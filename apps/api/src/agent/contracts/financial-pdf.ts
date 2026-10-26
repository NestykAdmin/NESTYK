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
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  FinancialDocumentInput,
  FinancialDocumentKind,
} from "@nestyk/types";
import { bahtText, financialTotals } from "./financial-document";

/** Prefer dist assets; fall back to src when nest watch missed a new file. */
async function readAsset(name: string): Promise<Buffer> {
  const primary = join(__dirname, "assets", name);
  try {
    return await readFile(primary);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return readFile(join(process.cwd(), "src/agent/contracts/assets", name));
  }
}

/**
 * Slots measured from text runs on the paper templates (A4, y from bottom).
 * Sample line items, totals, and bank text baked into the PDF are covered first.
 */
const FIELD = {
  customerName: { x: 148, y: 716, w: 236 },
  customerAddress: { x: 148, y: 699.5, w: 236 },
  customerTaxId: { x: 148, y: 683, w: 236 },
  customerPhone: { x: 148, y: 666.5, w: 118 },
  customerEmail: { x: 318, y: 666.8, w: 72 },
  issuerName: { x: 153, y: 628, w: 148 },
  issuerAddress: { x: 153, y: 611.5, w: 148 },
  issuerTaxId: { x: 429, y: 628, w: 116 },
  issuerPhone: { x: 429, y: 611.5, w: 116 },
  issuerEmail: { x: 429, y: 595, w: 116 },
} as const;

const META_X = 478;
const META_W = 78;
const ROW_Y = [509, 492.5, 476, 459.5, 443];
const DESC_X = 105.5;
const DESC_W = 210;
const QTY_RIGHT = 356;
const PRICE_RIGHT = 460;
const AMOUNT_RIGHT = 549;
const NOTE_X = 56;
const NOTE_W = 208;
const NOTE_Y = [136.2, 126.9, 117.5, 108.2, 98.9, 89.6];

const CHECKS = {
  cash: { x: 42.94, y: 244.9 },
  transfer: { x: 42.94, y: 226.64 },
  cheque: { x: 42.94, y: 208.88 },
  other: { x: 42.94, y: 191.38 },
} as const;

const PAID_Y = { cash: 245.3, transfer: 228.7, cheque: 212.2, other: 195.7 };

/**
 * D11 (TC-3.15): the rows a receipt prints above its notes when the tenant withheld tax: the tax and the net amount
 * received (the receipt total stays the full amount). None on an invoice or without tax.
 */
export function receiptTaxRows(kind: FinancialDocumentKind, data: FinancialDocumentInput): string[] {
  const withheld = kind === "receipt" ? Number(data.withholdingTax ?? 0) : 0;
  if (!(withheld > 0)) return [];
  const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = financialTotals(data).total;
  return [
    `หักภาษี ณ ที่จ่าย ${money(withheld)} บาท`,
    `รับเงินสุทธิ ${money(Math.round((total - withheld) * 100) / 100)} บาท`,
  ];
}

export async function createFinancialPdf(
  kind: FinancialDocumentKind,
  data: FinancialDocumentInput,
): Promise<Buffer> {
  if (data.items.length > ROW_Y.length)
    throw new Error("ระบุรายการได้ไม่เกิน 5 รายการ");
  const template = await readAsset(
    kind === "receipt" ? "receipt.pdf" : "invoice.pdf",
  );
  const pdf = await PDFDocument.load(template);
  pdf.registerFontkit(fontkit);
  const bytes = await readAsset("NotoSansThai_400Regular.ttf");
  const font = await pdf.embedFont(bytes, { subset: true });
  const shaping = fontkit.create(bytes);
  const page = pdf.getPages()[0];
  if (!page) throw new Error("แม่แบบเอกสารไม่มีหน้า");
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  const ink = rgb(0.13, 0.12, 0.12);
  const paper = rgb(1, 1, 1);
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

  function fit(value: string, maxWidth: number, preferred = 9) {
    const clean = value.replace(/[\r\n\t]+/g, " ").trim();
    if (!clean) return "";
    let size = preferred;
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
    return { text: out ? `${out}…` : "…", size };
  }

  function write(value: string, x: number, y: number, maxWidth: number, size = 9) {
    const fitted = fit(value, maxWidth, size);
    if (!fitted) return;
    draw(fitted.text, x, y, fitted.size);
  }

  function right(value: string, x: number, y: number, size = 9) {
    const fitted = fit(value, 90, size);
    if (!fitted) return;
    draw(fitted.text, x - widthOf(fitted.text, fitted.size), y, fitted.size);
  }

  function cover(x: number, y: number, w: number, h: number) {
    page.drawRectangle({ x, y, width: w, height: h, color: paper });
  }

  function pushRow(rows: string[], line: string, maxLines: number) {
    rows.push(line);
    return rows.length >= maxLines;
  }

  function lines(value: string, maxWidth: number, size: number, maxLines: number) {
    const rows: string[] = [];
    let truncated = false;
    const paragraphs = value
      .replace(/\r/g, "")
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean);
    for (let p = 0; p < paragraphs.length; p++) {
      const words = paragraphs[p]!.split(/\s+/);
      let line = "";
      const breakLine = () => {
        if (!line) return false;
        const full = pushRow(rows, line, maxLines);
        line = "";
        return full;
      };
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (widthOf(next, size) <= maxWidth) {
          line = next;
          continue;
        }
        if (breakLine()) {
          truncated = true;
          break;
        }
        if (widthOf(word, size) <= maxWidth) {
          line = word;
          continue;
        }
        for (const { segment } of new Intl.Segmenter("th", {
          granularity: "grapheme",
        }).segment(word)) {
          if (line && widthOf(line + segment, size) > maxWidth && breakLine()) {
            truncated = true;
            break;
          }
          line += segment;
        }
        if (truncated) break;
      }
      if (truncated) break;
      if (line && breakLine() && p < paragraphs.length - 1) truncated = true;
      if (rows.length >= maxLines) break;
    }
    if (!truncated) return rows.slice(0, maxLines);
    const kept = rows.slice(0, maxLines);
    const last = kept[maxLines - 1] ?? "";
    let out = "";
    for (const { segment } of new Intl.Segmenter("th", {
      granularity: "grapheme",
    }).segment(last)) {
      if (widthOf(`${out}${segment}…`, size) > maxWidth) break;
      out += segment;
    }
    kept[maxLines - 1] = out ? `${out}…` : "…";
    return kept;
  }

  const date = (value: string) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value.split("-").reverse().join("/")
      : value;

  // Hide sample rows, totals, and baht words printed on the template.
  cover(46, 428, 510, 90);
  cover(468, 368, 90, 48);
  cover(460, 318, 98, 20);
  cover(318, 303, 242, 16);
  if (data.vatRate !== 7) cover(396, 386, 46, 14);

  if (kind === "invoice") cover(145, 206, 280, 50);
  else cover(126, 224, 280, 16);

  write(data.customerName, FIELD.customerName.x, FIELD.customerName.y, FIELD.customerName.w);
  write(data.customerAddress, FIELD.customerAddress.x, FIELD.customerAddress.y, FIELD.customerAddress.w);
  write(data.customerTaxId, FIELD.customerTaxId.x, FIELD.customerTaxId.y, FIELD.customerTaxId.w);
  write(data.customerPhone, FIELD.customerPhone.x, FIELD.customerPhone.y, FIELD.customerPhone.w);
  write(data.customerEmail, FIELD.customerEmail.x, FIELD.customerEmail.y, FIELD.customerEmail.w);
  write(data.issuerName, FIELD.issuerName.x, FIELD.issuerName.y, FIELD.issuerName.w);
  lines(data.issuerAddress, FIELD.issuerAddress.w, 8, 2).forEach((row, index) => {
    draw(row, FIELD.issuerAddress.x, FIELD.issuerAddress.y - index * 11, 8);
  });
  write(data.issuerTaxId, FIELD.issuerTaxId.x, FIELD.issuerTaxId.y, FIELD.issuerTaxId.w);
  write(data.issuerPhone, FIELD.issuerPhone.x, FIELD.issuerPhone.y, FIELD.issuerPhone.w);
  write(data.issuerEmail, FIELD.issuerEmail.x, FIELD.issuerEmail.y, FIELD.issuerEmail.w);

  write(data.documentNo, META_X, 720.6, META_W);
  write(date(data.issueDate), META_X, 704.1, META_W);
  if (kind === "invoice") {
    write(date(data.dueDate), META_X, 687.6, META_W);
    write(data.reference, META_X, 671.1, META_W);
  } else write(data.reference, META_X, 687.6, META_W);

  const amount = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  data.items.forEach((item, index) => {
    const y = ROW_Y[index];
    if (y == null) return;
    draw(String(index + 1), 52.3, y, 9);
    write(item.description, DESC_X, y, DESC_W);
    right(String(item.quantity), QTY_RIGHT, y);
    right(amount(item.unitPrice), PRICE_RIGHT, y);
    right(
      amount(Math.round(item.quantity * Math.round(item.unitPrice * 100)) / 100),
      AMOUNT_RIGHT,
      y,
    );
  });

  const totals = financialTotals(data);
  right(amount(totals.subtotal), AMOUNT_RIGHT, 405.2);
  right(amount(totals.vat), AMOUNT_RIGHT, 388.7);
  right(amount(totals.discount), AMOUNT_RIGHT, 372.2);
  if (data.vatRate !== 7)
    draw(`(${data.vatRate}%) Vat`, 398, 388.7, 9);
  right(amount(totals.total), AMOUNT_RIGHT, 323.4, 12);
  const words = `(${bahtText(totals.total)})`;
  const wordFit = fit(words, 230, 10);
  if (wordFit)
    draw(wordFit.text, AMOUNT_RIGHT - widthOf(wordFit.text, wordFit.size), 307.6, wordFit.size);

  if (kind === "invoice") {
    const bank = lines(data.paymentDetails, 270, 9, 3);
    [245.3, 228.7, 212.2].forEach((y, index) => {
      const row = bank[index];
      if (row) draw(row, 148, y, 9);
    });
    const sign = fit(data.issuerName, 128, 9);
    if (sign) {
      const w = widthOf(sign.text, sign.size);
      draw(sign.text, 376.2 + (518.8 - 376.2 - w) / 2, 97.2, sign.size);
    }
  } else {
    const method = data.paymentMethod;
    if (method === "cash" || method === "transfer") {
      const box = CHECKS[method];
      const x = box.x + 2.3;
      const y = box.y + 2.6;
      page.drawLine({
        start: { x, y: y + 2.1 },
        end: { x: x + 2.2, y },
        thickness: 1.15,
        color: ink,
      });
      page.drawLine({
        start: { x: x + 2.2, y },
        end: { x: x + 6.2, y: y + 6 },
        thickness: 1.15,
        color: ink,
      });
      write(data.paymentDetails, 130, PAID_Y[method], 400);
    }
    const sign = fit(data.receiverName, 128, 9);
    if (sign) {
      const w = widthOf(sign.text, sign.size);
      draw(sign.text, 354.6 + (497.2 - 354.6 - w) / 2, 97.2, sign.size);
    }
  }

  // D11 (TC-3.15): the tax the tenant withheld and the net amount received, above the notes.
  const taxRows = receiptTaxRows(kind, data);
  [...taxRows, ...lines(data.notes, NOTE_W, 8, NOTE_Y.length - taxRows.length)].forEach((row, index) => {
    const y = NOTE_Y[index];
    if (y != null) draw(row, NOTE_X, y, 8);
  });

  pdf.setTitle(
    `${kind === "receipt" ? "Receipt" : "Invoice"} ${data.documentNo}`,
  );
  pdf.setCreator("NESTYK");
  return Buffer.from(await pdf.save());
}
