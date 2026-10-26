/** Tab keys used for dashboard deep links — keep aligned with MobileAppTab agent targets. */
export type AgentDashboardTab =
  | 'dashboard'
  | 'listingRoom'
  | 'createListing'
  | 'listingLead'
  | 'clients'
  | 'more'
  | 'contact'
  | 'contracts'
  | 'calendar'
  | 'services';

export type DashboardSectionStatus = 'available' | 'loading' | 'error' | 'not_configured' | 'demo';

export type AgentWorkItemKind = 'overdue_payment' | 'lead_follow_up' | 'awaiting_signature' | 'renewal';

export type AgentAppointmentKind = 'viewing' | 'follow_up';

export type AgentDashboardFilter =
  | { kind: 'work'; work: AgentWorkItemKind }
  | { kind: 'lead_create' };

export type AgentDashboardDeepLink =
  | { type: 'tab'; tab: AgentDashboardTab; filter?: AgentDashboardFilter }
  | {
      type: 'action';
      id:
        | 'addListing'
        | 'newLead'
        | 'viewListing'
        | 'viewLead'
        | 'viewClient'
        | 'viewCalendar'
        | 'viewCommission'
        | 'viewPayments'
        | 'viewServices'
        | 'viewContacts'
        | 'viewContracts'
        | 'viewAppointment';
      appointmentId?: string;
    };

export type AgentDashboardAppointment = {
  id: string;
  startsAt: string; // ISO
  title: string;
  contactName: string;
  kind: AgentAppointmentKind;
  status: 'confirmed' | 'pending';
};

export type AgentDashboardSnapshot = {
  /** When true, non-live sections use deterministic demo fixture (preview only). */
  isDemoPreview: boolean;
  greetingName: string;
  localDateLabel: string;
  business: {
    status: DashboardSectionStatus;
    availableListings: number;
    totalListings: number;
    openLeads: number;
    currentClients: number;
    tenantsCount: number;
    commissionPending: number;
    currency: string;
  };
  actionRequired: {
    status: DashboardSectionStatus;
    items: Array<{
      id: string;
      kind: AgentWorkItemKind;
      count: number;
      /** Optional amount for overdue etc. */
      amount?: number;
      deepLink: AgentDashboardDeepLink;
    }>;
  };
  /** Today's appointments; first future item is highlighted as "up next". */
  schedule: {
    status: DashboardSectionStatus;
    items: AgentDashboardAppointment[];
  };
  inventory: {
    status: DashboardSectionStatus;
    available: number;
    unavailable: number;
    published: number;
    private: number;
    preview: Array<{
      id: number | string;
      title: string;
      beds: number;
      area: string;
      price: number;
      availability: 'available' | 'unavailable';
      visibility: 'published' | 'private';
    }>;
  };
  clients: {
    status: DashboardSectionStatus;
    draft: number;
    signing: number;
    tenants: number;
    renewal: {
      id: string;
      title: string;
      endsAt: string; // ISO date
      daysLeft: number;
    } | null;
  };
  rent: {
    status: DashboardSectionStatus;
    periodYear: number;
    periodMonth: number; // 1-12
    totalDue: number;
    received: number;
    overdue: number;
    currency: string;
  };
  commission: {
    status: DashboardSectionStatus;
    periodYear: number;
    periodMonth: number;
    total: number;
    received: number;
    pending: number;
    currency: string;
  };
  activity: {
    status: DashboardSectionStatus;
    items: Array<{
      id: string;
      kind: 'lead_added' | 'contract_sent' | 'payment_recorded';
      subject: string;
      at: string; // ISO
      deepLink: AgentDashboardDeepLink;
    }>;
  };
};

/** Agent-scoped API data; presentation adds the localized greeting and date. */
export type AgentDashboardData = Omit<AgentDashboardSnapshot, 'isDemoPreview' | 'greetingName' | 'localDateLabel'> & { generatedAt: string };
