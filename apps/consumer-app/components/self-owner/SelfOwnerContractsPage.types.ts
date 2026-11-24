import type { SelfOwnerContract, SelfOwnerContractFilter } from '../../lib/self-owner-contracts';

export type SelfOwnerContractsPageProps = {
  contracts: SelfOwnerContract[];
  isDemoPreview: boolean;
  initialFilter?: SelfOwnerContractFilter;
  initialQuery?: string;
};
