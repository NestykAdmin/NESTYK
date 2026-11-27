import { Asset } from 'expo-asset';
import { selfOwnerContractStore } from '../../lib/self-owner-contracts';
import { selfOwnerDocumentOf } from './demo-documents';

/**
 * The URL of a contract's file for the Document viewer: the store's answer (the signed API link, or on the demo the
 * bundled sample, a module id on the phone that `expo-asset` turns into a URL). Called on every attempt, so a retry asks
 * for a fresh link.
 */
export async function selfOwnerDocumentLoader(contractId: string): Promise<string> {
  const source = await selfOwnerContractStore.documentUrl(contractId);
  return typeof source === 'string' ? source : Asset.fromModule(source).uri;
}

/** Whether the owner can open a file for this contract: the API makes one for every contract, the demo has four samples. */
export const selfOwnerHasDocument = (contractId: string, isDemoPreview: boolean): boolean => !isDemoPreview || selfOwnerDocumentOf(contractId) !== undefined;
