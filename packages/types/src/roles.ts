/**
 * Account roles (master_roles.name). 'owner' is retired for good: it became 'landlord'
 * (docs/ROLE-CHANGE-PLAN.md). Do not add it back; the API refuses to start if the database has it.
 */
/**
 * 'self_owner' (round 2, Mos 18 Nov 2026): an owner who lists rooms without an agent. Sample menus only for now:
 * no API route grants it anything yet (docs/ROLE-CHANGE-PLAN.md 5.1).
 */
export type UserRole = 'guest' | 'tenant' | 'landlord' | 'agent' | 'admin' | 'self_owner';

/**
 * Side of a contract, stored in agreement_sign_invites.party / agreement_documents.subject and owner_* columns.
 * 'owner' here means the landlord side of the contract. It is NOT an account role; never mix it with UserRole.
 */
export type ContractParty = 'owner' | 'tenant';

/** Account role whose colours and labels a contract party uses in the app. */
export const CONTRACT_PARTY_ROLE: Record<ContractParty, UserRole> = { owner: 'landlord', tenant: 'tenant' };

export interface UserProfile {
  id: string;
  supabaseUserId: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  roles: UserRole[];
  activeRole: UserRole;
  createdAt: string;
  updatedAt: string;
}
