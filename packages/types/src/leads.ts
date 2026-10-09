/** Max ranked search pins per lead. */
export const LEAD_MAX_PINS = 3;

/** One ranked search pin — rank 1 is the lead's top-priority area. */
export type LeadPin = {
  rank: number;
  placeId: string | null;
  name: string;
  latitude: number;
  longitude: number;
  province: string;
  district: string | null;
};

/** Pin as sent by the client; rank follows array order. */
export type LeadPinInput = Omit<LeadPin, 'rank'> & { rank?: number };

export const LEAD_CONTACT_CHANNELS = ['line', 'whatsapp', 'wechat', 'facebook', 'telegram', 'other'] as const;
export type LeadContactChannel = (typeof LEAD_CONTACT_CHANNELS)[number];
/** Max extra contact channels per lead (phone and email excluded). */
export const LEAD_MAX_CONTACTS = 5;
export type LeadContact = { channel: LeadContactChannel; value: string };

export type CreateLeadInput = {
  /** Ordered by priority (index 0 = rank 1), up to {@link LEAD_MAX_PINS}. */
  pins?: LeadPinInput[];
  /** Search radius shared by every pin (1, 3 or 5 km). */
  radiusKm?: number | null;
  /** Derived from pin rank 1 when pins exist; legacy value otherwise. */
  province?: string | null;
  /** Derived from pin districts when pins exist; legacy value otherwise. */
  locations?: string[];
  /** Display name; the API rebuilds it from firstName + lastName, or splits it when they are omitted. */
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string | null;
  /** Ordered list, up to {@link LEAD_MAX_CONTACTS}; no duplicate channel + value pairs. */
  otherContacts?: LeadContact[];
  nationality?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredLocation?: string | null;
  moveInPlan?: string | null;
  hasPets?: boolean | null;
  occupation?: string | null;
  visaTypeId?: number | null;
  leaseDurationMonths?: number | null;
  usesCar?: boolean | null;
  occupantCount?: number | null;
  isSmoker?: boolean | null;
  desiredRoomTypeId?: number | null;
  /** Free-text care notes, up to 500 characters. */
  notes?: string | null;
};
export type LeadStatus = 'new' | 'inprogress' | 'lost' | 'booked';

export type AgentLeadsSort =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'name_asc'
  | 'budget_asc'
  | 'budget_desc'
  | 'status_asc'
  | 'status_desc';

export type AgentLead = Required<Omit<CreateLeadInput, 'budgetMin' | 'budgetMax' | 'province' | 'pins'>> & {
  province: string | null;
  pins: LeadPin[];
  id: number; budgetMin: number | null; budgetMax: number | null;
  desiredRoomTypeCode: string | null; visaTypeCode: string | null;
  status: LeadStatus; lostReason: string | null; createdAt: string;
  /** Latest manual room-matching run; only on list responses, null when never matched. */
  lastMatch?: LeadMatchSummary | null;
  /** Earliest upcoming scheduled viewing (ISO); drives the derived "viewing booked" status. */
  nextViewingAt?: string | null;
  /** Room of that viewing, "title · room number". */
  nextViewingRoom?: string | null;
  /** Set once the lead is booked: the tenant created from it. */
  tenantId?: number | null;
  /** Set once the lead is booked: the room it took. */
  rentRoomId?: number | null;
};

/** Per-lead room-matching preferences (docs/new-project/agent/leads/match-settings.md). */
export type LeadMatchSettings = {
  /** Rooms scoring below this (0–100) are left out. */
  minScore: number;
  /** Rooms scoring above this are left out; 100 keeps every room from `minScore` up. */
  maxScore: number;
  /** Most rooms kept per run. */
  maxResults: number;
};
/** Allowed `minScore` / `maxScore`: whole numbers from `min` to `max` in `step`s, at least `gap` apart. */
export const LEAD_MATCH_MIN_SCORE = { min: 0, max: 100, step: 5, gap: 5 } as const;
export const LEAD_MATCH_MAX_RESULTS_OPTIONS = [10, 20, 50, 100] as const;

export type LeadMatchSettingsResponse = {
  saved: Partial<LeadMatchSettings> | null;
  effective: LeadMatchSettings;
  defaults: LeadMatchSettings;
};

export type LeadMatchSummary = {
  runId: number;
  resultCount: number;
  topScore: number | null;
  createdAt: string;
  /** The lead's matching fields or settings changed since this run. */
  stale: boolean;
};

export type LeadMatchRun = LeadMatchSummary & {
  settings: LeadMatchSettings;
  /** Rooms that passed budget + distance before the score threshold and result cap. */
  candidateCount: number;
};
/** Status as shown on a lead row: an open lead with an upcoming viewing reads as `viewing`. */
export type LeadDisplayStatus = LeadStatus | 'viewing';

export type AgentLeadsPage = {
  items: AgentLead[];
  total: number;
  page: number;
  limit: number;
  /** Leads per display status under the same search and area filters, ignoring the status filter. */
  statusCounts: Record<LeadDisplayStatus, number>;
};

/** Room viewing booked for a lead (docs/new-project/agent/leads/viewings.md). */
export type LeadViewingStatus = 'scheduled' | 'done' | 'cancelled';
export type LeadViewing = {
  id: number;
  leadId: number;
  leadName: string;
  rentRoomId: number;
  /** Project name, else the listing title, else `#id`. */
  roomTitle: string;
  roomNumber: string | null;
  scheduledAt: string;
  status: LeadViewingStatus;
  note: string | null;
  createdAt: string;
};
export type CreateLeadViewingInput = { rentRoomId: number; scheduledAt: string; note?: string | null };
export type UpdateLeadViewingInput = { scheduledAt?: string; status?: LeadViewingStatus; note?: string | null };

export type LeadLocationCatalog = { name: string; nameEn: string; locations: string[] }[];
export type LeadFilters = {
  province?: string;
  locations?: string[];
  includeUnspecified?: boolean;
  sort?: AgentLeadsSort;
  status?: LeadDisplayStatus;
};
