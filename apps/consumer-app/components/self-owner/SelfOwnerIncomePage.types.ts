import type { SelfOwnerContract, SelfOwnerMonth } from '../../lib/self-owner-contracts';

export type SelfOwnerIncomePageProps = {
  contracts: SelfOwnerContract[];
  /** Months that can be shown, oldest first (the last is this month). */
  months: SelfOwnerMonth[];
  isDemoPreview: boolean;
  /** The month shown first; this month when left out. */
  initialMonth?: SelfOwnerMonth;
  /** Today (tests); the clock when left out. */
  now?: Date;
  /** The page of rows shown first (tests); page 1 when left out. */
  initialPage?: number;
};
