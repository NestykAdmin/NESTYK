/**
 * W17 (Mos 6 Nov 2026): what the agent web add/edit lead panel shows. Same rules as `CreateLeadForm`:
 * saving needs a first name and phone; room matching needs a max budget above 0 and at least one pin
 * (`matchingReady` in the form, `leadMatchReady` in lead-match-preview). There is no province field.
 */
export type LeadFormTabKey = 'profile' | 'matching';
export type LeadFormDraft = {
  firstName: string;
  phoneDigits: string;
  budgetMax: string;
  pinCount: number;
  tab: LeadFormTabKey;
};
export type ReadinessKey = 'firstName' | 'phone' | 'budgetMax' | 'pins';
export type ReadinessItem = { key: ReadinessKey; tab: LeadFormTabKey; done: boolean };

export function leadFormReadiness(draft: LeadFormDraft): { canSave: boolean; matchReady: boolean; items: ReadinessItem[] } {
  const raw = draft.budgetMax.trim();
  const budget = Number(raw);
  const hasName = draft.firstName.trim() !== '';
  const hasPhone = draft.phoneDigits !== '';
  const hasBudget = raw !== '' && Number.isFinite(budget) && budget > 0;
  const hasPins = draft.pinCount > 0;
  return {
    canSave: hasName && hasPhone,
    matchReady: hasBudget && hasPins,
    items: [
      { key: 'firstName', tab: 'profile', done: hasName },
      { key: 'phone', tab: 'profile', done: hasPhone },
      { key: 'budgetMax', tab: 'matching', done: hasBudget },
      { key: 'pins', tab: 'matching', done: hasPins },
    ],
  };
}
