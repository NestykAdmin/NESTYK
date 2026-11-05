/**
 * Delete account at launch (Mos 4 Nov 2026, L5): hidden unless the build sets
 * EXPO_PUBLIC_ENABLE_ACCOUNT_DELETION=true (QA builds). Expo inlines EXPO_PUBLIC_* at build time, so the env is read
 * with its literal name below. Pure helpers for tests.
 */
export function accountDeletionFlag(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'true';
}

export const ACCOUNT_DELETION_ENABLED = accountDeletionFlag(process.env.EXPO_PUBLIC_ENABLE_ACCOUNT_DELETION);

/**
 * Whether the account menu offers delete account. A deletion already scheduled (e.g. by QA before the flag was turned
 * off) keeps the menu, so the owner can still cancel it from there.
 */
export function showAccountDeletion(signedIn: boolean, enabled: boolean, scheduledFor: string | null | undefined): boolean {
  return signedIn && (enabled || !!scheduledFor);
}
