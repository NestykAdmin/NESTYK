import type { AgreementSignatureLogEntry, AgreementSignatureParty } from "@nestyk/types";
import { fillTemplate } from "@nestyk/i18n";

export type SignatureLogCopy = {
  signedVia: { app: string; link: string; on_site: string; uploaded_file: string };
  signedBy: string;
};

/**
 * D17: the line under a signed party saying how it was signed ("ลงผ่านลิงก์", "นายหน้ากดลงนามแทน โดย ...").
 * Signatures copied from the old columns (legacy) have no known channel, so they get no line.
 */
export function signatureChannelText(
  log: AgreementSignatureLogEntry[] | null,
  party: AgreementSignatureParty,
  copy: SignatureLogCopy,
): string {
  const entry = log?.find((row) => row.party === party);
  if (!entry || entry.channel === "legacy") return "";
  const via = copy.signedVia[entry.channel];
  return entry.signedBy ? `${via} ${fillTemplate(copy.signedBy, { name: entry.signedBy })}` : via;
}
