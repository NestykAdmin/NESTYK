import type { SelfOwnerContract, SelfOwnerContractFilter } from '../../lib/self-owner-contracts';

export type SelfOwnerContractsPageProps = {
  contracts: SelfOwnerContract[];
  isDemoPreview: boolean;
  initialFilter?: SelfOwnerContractFilter;
  initialQuery?: string;
  /** The page shown first (tests); page 1 when left out. */
  initialPage?: number;
};
