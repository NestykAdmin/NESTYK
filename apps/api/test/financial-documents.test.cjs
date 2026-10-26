const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require("reflect-metadata");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText,
    filename,
  );
const {
  financialTotals,
  bahtText,
  validateFinancialDocument,
  receiptReceiver,
  receiverLine,
  withholdingTaxOf,
} = require("../src/agent/contracts/financial-document.ts");
const { reservationInvoice } = require("../src/agent/contracts/reservation-invoice.ts");
const zlib = require("node:zlib");
const {
  createFinancialPdf,
  receiptTaxRows,
} = require("../src/agent/contracts/financial-pdf.ts");
const {
  AgentContractsService,
} = require("../src/agent/contracts/agent-contracts.service.ts");
const sample = {
  documentNo: "REC-RS202600002",
  issueDate: "2026-09-16",
  dueDate: "2026-09-20",
  reference: "RS202600002",
  customerName: "สมชาย ใจดี",
  customerAddress:
    "123 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร 10110",
  customerTaxId: "",
  customerPhone: "0812345678",
  customerEmail: "customer@example.com",
  issuerName: "บริษัท ตัวอย่าง จำกัด",
  issuerAddress: "456 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310",
  issuerTaxId: "0123456789012",
  issuerPhone: "029876543",
  issuerEmail: "issuer@example.com",
  items: [
    {
      description: "เงินจอง Wind Sukhumvit 23 ห้อง 1201",
      quantity: 1,
      unitPrice: 20000,
    },
  ],
  vatRate: 0,
  discount: 0,
  paymentMethod: "transfer",
  paymentDetails: "ธนาคารตัวอย่าง เลขอ้างอิง TEST-001",
  receiverName: "สมหญิง ใจดี",
  notes: "ตัวอย่างสำหรับตรวจรูปแบบ PDF เท่านั้น",
};
test("financial inputs reject invalid dates, amounts, missing fields and invalid methods", () => {
  assert.deepEqual(validateFinancialDocument(sample, "receipt"), sample);
  for (const patch of [
    { issueDate: "2026-02-30" },
    { customerAddress: "" },
    { issuerName: "" },
    { discount: 20001 },
    { vatRate: 99 },
    { paymentMethod: "" },
    { items: [] },
    { items: [{ description: "x", quantity: -1, unitPrice: 1 }] },
    { customerTaxId: "123" },
    { discount: 0.001 },
  ]) {
    assert.throws(() =>
      validateFinancialDocument({ ...sample, ...patch }, "receipt"),
    );
  }
  assert.throws(() =>
    validateFinancialDocument({ ...sample, dueDate: "2026-09-01" }, "invoice"),
  );
});
test("totals use cents, discount before VAT, and Thai amount words", () => {
  assert.deepEqual(financialTotals({ ...sample, discount: 100, vatRate: 7 }), {
    subtotal: 20000,
    discount: 100,
    vat: 1393,
    total: 21293,
  });
  assert.equal(
    financialTotals({ ...sample, items: [{ quantity: 3, unitPrice: 0.1 }] })
      .total,
    0.3,
  );
  assert.equal(bahtText(20000), "สองหมื่นบาทถ้วน");
  assert.equal(bahtText(21.25), "ยี่สิบเอ็ดบาทยี่สิบห้าสตางค์");
});
test("receipt and invoice PDFs render Thai with five rows and retain a valid PDF", async () => {
  for (const kind of ["receipt", "invoice"]) {
    const input = {
      ...sample,
      documentNo: `${kind === "invoice" ? "INV" : "REC"}-RS202600002`,
      items: Array.from({ length: 5 }, (_, i) => ({
        description: `รายการ ${i + 1} เงินจองห้องพักและค่าใช้จ่ายตามข้อตกลงสำหรับทดสอบ`,
        quantity: 1,
        unitPrice: 4000,
      })),
      vatRate: 7,
      discount: 100,
    };
    const bytes = await createFinancialPdf(kind, input);
    assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    if (process.env.PDF_QA_DIR) {
      fs.mkdirSync(process.env.PDF_QA_DIR, { recursive: true });
      fs.writeFileSync(`${process.env.PDF_QA_DIR}/${kind}.pdf`, bytes);
    }
  }
});
function serviceFixture({ denied = false, failUpdate = false } = {}) {
  const row = {
    id: 11,
    created_by_user_id: 7,
    contract_no: "RS202600002",
    agreement_type: { form_kind: "reservation" },
    status: "draft",
    start_date: "2026-09-16",
    tenant: { name: "Tenant", phone: "0812345678", email: "t@example.com" },
    party_snapshot: { ownerName: "Owner", ownerPhone: "029999999" },
    reservation_fee: "20000",
    data: { untouched: true },
    rent_room: { property: { name: "Property" } },
  };
  const qb = {};
  for (const key of ["leftJoinAndSelect", "where", "andWhere"])
    qb[key] = () => qb;
  qb.getOne = async () => (denied ? null : row);
  let uploads = 0,
    removed = 0;
  const repo = {
    createQueryBuilder: () => qb,
    findOne: async () => row,
    update: async (_, patch) => {
      if (failUpdate) throw new Error("DB failure");
      Object.assign(row, patch);
    },
  };
  const db = {
    getRepository: () => repo,
    transaction: async (fn) => fn({ getRepository: () => repo }),
  };
  const storage = {
    upload: async () => {
      uploads++;
      return { path: "7/11/receipt/test.pdf" };
    },
    remove: async () => {
      removed++;
    },
  };
  const service = new AgentContractsService(db, storage);
  service.view = async () => row;
  return { service, row, counts: () => ({ uploads, removed }) };
}
function seedContractInvoice(row) {
  row.invoice_url = "7/11/invoice/test.pdf";
  row.data = {
    ...row.data,
    financialDocuments: {
      invoice: {
        ...sample,
        documentNo: "INV-test",
        paymentMethod: "",
        receiverName: "",
      },
    },
  };
}
test("defaults prefill known values; receipt reuses invoice; generation preserves other contract data", async () => {
  const { service, row } = serviceFixture();
  const defaults = await service.financialDocumentDefaults(7, 11, "invoice");
  assert.equal(defaults.customerName, "Tenant");
  assert.equal(defaults.customerPhone, "0812345678");
  assert.equal(defaults.items[0].unitPrice, 20000);
  await assert.rejects(
    () => service.financialDocumentDefaults(7, 11, "receipt"),
    /ใบแจ้งหนี้/,
  );
  const invoice = await service.generateFinancialDocument(7, 11, "invoice", {
    ...sample, documentNo: "HACKED", items: [{ description: "hack", quantity: 1, unitPrice: 1 }],
  });
  assert.equal(row.data.financialDocuments.invoice.documentNo, "INV-RS202600002");
  assert.equal(row.data.financialDocuments.invoice.items[0].unitPrice, 20000);
  assert.equal(row.data.untouched, true);
  seedContractInvoice(row);
  const receipt = await service.financialDocumentDefaults(7, 11, "receipt");
  assert.equal(receipt.reference, "INV-test");
  assert.equal(receipt.customerAddress, sample.customerAddress);
  assert.equal(receipt.paymentMethod, "");
  await service.generateFinancialDocument(7, 11, "receipt", {
    documentNo: "REC-test",
    issueDate: "2026-09-16",
    paymentMethod: "transfer",
    paymentDetails: "bank",
    receiverName: "Receiver",
    notes: "",
    customerName: "HACKED",
    items: [{ description: "hack", quantity: 1, unitPrice: 1 }],
    discount: 0,
    vatRate: 0,
  });
  assert.equal(row.data.financialDocuments.receipt.customerName, sample.customerName);
  assert.equal(row.data.financialDocuments.receipt.items[0].unitPrice, 20000);
  assert.equal(row.data.financialDocuments.receipt.reference, "INV-test");
  assert.equal(row.data.untouched, true);
  assert.equal(row.invoice_url, "7/11/invoice/test.pdf");
});
test("inaccessible contract uploads nothing and failed persistence cleans uploaded PDF", async () => {
  const denied = serviceFixture({ denied: true });
  await assert.rejects(() =>
    denied.service.generateFinancialDocument(8, 11, "invoice", {
      ...sample,
      paymentMethod: "",
      receiverName: "",
    }),
  );
  assert.equal(denied.counts().uploads, 0);
  const failed = serviceFixture({ failUpdate: true });
  seedContractInvoice(failed.row);
  await assert.rejects(
    () =>
      failed.service.generateFinancialDocument(7, 11, "receipt", {
        documentNo: "REC-test",
        issueDate: "2026-09-16",
        paymentMethod: "transfer",
        paymentDetails: "bank",
        receiverName: "Receiver",
        notes: "",
      }),
    /DB failure/,
  );
  assert.deepEqual(failed.counts(), { uploads: 1, removed: 1 });
});
test("finalized reservation accepts a booking receipt without changing the signed letter", async () => {
  const { service, row, counts } = serviceFixture();
  row.document_url = "7/11/generated/reservation_letter/letter-v1/reservation.pdf";
  row.status = "active";
  seedContractInvoice(row);
  await service.generateFinancialDocument(7, 11, "receipt", {
    issueDate: "2026-09-16", paymentMethod: "cash", receiverName: "Receiver",
  });
  assert.equal(counts().uploads, 1);
  assert.equal(row.document_url, "7/11/generated/reservation_letter/letter-v1/reservation.pdf");
  assert.equal(row.status, "active");
  const first = row.receipt_url;
  await service.generateFinancialDocument(7, 11, "receipt", { paymentMethod: "cash", receiverName: "other" });
  assert.equal(row.receipt_url, first);
  assert.equal(counts().uploads, 1);
});
test("standalone invoice number is generated and ignores the submitted number", async () => {
  let saved = null;
  const repo = {
    find: async () => (saved ? [saved] : []),
    create: (row) => row,
    save: async (row) => {
      saved = { ...row, id: 4, issue_date: row.issue_date };
      return saved;
    },
  };
  const db = {
    getRepository: () => repo,
    transaction: async (fn) =>
      fn({
        getRepository: () => repo,
        query: async (sql) =>
          String(sql).includes("document_no") && saved
            ? [{ document_no: saved.document_no }]
            : [],
      }),
  };
  const documents = {
    uploadStandaloneInvoice: async () => ({ path: "7/invoices/a.pdf" }),
    signPaths: async (paths) => new Map(paths.filter(Boolean).map((path) => [path, `https://files/${path}`])),
    remove: async () => {},
  };
  const service = new AgentContractsService(db, documents);
  const created = await service.createStandaloneInvoice(7, {
    ...sample,
    documentNo: "INV-FREE",
    paymentMethod: "",
    receiverName: "",
  });
  assert.match(created.documentNo, /^INV\d{4}\d{5}$/);
  assert.notEqual(created.documentNo, "INV-FREE");
  assert.equal(created.customerName, sample.customerName);
  assert.equal(saved.data.issuerName, "NESTYK");
  assert.equal(saved.data.issuerAddress, "Bangkok");
  assert.equal(created.total, 20000);
  assert.equal(created.invoiceUrl, "https://files/7/invoices/a.pdf");
  assert.equal(saved.document_no, created.documentNo);
  const again = await service.createStandaloneInvoice(7, {
    ...sample,
    documentNo: "HACKED",
    paymentMethod: "",
    receiverName: "",
  });
  assert.notEqual(again.documentNo, created.documentNo);
  assert.match(again.documentNo, /^INV\d{4}\d{5}$/);
});
test("receipt follows the chosen invoice and keeps its number when replaced", async () => {
  const invoiceData = {
    ...sample,
    documentNo: "INV202600001",
    paymentMethod: "",
    receiverName: "",
  };
  const invoices = new Map([
    [
      3,
      {
        id: 3,
        created_by_user_id: 7,
        document_no: "INV202600001",
        issue_date: "2026-09-16",
        customer_name: sample.customerName,
        data: invoiceData,
        pdf_path: "7/invoices/a.pdf",
        receipt_document_no: null,
        receipt_issue_date: null,
        receipt_data: null,
        receipt_pdf_path: null,
      },
    ],
    [
      8,
      {
        id: 8,
        created_by_user_id: 7,
        document_no: "INV202600002",
        issue_date: "2026-09-16",
        customer_name: sample.customerName,
        data: { ...invoiceData, documentNo: "INV202600002" },
        pdf_path: "7/invoices/b.pdf",
        receipt_document_no: null,
        receipt_issue_date: null,
        receipt_data: null,
        receipt_pdf_path: null,
      },
    ],
  ]);
  const repo = {
    findOne: async ({ where }) => {
      const row = invoices.get(where.id);
      if (!row || row.created_by_user_id !== where.created_by_user_id) return null;
      return row;
    },
    save: async (row) => {
      invoices.set(row.id, row);
      return row;
    },
  };
  const db = {
    getRepository: () => repo,
    transaction: async (fn) =>
      fn({
        getRepository: () => repo,
        query: async (sql) => {
          if (!String(sql).includes("receipt_document_no")) return [];
          const latest = [...invoices.values()]
            .map((row) => row.receipt_document_no)
            .filter(Boolean)
            .sort()
            .at(-1);
          return latest ? [{ receipt_document_no: latest }] : [];
        },
      }),
  };
  let uploads = 0;
  const documents = {
    uploadStandaloneReceipt: async () => ({ path: `7/receipts/${++uploads}.pdf` }),
    uploadPaymentSlip: async () => ({ path: `7/payment-slips/${++uploads}.jpg` }),
    signPaths: async (paths) =>
      new Map(paths.filter(Boolean).map((path) => [path, `https://files/${path}`])),
    remove: async () => {},
  };
  const service = new AgentContractsService(db, documents);
  const created = await service.createReceiptForInvoice(7, 3, {
    documentNo: "HACKED",
    issueDate: "2026-09-20",
    paymentMethod: "cash",
    paymentDetails: "",
    receiverName: "ผู้รับเงิน",
    notes: "",
    customerName: "คนอื่น",
    items: [{ description: "hack", quantity: 1, unitPrice: 1 }],
    discount: 0,
    vatRate: 0,
  });
  assert.match(created.receiptDocumentNo, /^REC\d{4}\d{5}$/);
  assert.notEqual(created.receiptDocumentNo, "HACKED");
  assert.equal(created.documentNo, "INV202600001");
  assert.equal(created.customerName, sample.customerName);
  assert.equal(created.total, 20000);
  assert.match(created.receiptUrl, /^https:\/\/files\/7\/receipts\//);
  const replaced = await service.createReceiptForInvoice(7, 3, {
    issueDate: "2026-09-21",
    paymentMethod: "transfer",
    paymentDetails: "bank",
    receiverName: "ผู้รับเงิน",
    notes: "",
  });
  assert.equal(replaced.receiptDocumentNo, created.receiptDocumentNo);
  const other = await service.createReceiptForInvoice(7, 8, {
    issueDate: "2026-09-22",
    paymentMethod: "cash",
    receiverName: "ผู้รับเงิน",
    notes: "",
  });
  assert.notEqual(other.receiptDocumentNo, created.receiptDocumentNo);
  assert.equal(other.documentNo, "INV202600002");
  await assert.rejects(
    () =>
      service.createReceiptForInvoice(7, 3, {
        issueDate: "2026-09-23",
        paymentMethod: "",
        receiverName: "ผู้รับเงิน",
        notes: "",
      }),
    /สลิป/,
  );
  const slipped = await service.createReceiptForInvoice(
    7,
    3,
    {
      issueDate: "2026-09-23",
      paymentMethod: "",
      receiverName: "ผู้รับเงิน",
      notes: "",
    },
    { buffer: Buffer.from([0xff, 0xd8, 0xff]), size: 3 },
  );
  assert.equal(slipped.receiptDocumentNo, created.receiptDocumentNo);
  assert.match(slipped.paymentSlipUrl, /payment-slips/);
  assert.equal(invoices.get(3).receipt_data.paymentMethod, "");
  await assert.rejects(
    () =>
      service.createReceiptForInvoice(7, 99, {
        issueDate: "2026-09-22",
        paymentMethod: "cash",
        receiverName: "ผู้รับเงิน",
        notes: "",
      }),
    /ไม่พบใบแจ้งหนี้/,
  );
});
test("invoice payer name is the opened tenant", async () => {
  let saved = null;
  const repo = {
    create: (row) => row,
    save: async (row) => {
      saved = { ...row, id: 4, issue_date: row.issue_date };
      return saved;
    },
  };
  const db = {
    transaction: async (fn) =>
      fn({
        getRepository: () => repo,
        findOne: async (_entity, options) => {
          const where = options?.where ?? {};
          return where.id === 9 && where.created_by_user_id === 7
            ? {
                id: 9,
                name: "Jomnakub",
                created_by_user_id: 7,
                lead: {
                  rent_room: {
                    property: {
                      address: "12 Sukhumvit",
                      subdistrict: "-",
                      district: "",
                      province: "Bangkok",
                      postal_code: "10110",
                    },
                  },
                },
              }
            : null;
        },
        query: async () => [],
      }),
  };
  const documents = {
    uploadStandaloneInvoice: async () => ({ path: "7/invoices/payer.pdf" }),
    signPaths: async (paths) =>
      new Map(paths.filter(Boolean).map((path) => [path, `https://files/${path}`])),
    remove: async () => {},
  };
  const service = new AgentContractsService(db, documents);
  const created = await service.createStandaloneInvoice(7, {
    ...sample,
    documentNo: "INV-FREE",
    customerName: "คนอื่น",
    tenantId: 9,
    paymentMethod: "",
    receiverName: "",
  });
  assert.equal(created.customerName, "Jomnakub");
  assert.equal(created.tenantId, 9);
  assert.equal(saved.tenant_id, 9);
  assert.equal(saved.data.customerName, "Jomnakub");
  assert.equal(saved.data.customerAddress, "12 Sukhumvit, Bangkok, 10110");
  assert.equal(saved.data.issuerName, "NESTYK");
  assert.equal(saved.data.issuerAddress, "Bangkok");
  await assert.rejects(
    () =>
      service.createStandaloneInvoice(7, {
        ...sample,
        tenantId: 99,
        paymentMethod: "",
        receiverName: "",
      }),
    /ไม่พบผู้เช่า/,
  );
});

// D11 (AC-3.3): the booking invoice is issued in the landlord's name, like the deposit invoice (no longer NESTYK).
test("D11: the booking invoice is issued by the landlord on the reservation letter", () => {
  const c = {
    id: 11, contract_no: "RS202600011", start_date: "2026-11-01", reservation_fee: "20000",
    rent_room: { room_id: "1201", property: { name: "Aria" }, owner_bank_name: "KBank", owner_bank_account: "111" },
    tenant: { name: "Tenant B", phone: "0811111111", email: "t@example.com" },
    party_snapshot: { ownerName: "Snapshot Owner", ownerPhone: "0822222222", propertyAddress: "1 Aria Rd", ownerTaxId: "1234567890123" },
    data: { reservationLetter: { landlordName: "Landlord A", landlordPhone: "0899999999", landlordEmail: "owner@example.com", bankAccount: "SCB 222" } },
  };
  const invoice = reservationInvoice(c);
  assert.deepEqual(
    [invoice.issuerName, invoice.issuerAddress, invoice.issuerTaxId, invoice.issuerPhone, invoice.issuerEmail, invoice.paymentDetails],
    ["Landlord A", "1 Aria Rd", "1234567890123", "0899999999", "owner@example.com", "SCB 222"],
  );
  assert.doesNotThrow(() => validateFinancialDocument(invoice, "invoice"));
  // Without the letter: the booking snapshot; an e-mail or tax ID that is not valid is left out.
  const bare = reservationInvoice({ ...c, party_snapshot: { ...c.party_snapshot, ownerTaxId: "12-3", ownerAddress: "9 Owner Rd" },
    data: { reservationLetter: { landlordEmail: "not-an-email" } } });
  assert.deepEqual([bare.issuerName, bare.issuerAddress, bare.issuerTaxId, bare.issuerPhone, bare.issuerEmail],
    ["Snapshot Owner", "9 Owner Rd", "", "0822222222", ""]);
  assert.equal(bare.paymentDetails, "KBank 111", "the room's bank account when the letter has none");
  // No landlord name at all (an old reservation without a letter): the old issuer, not an empty one.
  const nameless = reservationInvoice({ ...c, party_snapshot: { propertyAddress: "1 Aria Rd" }, data: {} });
  assert.deepEqual([nameless.issuerName, nameless.issuerAddress], ["NESTYK", "Bangkok"]);
  assert.doesNotThrow(() => validateFinancialDocument(nameless, "invoice"));
});

test("D11: receipt receiver, receiver line and withholding tax rules", () => {
  assert.equal(receiptReceiver(undefined), "landlord");
  assert.equal(receiptReceiver(""), "landlord");
  assert.equal(receiptReceiver("agent"), "agent");
  for (const bad of ["owner", 1, {}]) assert.throws(() => receiptReceiver(bad), /ผู้รับเงิน/);
  assert.equal(receiverLine("landlord", " Landlord A ", "Agent B"), "Landlord A");
  assert.equal(receiverLine("agent", "Landlord A", " Agent B "), "Agent B (ผู้รับมอบอำนาจ)");
  assert.equal(receiverLine("agent", "Landlord A", ""), "นายหน้า (ผู้รับมอบอำนาจ)");
  assert.equal(receiverLine("agent", "", "ก".repeat(200)).length, 120, "fits the receipt's 120 characters");
  assert.equal(withholdingTaxOf(undefined, 20000), 0);
  assert.equal(withholdingTaxOf(" ", 20000), 0);
  assert.equal(withholdingTaxOf("1,000", 20000), 1000);
  assert.equal(withholdingTaxOf(0.1, 20000), 0.1);
  assert.equal(withholdingTaxOf("19999.99", 20000), 19999.99);
  for (const bad of ["20000", "20000.01", "-5", "1e3", "1.001", "abc", [], true]) assert.throws(() => withholdingTaxOf(bad, 20000), /ภาษีหัก ณ ที่จ่าย/, String(bad));
});

/** The number of text-show operators in a PDF's (deflated) content streams. */
function textShows(bytes) {
  const raw = Buffer.from(bytes).toString("latin1");
  let count = 0;
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    try {
      count += (zlib.inflateSync(Buffer.from(raw.slice(start, end), "latin1")).toString("latin1").match(/Tj/g) || []).length;
    } catch {
      // not a deflated stream
    }
  }
  return count;
}
test("D11 (TC-3.15): the receipt rows for the tax: 20,000 with 1,000 withheld is 19,000 received", () => {
  assert.deepEqual(receiptTaxRows("receipt", { ...sample, withholdingTax: 1000 }),
    ["หักภาษี ณ ที่จ่าย 1,000.00 บาท", "รับเงินสุทธิ 19,000.00 บาท"]);
  // The net is taken from the receipt total (after discount and VAT): (20,000 - 100) x 1.07 = 21,293.00.
  assert.deepEqual(receiptTaxRows("receipt", { ...sample, vatRate: 7, discount: 100, withholdingTax: 995.5 }),
    ["หักภาษี ณ ที่จ่าย 995.50 บาท", "รับเงินสุทธิ 20,297.50 บาท"]);
  for (const data of [sample, { ...sample, withholdingTax: 0 }])
    assert.deepEqual(receiptTaxRows("receipt", data), []);
  assert.deepEqual(receiptTaxRows("invoice", { ...sample, withholdingTax: 1000 }), [], "an invoice has no tax rows");
});
test("D11 (TC-3.15): a receipt with withholding tax prints the tax and the net amount; an invoice and a receipt without tax do not", async () => {
  const plain = textShows(await createFinancialPdf("receipt", sample));
  const zero = textShows(await createFinancialPdf("receipt", { ...sample, withholdingTax: 0 }));
  const taxed = textShows(await createFinancialPdf("receipt", { ...sample, withholdingTax: 1000 }));
  assert.equal(zero, plain);
  assert.ok(taxed > plain + 20, `2 more lines of text (${plain} -> ${taxed})`);
  const invoice = textShows(await createFinancialPdf("invoice", sample));
  assert.equal(textShows(await createFinancialPdf("invoice", { ...sample, withholdingTax: 1000 })), invoice, "an invoice has no tax lines");
  // The tax lines take the first note rows, so a long note still fits the 6 rows.
  const longNote = { ...sample, notes: "หมายเหตุยาว ".repeat(60), withholdingTax: 1000 };
  assert.equal((await createFinancialPdf("receipt", longNote)).subarray(0, 4).toString(), "%PDF");
});
