import type {
  FinancialDocumentInput,
  ReservationLetterInput,
} from "@nestyk/types";
import type { LeaseContractEntity } from "../../entities/lease-contract.entity";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAX_ID = /^\d{13}$/;

/**
 * One booking invoice belongs to the reservation, independently of standalone invoices.
 * D11 (AC-3.3): issued in the landlord's name (the landlord receives the booking money), like the deposit invoice.
 */
export function reservationInvoice(
  c: LeaseContractEntity,
): FinancialDocumentInput {
  const letter = c.data?.reservationLetter as
    Partial<ReservationLetterInput> | undefined;
  const snapshot = c.party_snapshot ?? {};
  const previous = (
    c.data?.financialDocuments as
      { invoice?: FinancialDocumentInput } | undefined
  )?.invoice;
  const text = (value: unknown, max: number) =>
    String(value ?? "")
      .trim()
      .slice(0, max);
  const project =
    letter?.project ||
    snapshot.property ||
    c.rent_room?.property?.name ||
    c.rent_room?.listing_title ||
    "ห้องพัก";
  const room = letter?.unitNo || snapshot.room || c.rent_room?.room_id;
  // A reservation without the landlord's name (an old one with no letter) keeps the old issuer instead of an empty one.
  const landlord = text(letter?.landlordName || snapshot.ownerName, 120);
  return {
    documentNo: previous?.documentNo || `INV-${c.contract_no || `RS${c.id}`}`,
    issueDate: previous?.issueDate || c.start_date,
    dueDate: previous?.dueDate || c.start_date,
    reference: c.contract_no || `RS${c.id}`,
    customerName: text(
      letter?.tenantName || snapshot.tenantName || c.tenant?.name,
      120,
    ),
    customerFirstName: text(
      letter?.tenantFirstName || c.tenant?.first_name,
      120,
    ),
    customerLastName: text(letter?.tenantLastName || c.tenant?.last_name, 120),
    customerAddress: text(
      snapshot.tenantAddress ||
        letter?.address ||
        snapshot.propertyAddress ||
        project,
      240,
    ),
    customerTaxId: "",
    customerPhone: text(
      letter?.tenantPhone || snapshot.tenantPhone || c.tenant?.phone,
      40,
    ),
    customerEmail: text(
      letter?.tenantEmail || snapshot.tenantEmail || c.tenant?.email,
      120,
    ),
    issuerName: landlord || "NESTYK",
    issuerAddress: landlord
      ? text(snapshot.ownerAddress || snapshot.propertyAddress || letter?.address || project, 240)
      : "Bangkok",
    issuerTaxId: TAX_ID.test(text(snapshot.ownerTaxId, 13)) ? text(snapshot.ownerTaxId, 13) : "",
    issuerPhone: text(letter?.landlordPhone || snapshot.ownerPhone, 40),
    issuerEmail: EMAIL.test(text(letter?.landlordEmail, 120)) ? text(letter?.landlordEmail, 120) : "",
    items: [
      {
        description: text(
          `ค่าจอง ${project}${room ? ` ห้อง ${room}` : ""}`,
          160,
        ),
        quantity: 1,
        unitPrice: Number(c.reservation_fee ?? 0),
      },
    ],
    vatRate: 0,
    discount: 0,
    paymentMethod: "",
    paymentDetails: text(
      letter?.bankAccount ||
        [c.rent_room?.owner_bank_name, c.rent_room?.owner_bank_account]
          .filter(Boolean)
          .join(" "),
      200,
    ),
    receiverName: "",
    notes: "",
  };
}
