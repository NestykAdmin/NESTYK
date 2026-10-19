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

export type AgentAppointmentKind = 'viewing' | 'follow_up' | 'custom';

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
      startsAt?: string;
      roomId?: number;
      leadId?: number;
      tenantId?: number;
      contractId?: number;
      section?: 'contracts' | 'bills' | 'payments';
    };

export type AgentDashboardAppointment = {
  id: string;
  startsAt: string; // ISO
  title: string;
  contactName: string;
  kind: AgentAppointmentKind;
  status: 'confirmed' | 'pending' | 'scheduled' | 'done';
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
    commissionPending: number | null;
    currency: string;
  };
  actionRequired: {
    status: DashboardSectionStatus;
    items: Array<{
      id: string;
      kind: AgentWorkItemKind;
      count: number | null;
      status?: DashboardSectionStatus;
      /** Optional amount for overdue etc. */
      amount?: number;
      deepLink: AgentDashboardDeepLink;
    }>;
  };
  /** All of today's non-cancelled appointments in Asia/Bangkok, including past times. */
  schedule: {
    status: DashboardSectionStatus;
    total?: number;
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
      beds: number | null;
      area: string;
      price: number | null;
      availability: 'available' | 'unavailable';
      visibility: 'published' | 'private' | null;
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
    pending?: number;
    unpaid?: number;
    received: number;
    overdue: number;
    currency: string;
  };
  commission: {
    status: DashboardSectionStatus;
    periodYear: number;
    periodMonth: number;
    total: number | null;
    received: number | null;
    pending: number | null;
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

export type AgentDashboardData = Omit<AgentDashboardSnapshot, 'isDemoPreview' | 'greetingName' | 'localDateLabel'> & {
  computedAt: string;
  today: string;
  timezone: 'Asia/Bangkok';
  period: string;
};
export type DashboardWorkKind = 'overdue_payment' | 'awaiting_signature' | 'renewal' | 'rent';
export type DashboardWorkItem = {
  id: string;
  kind: DashboardWorkKind;
  tenantId: number;
  contractId: number;
  billId: number | null;
  person: string;
  property: string;
  room: string | null;
  documentNo: string;
  date: string;
  amount: number | null;
  status: string;
  awaitingReview: boolean;
};
export type DashboardWorkPage = { items: DashboardWorkItem[]; total: number; page: number; limit: number };
