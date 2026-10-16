import { UserRole } from '@nestyk/types';

export type ListingDocType = 'title_deed' | 'power_of_attorney' | 'id_card';
export type AiPersonaType = 'direct_owner' | 'broker_pro';

export interface ListingEngineConfig {
  /** Colour/role of the person listing. Owner listing has no role until self_owner exists (docs/ROLE-CHANGE-PLAN.md). */
  actorRole: Extract<UserRole, 'landlord' | 'agent'>;
  themeTone: 'owner' | 'agent';
  features: {
    enableCommission: boolean;
    docType: ListingDocType;
    aiPersona: AiPersonaType;
    allowCoBroke: boolean;
  };
}

export const defaultOwnerListingConfig: ListingEngineConfig = {
  actorRole: 'landlord',
  themeTone: 'owner',
  features: {
    enableCommission: false,
    docType: 'title_deed',
    aiPersona: 'direct_owner',
    allowCoBroke: true,
  },
};

export const defaultAgentListingConfig: ListingEngineConfig = {
  actorRole: 'agent',
  themeTone: 'agent',
  features: {
    enableCommission: true,
    docType: 'power_of_attorney',
    aiPersona: 'broker_pro',
    allowCoBroke: true,
  },
};
