import type { SelfOwnerContract, SelfOwnerMonth, SelfOwnerRent, SelfOwnerRentFilter } from '../../lib/self-owner-contracts';

export type SelfOwnerIncomePageProps = {
  contracts: SelfOwnerContract[];
  /** Rows of a month (real bills when signed in); the demo rows from `contracts` when left out. */
  rowsFor?: (year: number, month: number) => SelfOwnerRent[];
  /** Months that can be shown, oldest first (the last is this month). */
  months: SelfOwnerMonth[];
  isDemoPreview: boolean;
  /** The month shown first; this month when left out. */
  initialMonth?: SelfOwnerMonth;
  /** Today (tests); the clock when left out. */
  now?: Date;
  /** The status filter shown first (tests); all when left out. */
  initialFilter?: SelfOwnerRentFilter;
  /** The page of rows shown first (tests); page 1 when left out. */
  initialPage?: number;
  /** Load state (Jom 25 Nov 2026): loading → skeleton, error → message + retry; demo and ready show the rows. */
  status?: 'demo' | 'ready' | 'loading' | 'error';
  onRetry?: () => void;
};
