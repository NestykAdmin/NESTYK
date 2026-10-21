import type { FinancialDocumentInput, LeaseAgreementInput } from "@nestyk/types";
import type { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { validateFinancialDocument } from "./financial-document";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAX_ID = /^\d{13}$/;

/** The contract number the app shows (AgentContract.contractNo), so the deposit card and the invoice agree. */
function contractNo(c: Pick<LeaseContractEntity, "id" | "contract_no">) {
  return c.contract_no || `EC-${c.id}`;
}
/**
 * D10: DEP-<contract no> and REC-DEP-<contract no>, the numbering Aof chose (tied to the contract number).
 * Contract numbers are at most 32 characters, so REC-DEP-<no> fits the 40 characters of receipt_document_no.
 */
export function depositInvoiceNo(c: Pick<LeaseContractEntity, "id" | "contract_no">) {
  return `DEP-${contractNo(c)}`;
}
export function depositReceiptNo(invoiceNo: string) {
  return `REC-${invoiceNo}`;
}

/** The deposit amount of a lease, or 0 when there is none (no invoice is issued for 0). */
export function leaseDepositAmount(c: Pick<LeaseContractEntity, "deposit">) {
  const amount = Number(c.deposit ?? 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

/**
 * D10 (AC-5.1 to 5.5): the deposit invoice of a generated lease. It is issued in the landlord's name
 * (the landlord receives the deposit), to the tenant, from the lease form the parties signed.
 * Due on the lease start date, or on the issue date when the lease has already started.
 */
export function depositInvoice(c: LeaseContractEntity, today: string): FinancialDocumentInput {
  const lease = (c.data?.leaseAgreement ?? {}) as Partial<LeaseAgreementInput>;
  const snapshot = c.party_snapshot ?? {};
  const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
  const pick = (...values: unknown[]) => values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
  const project = pick(lease.project, snapshot.property, c.rent_room?.property?.name, c.rent_room?.listing_title, "ห้องพัก");
  const room = pick(lease.houseNo, snapshot.room, c.rent_room?.room_id);
  const place = pick(lease.propertyAddress, snapshot.propertyAddress, project);
  const email = (value: unknown) => (EMAIL.test(text(value, 120)) ? text(value, 120) : "");
  const taxId = (value: unknown) => (TAX_ID.test(text(value, 13)) ? text(value, 13) : "");
  const start = String(c.start_date ?? "").slice(0, 10);
  const documentNo = depositInvoiceNo(c);
  return validateFinancialDocument(
    {
      documentNo,
      issueDate: today,
      dueDate: start && start > today ? start : today,
      reference: text(contractNo(c), 60),
      customerName: text(pick(lease.tenantName, snapshot.tenantName, c.tenant?.name), 120),
      customerFirstName: text(pick(lease.tenantFirstName, c.tenant?.first_name), 120),
      customerLastName: text(pick(lease.tenantLastName, c.tenant?.last_name), 120),
      customerAddress: text(pick(lease.tenantAddress, snapshot.tenantAddress, place), 240),
      customerTaxId: "",
      customerPhone: text(pick(lease.tenantPhone, snapshot.tenantPhone, c.tenant?.phone), 40),
      customerEmail: email(pick(lease.tenantEmail, snapshot.tenantEmail, c.tenant?.email)),
      issuerName: text(pick(lease.landlordName, snapshot.ownerName), 120),
      issuerAddress: text(pick(lease.landlordAddress, snapshot.ownerAddress, place), 240),
      issuerTaxId: taxId(snapshot.ownerTaxId),
      issuerPhone: text(pick(lease.landlordPhone, snapshot.ownerPhone), 40),
      issuerEmail: email(lease.landlordEmail),
      items: [
        {
          description: text(`เงินประกันการเช่า ${project}${room ? ` ห้อง ${room}` : ""}`, 160),
          quantity: 1,
          unitPrice: leaseDepositAmount(c),
        },
      ],
      vatRate: 0,
      discount: 0,
      paymentMethod: "",
      paymentDetails: text(
        pick(
          [lease.bankName, lease.accountName, lease.accountNo].map((part) => String(part ?? "").trim()).filter(Boolean).join(" "),
          [c.rent_room?.owner_bank_name, c.rent_room?.owner_bank_account].filter(Boolean).join(" "),
        ),
        200,
      ),
      receiverName: "",
      notes: "",
    },
    "invoice",
  );
}
