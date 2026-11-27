import { listMyContracts, openMyContractDocument, signMyContract } from './party-contracts-api';
import type { SelfOwnerContractsBackend } from './self-owner-contracts';

/**
 * The owner's side of the party contracts API (`GET /contracts/mine`, `POST /contracts/mine/:id/sign`, `.../document`,
 * role self_owner). The contract store connects to this once a self owner is signed in.
 */
export const selfOwnerContractsApi: SelfOwnerContractsBackend = {
  list: () => listMyContracts(),
  sign: (id, signaturePng) => signMyContract(id, 'owner', signaturePng),
  documentUrl: async (id) => (await openMyContractDocument(id)).url,
};
