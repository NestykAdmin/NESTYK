import type { SelfOwnerContract, SelfOwnerContractFilter } from '../../lib/self-owner-contracts';

export type SelfOwnerContractsPageProps = {
  contracts: SelfOwnerContract[];
  isDemoPreview: boolean;
  initialFilter?: SelfOwnerContractFilter;
  initialQuery?: string;
  /** The page shown first (tests); page 1 when left out. */
  initialPage?: number;
  /** Load state (Jom 25 Nov 2026): loading → skeleton, error → message + retry; demo and ready show the rows. */
  status?: 'demo' | 'ready' | 'loading' | 'error';
  onRetry?: () => void;
  /** The owner's signatures of this session shown first (tests): contract id → day signed (Jom 25 Nov 2026, demo). */
  initialSignedOn?: Record<string, string>;
};
