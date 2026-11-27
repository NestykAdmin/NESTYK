/**
 * Sample contract files of the demo contracts (Jom 25 Nov 2026, option B): the API's own forms filled with the demo
 * data and watermarked "ตัวอย่าง", built by scripts/build-self-owner-demo-pdfs.cjs. Once NESTYK admin makes the
 * contracts, the file comes from the API instead.
 */
const SELF_OWNER_DEMO_DOCUMENTS: Record<string, number | string> = {
  'c-r5': require('../../assets/self-owner-demo/lease-2101.pdf'),
  'c-r2-renewal': require('../../assets/self-owner-demo/renewal-805.pdf'),
  'c-r1-broker': require('../../assets/self-owner-demo/broker-1204.pdf'),
  'c-r5-reservation': require('../../assets/self-owner-demo/reservation-2101.pdf'),
};

/** The file of a contract (a bundled asset), or undefined when it has none yet. */
export function selfOwnerDocumentOf(contractId: string): number | string | undefined {
  return SELF_OWNER_DEMO_DOCUMENTS[contractId];
}
