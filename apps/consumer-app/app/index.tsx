import { AgentCalendarScreen } from '../components/AgentCalendarScreen';
import { AgentCalendarPage } from '../components/agent-web/AgentCalendarPage';
import type { AgentCalendarPageProps } from '../components/agent-web/AgentCalendarPage.types';
import { AgentLeadFormPage } from '../components/agent-web/AgentLeadFormPage';
import type { LeadFormBind } from '../components/agent-web/AgentLeadFormPage.types';
import { calendarDateKey } from '../lib/agent-calendar-demo';
import { useAgentCalendarViewings } from '../lib/agent-calendar-viewings';
import { getAgentLead } from '../lib/agent-leads-api';
import { useLeadRoomViewing } from '../lib/use-lead-room-viewing';
import {
  AgentTenantsScreen,
  TENANT_DETAIL_CLOSED,
  TenantEditBar,
  type TenantDetailActions,
  type TenantDetailState,
  type TenantEntry,
  type TenantListView,
} from '../components/AgentTenantsScreen';
import { PartyContractsScreen, type PartyContractRoom } from '../components/PartyContractsScreen';
import { TenantBillsScreen } from '../components/TenantBillsScreen';
import { tenantWorkspaceCopy } from '../lib/tenant-workspace-copy';
import { TenantNextBillCard } from '../components/TenantNextBillCard';
import { OwnerConfirmedRent } from '../components/OwnerConfirmedRent';
import { AgentLeadsScreen } from '../components/AgentLeadsScreen';
import { AgentWorkspace, AgentWorkspacePage } from '../components/agent-web/AgentWorkspace';
import { GuestPublicFooter } from '../components/legal/GuestPublicFooter';
import {
  LANDLORD_WEB_MENU,
  landlordWebActiveId,
  landlordWebLabel,
  type LandlordWebItem,
} from '../components/landlord-web/navigation';
import {
  TENANT_WEB_MENU,
  tenantWebActiveId,
  tenantWebLabel,
  type TenantWebItem,
} from '../components/tenant-web/navigation';
import { AgentSectionHeader } from '../components/agent-web/AgentSectionHeader';
import { AgentOverview } from '../components/agent-web/AgentOverview';
import { AgentRoomsPage } from '../components/agent-web/AgentRoomsPage';
import { AgentLeadsPage } from '../components/agent-web/AgentLeadsPage';
import { useAgentDashboard } from '../lib/agent-dashboard';
import { AgentRoomsScreen } from '../components/AgentRoomsScreen';
import { CreateLeadForm, type LeadFormTab } from '../components/CreateLeadForm';
import { AgentLeadDetailBody } from '../components/AgentLeadDetailBody';
import { LeadFullInfoBody } from '../components/LeadFullInfoBody';
import { LeadMatchedRoomBody } from '../components/LeadMatchedRoomBody';
import { LeadRoomActions } from '../components/LeadRoomActions';
import { LeadRoomViewingBanner } from '../components/LeadRoomViewingBanner';
import { AgentMoreToolsBody } from '../components/AgentMoreToolsBody';
import { AgentRoomDetailModal, type RoomSharePreview } from '../components/AgentRoomDetailModal';
import type { LeadRoomMatch } from '../lib/lead-match-preview';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Alert, BackHandler, Platform, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useLocale } from '@nestyk/i18n';
import {
  MobileModePage,
  AccountDeletionNotice,
  MobileBrandLoader,
  MobileButton,
  MobileBadge,
  MobileInput,
  MobileBottomTabBar,
  MobileHeaderActions,
  MobileWorkspaceHeader,
  MobileSectionHeader,
  MobileProfileDrawer,
  MobileNotificationsPanel,
  MobileNotificationsBody,
  MobileAppTab,
  MobileIcon,
  useMobileTheme,
  getDefaultTabForRole,
  isAgentComingSoonTab,
  tokens,
} from '@nestyk/ui/native';
import { UserRole, CONTRACT_PARTY_ROLE, type AgentLead, type AgentTenant, type ContractParty, type PartyContract } from '@nestyk/types';
import {
  MobileCreateListingWizardBody,
  MobileAgentDashboardBody,
  defaultAgentListingConfig,
  type AgentDashboardDeepLink,
} from '@nestyk/feature-listing';
import { MobileServiceCatalogBody } from '@nestyk/feature-services';
import { createAgentScoutRoom, fetchAgentContacts, fetchAgentPropertyTypes, fetchAgentContractTypes, fetchAgentRoomTypes, fetchAgentFacilities, generateListingPromo } from '../lib/agent-listings-api';
import { clearProfileAvatar, updateMyProfile, uploadProfileAvatar } from '../lib/profile-api';
import { changePassword as changeAccountPassword, confirmCurrentPassword } from '../lib/auth/change-password';
import { hcaptchaSiteKey } from '../lib/auth/hcaptcha-site-key';
import { HcaptchaField } from '../components/HcaptchaField';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/auth/supabase';
import { pickRoomPhotos, uploadRoomPhoto, enhanceRoomPhoto } from '../lib/room-photos';
import { searchPlaces, getPlaceDetails, searchNearbyPlaces, reverseMapLocation } from '../lib/places-api';
import { useAuth } from '../lib/auth/AuthContext';
import { APP_CONFIG } from '../lib/config';
import {
  consumeGuestBrowse,
  consumePendingRole,
  consumeSignOutLanding,
  roleRequiresAuth,
  setPendingRole,
} from '../lib/auth/role-gate';
import { ACCOUNT_DELETION_ENABLED, showAccountDeletion } from '../lib/account-deletion-flag';
import { type AppRouteState, canOpenRole, roleHomePath, stateToRoute } from '../lib/app-routes';
import {
  afterSignOutHref,
  landingRoleFor,
  loginHref,
  openRoleElsewhere,
  otherSiteRoles,
  portalSwitcherRoles,
  roleRedirect,
  useAppRouteSync,
  useInitialRouteState,
} from '../lib/web-routes';
import {
  MOCK_LISTINGS,
  MOCK_SERVICE_TICKETS,
  type DemoNotification,
} from '../lib/mock-data';
import { localeTag } from '../lib/lead-format';

/** Empty feed until notifications are connected to the API (the bell panel shows "coming soon"). */
const NO_NOTIFICATIONS: DemoNotification[] = [];

function getScreenTitle(tab: MobileAppTab, t: ReturnType<typeof useLocale>['t']): string {
  switch (tab) {
    case 'home':
      return t.mobile.screens.home;
    case 'search':
      return t.mobile.screens.discover;
    case 'living':
      return t.mobile.screens.living;
    case 'bills':
      return t.mobile.screens.bills;
    case 'dashboard':
      return t.mobile.screens.dashboard;
    case 'listings':
      return t.mobile.screens.listings;
    case 'listingRoom':
      return t.mobile.screens.listingRoom;
    case 'createListing':
      return t.mobile.screens.createListing;
    case 'listingLead':
      return t.agent.leads.title;
    case 'createLead':
      return t.agent.leads.create;
    case 'leadDetail':
      return t.mobile.tabs.leadDetail;
    case 'leadInfo':
      return t.mobile.tabs.leadInfo;
    case 'leadRoom':
      return t.mobile.tabs.leadRoom;
    case 'clients':
      return t.mobile.screens.clients;
    case 'more':
      return t.mobile.screens.more;
    case 'contact':
      return t.mobile.screens.contact;
    case 'contracts':
      return t.mobile.screens.contracts;
    case 'calendar':
      return t.mobile.screens.calendar;
    case 'income':
      return t.mobile.screens.income;
    case 'deals':
      return t.mobile.screens.deals;
    case 'tickets':
      return t.mobile.screens.tickets;
    case 'services':
      return t.mobile.screens.services;
    default:
      return t.mobile.screens.home;
  }
}

/**
 * The app shell for every role. Mobile: this is the "/" route. Web: the root layout keeps it mounted for every app
 * path (route plan R1, rule 21) and the "/" route renders nothing (see IndexRoute below).
 */
/**
 * Where "Sign out" lands. Web: a deploy setting (Mos 9 Nov 2026) — EXPO_PUBLIC_WEB_SIGN_OUT_TO = guest | login,
 * unset = the guest home "/" on portal "all" and the sign-in page on a role portal (lib/route-access.ts).
 * Mobile (frozen): the sign-in screen as before. A session that ran out still goes to /login with its notice.
 */
const AFTER_SIGN_OUT_PATH = afterSignOutHref();
/**
 * Web width where the desktop shell (sidebar + top bar) starts. Narrower web — a phone browser — shows the mobile
 * app's own screens and bottom tabs (Mos 4 Nov 2026). Mobile apps never read this.
 */
const WEB_SHELL_MIN_WIDTH = 768;

export function AppHomeScreen() {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const { ready, isAuthenticated, session, displayName, initials, signOut, signOutEverywhere, refreshProfile } = useAuth();
  // Web: the URL picks the page ("/" guest, "/agent/rooms", ...; route plan R1–R2). Mobile: null, so
  // EXPO_PUBLIC_DEFAULT_ROLE and the role's first tab as before.
  const initialRoute = useInitialRouteState();
  const initialRole = initialRoute?.role ?? APP_CONFIG.defaultRole;
  const [activeRole, setActiveRole] = useState<UserRole>(initialRole);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(
    () => initialRoute?.calendarDate ?? calendarDateKey(new Date()),
  );
  const [calendarMonth, setCalendarMonth] = useState(
    () => (initialRoute?.calendarDate ?? calendarDateKey(new Date())).slice(0, 7) + '-01',
  );
  const [calendarReloadToken, setCalendarReloadToken] = useState(0);
  const [activeTab, setActiveTab] = useState<MobileAppTab>(() => initialRoute?.tab ?? getDefaultTabForRole(initialRole));
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [passwordCaptchaToken, setPasswordCaptchaToken] = useState<string | null>(null);
  const [passwordCaptchaKey, setPasswordCaptchaKey] = useState(0);
  const passwordCaptchaRequired = hcaptchaSiteKey().length > 0;
  const [partyInbox, setPartyInbox] = useState(() => !!initialRoute?.partyInbox);
  const [selectedPartyRoom, setSelectedPartyRoom] = useState<PartyContractRoom | null>(null);
  const [contractHistory, setContractHistory] = useState(() => initialRoute?.partyInbox === 'tenants');
  const [billHistory, setBillHistory] = useState(() => !!initialRoute?.billHistory);
  const [selectedBillRoom, setSelectedBillRoom] = useState<{ property: string; room: string | null } | null>(null);
  const [openedPartyContract, setOpenedPartyContract] = useState<PartyContract | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [notifications, messages] = useMemo(() => {
    const time = new Intl.DateTimeFormat(localeTag(locale), {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const show = (items: DemoNotification[]) =>
      items.map(({ text, at, unread, ...item }) => ({
        ...item,
        text: t.mobile.notifications.demo[text],
        time: time.format(new Date(at)),
        unread: unread && !notificationsRead,
      }));
    // Notifications are not connected to the API yet: show none instead of the demo feed ("coming soon", meeting 2 Nov 2026).
    return [show(NO_NOTIFICATIONS), show(NO_NOTIFICATIONS)];
  }, [t, locale, notificationsRead]);
  const [createLeadBusy, setCreateLeadBusy] = useState(false);
  const [leadsWorkFilter, setLeadsWorkFilter] = useState<'lead_follow_up' | null>(null);
  const [clientsWorkFilter, setClientsWorkFilter] = useState<
    'overdue_payment' | 'awaiting_signature' | 'renewal' | 'lead_follow_up' | null
  >(null);
  const [clientsView, setClientsView] = useState<TenantListView>('work');
  const clearClientsWorkFilter = useCallback(() => setClientsWorkFilter(null), []);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [deletionScheduledFor, setDeletionScheduledFor] = useState<string | null>(null);
  // L5: delete account is hidden at launch (lib/account-deletion-flag.ts).
  const accountDeletionMenu = showAccountDeletion(isAuthenticated, ACCOUNT_DELETION_ENABLED, deletionScheduledFor);
  const [pageRefreshing, setPageRefreshing] = useState(false);
  const refreshSequence = useRef(0);
  const pendingRefresh = useRef<number | null>(null);
  const [leadsReloadToken, setLeadsReloadToken] = useState(0);
  const [roomsReloadToken, setRoomsReloadToken] = useState(0);
  const [creatingTenant, setCreatingTenant] = useState(() => !!initialRoute?.creatingTenant);
  const [createTenantBusy, setCreateTenantBusy] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<AgentTenant | null>(null);
  const createTenantBackRef = useRef<(() => boolean) | null>(null);
  const [tenantDetail, setTenantDetail] = useState<TenantDetailState>(TENANT_DETAIL_CLOSED);
  const tenantDetailActionsRef = useRef<TenantDetailActions | null>(null);
  const [partyContractsReloadToken, setPartyContractsReloadToken] = useState(0);
  const [billsReloadToken, setBillsReloadToken] = useState(0);
  /** Where header/hardware back should return from secondary screens (e.g. create listing). */
  const [secondaryReturnTab, setSecondaryReturnTab] = useState<MobileAppTab | null>(null);
  const createListingBackRef = useRef<(() => boolean) | null>(null);
  const [createListingHeaderTitle, setCreateListingHeaderTitle] = useState('');
  const [activeLead, setActiveLead] = useState<AgentLead | null>(null);
  /** Set while `createLead` edits `activeLead` instead of creating a new lead. */
  const [leadEdit, setLeadEdit] = useState<{ tab: LeadFormTab; returnTab: MobileAppTab } | null>(null);
  /** Room detail opened over a lead's matched room; saving an edit bumps the version so that page re-reads the room. */
  const [matchRoomId, setMatchRoomId] = useState<number | null>(null);
  const [matchRoomPreview, setMatchRoomPreview] = useState<RoomSharePreview | null>(null);
  const [matchRoomVersion, setMatchRoomVersion] = useState(0);
  const [activeMatch, setActiveMatch] = useState<LeadRoomMatch | null>(null);
  /** Bumped by the header "⋯" on lead pages; the body opens its own actions sheet. */
  const [leadMenuRequest, setLeadMenuRequest] = useState(0);
  /** Tenant page opened from a lead page (just booked, or a booked lead); back returns to `returnTab`. */
  const [tenantEntry, setTenantEntry] = useState<(TenantEntry & { returnTab: MobileAppTab }) | null>(null);
  const leadRoomViewing = useLeadRoomViewing(
    activeTab === 'leadRoom' ? activeLead : null,
    activeMatch?.room.id ?? null,
    setActiveLead,
  );

  const unreadCount = [...notifications, ...messages].filter((n) => n.unread).length;

  const handleSearchPlaces = useCallback(
    (query: string) => searchPlaces(query, locale),
    [locale],
  );
  const handleGetPlaceDetails = useCallback(
    (placeId: string) => getPlaceDetails(placeId, locale),
    [locale],
  );
  const handleListContacts = useCallback(() => fetchAgentContacts(), []);
  const handleListPropertyTypes = useCallback(() => fetchAgentPropertyTypes(), []);
  const handleListContractTypes = useCallback(() => fetchAgentContractTypes(), []);
  const handleListRoomTypes = useCallback(() => fetchAgentRoomTypes(), []);

  const handleDeepLinkUrl = (url: string | null) => {
    if (!url) return;
    const parsed = Linking.parse(url);
    const hostOrPath = (parsed.hostname || parsed.path || '').toLowerCase();

    if (hostOrPath.includes('tenant')) {
      setActiveRole('tenant');
      setActiveTab('dashboard');
    } else if (hostOrPath.includes('landlord') || hostOrPath.includes('owner')) {
      // 'owner' kept for old links; the role is now landlord (docs/ROLE-CHANGE-PLAN.md)
      
      setActiveRole('landlord');
      setActiveTab('dashboard');
    } else if (hostOrPath.includes('agent')) {
      setActiveRole('agent');
      setActiveTab('dashboard');
    } else if (hostOrPath.includes('admin')) {
      setActiveRole('admin');
      setActiveTab('dashboard');
    } else if (hostOrPath.includes('services')) {
      setActiveTab('services');
    } else if (hostOrPath.includes('guest') || hostOrPath.includes('search')) {
      setActiveRole('guest');
      setActiveTab('home');
    } else if (hostOrPath.includes('viewing')) {
      Alert.alert(t.common.scheduleViewing, t.mobile.demoAlerts.viewingLink.replace('{url}', url));
    }
  };

  useEffect(() => {
    Linking.getInitialURL().then(handleDeepLinkUrl);
    const subscription = Linking.addEventListener('url', (event) => handleDeepLinkUrl(event.url));
    return () => subscription.remove();
  }, []);


  const handleTabPress = (tab: MobileAppTab) => {
    if (tab === 'menu') {
      setDrawerOpen(true);
      return;
    }
    setPartyInbox(false);
    setSelectedPartyRoom(null);
    setOpenedPartyContract(null);
    if (tab !== 'listingLead') setLeadsWorkFilter(null);
    if (tab !== 'clients') setClientsWorkFilter(null);
    setSecondaryReturnTab(null);
    setLeadEdit(null);
    setMatchRoomId(null);
    setMatchRoomPreview(null);
    setActiveTab(tab);
  };

  const openPartyInbox = (history: boolean) => {
    setDrawerOpen(false);
    setOpenedPartyContract(null);
    setSelectedPartyRoom(null);
    setContractHistory(history);
    setPartyInbox(true);
  };

  const openLandlordDestination = (item: LandlordWebItem) => {
    if (item.target.type === 'tab') {
      handleTabPress(item.target.tab);
      return;
    }
    if (item.target.type === 'contracts') {
      openPartyInbox(false);
      return;
    }
    if (item.target.type === 'tenants') openPartyInbox(true);
  };

  const openTenantDestination = (item: TenantWebItem) => {
    if (item.target.type === 'tab') {
      if (item.target.tab === 'bills') {
        setBillHistory(false);
        setSelectedBillRoom(null);
      }
      handleTabPress(item.target.tab);
      return;
    }
    if (item.target.type === 'contracts') {
      setBillHistory(false);
      setSelectedBillRoom(null);
      openPartyInbox(false);
    }
  };

  const openLeadDetail = useCallback((lead: AgentLead) => {
    setActiveLead(lead);
    setActiveTab('leadDetail');
  }, []);

  const openLeadEdit = useCallback(
    (tab: LeadFormTab) => {
      setLeadEdit({ tab, returnTab: activeTab });
      setActiveTab('createLead');
    },
    [activeTab],
  );

  const openLeadMatch = useCallback((match: LeadRoomMatch) => {
    setActiveMatch(match);
    setActiveTab('leadRoom');
  }, []);

  const goBackFromLead = useCallback(() => {
    setActiveTab(activeTab === 'leadInfo' || activeTab === 'leadRoom' ? 'leadDetail' : 'listingLead');
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'leadDetail' && activeTab !== 'leadInfo' && activeTab !== 'leadRoom') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackFromLead();
      return true;
    });
    return () => sub.remove();
  }, [activeTab, goBackFromLead]);

  const openCreateListing = useCallback(() => {
    if (activeTab !== 'createListing') {
      setSecondaryReturnTab(activeTab);
    }
    setActiveTab('createListing');
  }, [activeTab]);

  const openCreateLead = useCallback(() => {
    if (activeTab !== 'createLead') {
      setSecondaryReturnTab(activeTab);
    }
    setLeadEdit(null);
    setLeadsWorkFilter(null);
    setActiveTab('createLead');
  }, [activeTab]);

  /** Web "+ Create" menu and sidebar links (agent web shell). Mobile never calls this. */
  const openWebCreate = (kind: 'room' | 'lead' | 'tenant') => {
    if (kind === 'room') openCreateListing();
    else if (kind === 'lead') openCreateLead();
    else {
      handleTabPress('clients');
      setCreatingTenant(true);
    }
  };

  const goBackFromSecondary = useCallback(() => {
    const fallback: MobileAppTab =
      activeTab === 'createLead'
        ? 'listingLead'
        : activeRole === 'landlord'
          ? 'dashboard'
          : 'listingRoom';
    const target =
      secondaryReturnTab &&
      secondaryReturnTab !== 'createListing' &&
      secondaryReturnTab !== 'createLead'
        ? secondaryReturnTab
        : fallback;
    setSecondaryReturnTab(null);
    setActiveTab(target);
  }, [activeRole, activeTab, secondaryReturnTab]);

  useEffect(() => {
    if (activeTab !== 'createListing') {
      setCreateListingHeaderTitle('');
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Prefer wizard stepwise back; only exit the tab when wizard returns false.
      if (createListingBackRef.current?.()) return true;
      goBackFromSecondary();
      return true;
    });
    return () => sub.remove();
  }, [activeTab, goBackFromSecondary]);

  // handleCreateListingBack used by shell header — same stepwise behavior
  const handleCreateListingBack = useCallback(() => {
    if (createListingBackRef.current?.()) return;
    goBackFromSecondary();
  }, [goBackFromSecondary]);

  const handleCreateLeadBack = useCallback(() => {
    if (createLeadBusy) return;
    if (leadEdit) {
      setLeadEdit(null);
      setActiveTab(leadEdit.returnTab);
      return;
    }
    goBackFromSecondary();
  }, [createLeadBusy, goBackFromSecondary, leadEdit]);

  useEffect(() => {
    if (activeTab !== 'createLead') {
      setCreateLeadBusy(false);
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCreateLeadBack();
      return true;
    });
    return () => sub.remove();
  }, [activeTab, handleCreateLeadBack]);

  useEffect(() => {
    if (activeTab !== 'clients') {
      setCreatingTenant(false);
      setCreatedTenant(null);
      setTenantEntry(null);
      setTenantDetail(TENANT_DETAIL_CLOSED);
    }
  }, [activeTab]);

  useEffect(() => {
    if (creatingTenant) {
      setCreatedTenant(null);
      setTenantEntry(null);
    }
  }, [creatingTenant]);

  /** The open lead booked the room on its matched-room page: show it as booked now, then re-read it. */
  const handleRoomReserved = useCallback(
    (tenant: AgentTenant) => {
      const rentRoomId = activeMatch?.room.id ?? null;
      setActiveLead((current) =>
        current?.id === tenant.leadId ? { ...current, status: 'booked', tenantId: tenant.id, rentRoomId } : current,
      );
      setLeadsReloadToken((n) => n + 1);
      getAgentLead(tenant.leadId)
        .then((lead) => setActiveLead((current) => (current?.id === lead.id ? lead : current)))
        .catch(() => {});
    },
    [activeMatch],
  );

  /** Opens a tenant's page from a lead page; back from it returns to that page. */
  const openTenantPage = useCallback(
    (entry: TenantEntry) => {
      setClientsWorkFilter(null);
      setCreatingTenant(false);
      setCreatedTenant(null);
      setTenantEntry({ ...entry, returnTab: activeTab });
      setActiveTab('clients');
    },
    [activeTab],
  );

  const handleTenantEntryBack = useCallback(() => {
    if (tenantEntry) setActiveTab(tenantEntry.returnTab);
  }, [tenantEntry]);

  const handleCreateTenantBack = useCallback(() => {
    if (createTenantBusy) return;
    if (createTenantBackRef.current?.()) return;
    setCreatingTenant(false);
  }, [createTenantBusy]);

  const handleTenantCreated = useCallback((tenant: AgentTenant) => {
    setCreatedTenant(tenant);
    // Its lead is `booked` now.
    setLeadsReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!creatingTenant) {
      setCreateTenantBusy(false);
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCreateTenantBack();
      return true;
    });
    return () => sub.remove();
  }, [creatingTenant, handleCreateTenantBack]);

  const isTenantDetail = activeTab === 'clients' && !creatingTenant && tenantDetail.open;
  useEffect(() => {
    if (!isTenantDetail) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      tenantDetailActionsRef.current?.back();
      return true;
    });
    return () => sub.remove();
  }, [isTenantDetail]);

  useEffect(() => {
    if (!partyInbox) setContractHistory(false);
  }, [partyInbox]);

  useEffect(() => {
    if (activeRole === 'tenant' && activeTab === 'bills') return;
    setBillHistory(false);
    setSelectedBillRoom(null);
  }, [activeRole, activeTab]);

  useEffect(() => {
    if (activeRole !== 'tenant' || activeTab !== 'bills' || (!billHistory && !selectedBillRoom)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedBillRoom) setSelectedBillRoom(null);
      else setBillHistory(false);
      return true;
    });
    return () => sub.remove();
  }, [activeRole, activeTab, billHistory, selectedBillRoom]);

  useEffect(() => {
    if (!partyInbox || openedPartyContract || (!selectedPartyRoom && !contractHistory)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedPartyRoom?.tenant && !contractHistory) {
        setSelectedPartyRoom({ ...selectedPartyRoom, tenant: null });
      } else if (selectedPartyRoom) setSelectedPartyRoom(null);
      else if (contractHistory && activeRole !== 'tenant') {
        setContractHistory(false);
        setPartyInbox(false);
      } else setContractHistory(false);
      return true;
    });
    return () => sub.remove();
  }, [partyInbox, selectedPartyRoom, openedPartyContract, contractHistory, activeRole]);

  const handleRoleChange = (role: UserRole) => {
    // Web portal (e.g. agent.nestyk.com): a role this portal does not show opens on its own site (route-access.ts).
    if (openRoleElsewhere(role)) {
      setDrawerOpen(false);
      return;
    }
    if (roleRequiresAuth(role) && !isAuthenticated) {
      setPendingRole(role);
      setDrawerOpen(false);
      router.push(loginHref(roleHomePath(role)) as never);
      return;
    }
    setPartyInbox(false);
    setSelectedPartyRoom(null);
    setOpenedPartyContract(null);
    setActiveRole(role);
    setActiveTab(getDefaultTabForRole(role));
  };

  // Seeker (guest) is public; every other role requires login.
  useEffect(() => {
    if (!ready) return;

    if (isAuthenticated) {
      const pending = consumePendingRole();
      if (pending && roleRequiresAuth(pending) && canOpenRole(pending, session?.roles)) {
        setActiveRole(pending);
        setActiveTab(getDefaultTabForRole(pending));
      }
      return;
    }

    if (consumeGuestBrowse()) {
      setActiveRole('guest');
      setActiveTab(getDefaultTabForRole('guest'));
      // Signed out in another tab: land where "Sign out" lands in this tab ("/" needs nothing more).
      if (consumeSignOutLanding() && AFTER_SIGN_OUT_PATH !== '/') router.replace(AFTER_SIGN_OUT_PATH as never);
      return;
    }

    if (roleRequiresAuth(activeRole)) {
      // Web: /login?next=<this page>, so signing in comes back here (route plan rule 7). Mobile: /login.
      router.replace(loginHref() as never);
    }
  }, [ready, isAuthenticated, activeRole, router]);

  // QA web role URL bug (4 Nov 2026): a signed-in account never stays on a role it does not have (a typed URL, an
  // old link, a page opened before the saved sign-in loaded, a default role). It goes quietly to its own home.
  // Web: replace, so the back button does not return to the refused page.
  const signedInRoles = ready && isAuthenticated && session ? session.roles : null;
  const signedInRolesRef = useRef<readonly string[] | null>(signedInRoles);
  signedInRolesRef.current = signedInRoles;
  // Route access (lib/route-access.ts, 5 Nov 2026): also a role outside this web portal, signed in or not.
  useEffect(() => {
    const redirect = roleRedirect(activeRole, signedInRoles);
    if (!redirect) return;
    const landing = landingRoleFor(signedInRoles);
    if (Platform.OS === 'web') {
      router.replace(redirect as never);
      return;
    }
    setPartyInbox(false);
    setSelectedPartyRoom(null);
    setOpenedPartyContract(null);
    setActiveRole(landing);
    setActiveTab(getDefaultTabForRole(landing));
  }, [signedInRoles, activeRole, router]);

  // Web: the shell and the URL move together (route plan R1–R2). Mobile: no-op.
  // A URL from outside (link, address bar, back/forward) opens its page with a clean state, like a menu tap.
  const applyRoute = useCallback((route: AppRouteState) => {
    // A role this account does not have: go to its own home instead, without showing that role's page even once.
    const redirect = roleRedirect(route.role, signedInRolesRef.current);
    if (redirect) {
      router.replace(redirect as never);
      return;
    }
    setDrawerOpen(false);
    setPartyInbox(!!route.partyInbox);
    setContractHistory(route.partyInbox === 'tenants');
    setSelectedPartyRoom(null);
    setOpenedPartyContract(null);
    setBillHistory(!!route.billHistory);
    setSelectedBillRoom(null);
    setLeadsWorkFilter(null);
    setClientsWorkFilter(null);
    setSecondaryReturnTab(null);
    setLeadEdit(null);
    setMatchRoomId(null);
    setMatchRoomPreview(null);
    setCreatingTenant(!!route.creatingTenant);
    if (route.tab === 'calendar') {
      const date = route.calendarDate ?? calendarDateKey(new Date());
      setCalendarSelectedDate(date);
      setCalendarMonth(date.slice(0, 7) + '-01');
    }
    setActiveRole(route.role);
    setActiveTab(route.tab);
  }, [router]);
  // Pages without a path yet (R3: lead, tenant, contract, bill room) leave the URL on the list they came from.
  const routeDetailOpen =
    !!leadEdit ||
    isTenantDetail ||
    !!tenantEntry ||
    !!selectedBillRoom ||
    !!selectedPartyRoom ||
    !!openedPartyContract ||
    (activeRole === 'tenant' && partyInbox && contractHistory);
  const routeHref =
    Platform.OS === 'web'
      ? stateToRoute({
          role: activeRole,
          tab: activeTab,
          creatingTenant,
          partyInbox: partyInbox ? (activeRole === 'landlord' && contractHistory ? 'tenants' : 'contracts') : null,
          calendarDate: calendarSelectedDate,
          billHistory,
          detailOpen: routeDetailOpen,
        })
      : null;
  useAppRouteSync(routeHref, activeRole, applyRoute);

  const accentColor =
    tokens.colors.roles[activeRole as keyof typeof tokens.colors.roles] || tokens.colors.accent;

  const cardStyle = {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
  };

  const headingText = { color: theme.textHeading };
  const secondaryText = { color: theme.textSecondary };

  /** Web narrower than a tablet shows the same screens as the mobile app; the desktop shell starts at WEB_SHELL_MIN_WIDTH. */
  const isWideWeb = Platform.OS === 'web' && windowWidth >= WEB_SHELL_MIN_WIDTH;
  const isAgentWeb = isWideWeb && activeRole === 'agent';
  const isLandlordWeb = isWideWeb && activeRole === 'landlord';
  const isTenantWeb = isWideWeb && activeRole === 'tenant';
  const isDesktopWeb = isAgentWeb || isLandlordWeb || isTenantWeb;
  // Widening the browser past WEB_SHELL_MIN_WIDTH swaps in the desktop shell; close the app drawer so it does not
  // pop back open when the window is narrowed again.
  useEffect(() => {
    if (isDesktopWeb) setDrawerOpen(false);
  }, [isDesktopWeb]);
  const Page = isDesktopWeb ? AgentWorkspacePage : MobileModePage;
  const AgentHeader = isAgentWeb ? AgentSectionHeader : MobileSectionHeader;
  const SectionHeader = isDesktopWeb ? AgentSectionHeader : MobileSectionHeader;

  const isTenantWorkspace = activeRole === 'tenant' && (partyInbox || activeTab === 'bills');
  const screenTitle =
    activeRole === 'agent' || partyInbox || isTenantWorkspace
      ? undefined
      : getScreenTitle(activeTab, t);
  /** Contract side shown in the party inbox ('owner' = landlord side of a contract, not a role). */
  const partyRole: ContractParty = activeRole === 'tenant' ? 'tenant' : 'owner';
  const partyAccent = tokens.colors.roles[CONTRACT_PARTY_ROLE[partyRole]];

  const agentSectionTabs: MobileAppTab[] = [
    'listingRoom',
    'listingLead',
    'clients',
    'more',
    'contact',
    'contracts',
    'calendar',
    'services',
    'createListing',
    'createLead',
    'leadDetail',
    'leadInfo',
    'leadRoom',
  ];

  const renderAgentHeader = () => {
    const workspace = t.agent.dashboard.workspaceLabel;
    const accent = tokens.colors.roles.agent;
    const openMenu = () => setDrawerOpen(true);

    if (activeTab === 'dashboard') {
      if (isAgentWeb) return null;
      return (
        <MobileWorkspaceHeader
          workspaceLabel={workspace}
          accentColor={accent}
          notificationCount={unreadCount}
          onMenuPress={openMenu}
          onNotificationsPress={() => setNotificationsOpen(true)}
        />
      );
    }

    // W13 calendar page carries its own hint row and toolbar; the shell heading would be an empty 84px band.
    if (isAgentWeb && activeTab === 'calendar') return null;

    if (agentSectionTabs.includes(activeTab)) {
      const isCreateLead = activeTab === 'createLead';
      const isCreateTenant = activeTab === 'clients' && creatingTenant;
      const isLeadPage = activeTab === 'leadDetail' || activeTab === 'leadInfo' || activeTab === 'leadRoom';
      const hasLeadMenu = activeTab === 'leadDetail' || activeTab === 'leadRoom';
      const isSecondary =
        activeTab === 'createListing' || isCreateLead || isCreateTenant || isTenantDetail || isLeadPage;
      const canEditTenant = isTenantDetail && tenantDetail.canEdit;

      return (
        <AgentHeader
          title={
            isCreateLead
              ? leadEdit
                ? t.agent.leads.editLead
                : t.agent.leads.create
              : isCreateTenant
                ? t.agent.tenants.create
              : isTenantDetail
                ? tenantDetail.title || t.agent.tenants.detailTitle
              : isLeadPage
                ? getScreenTitle(activeTab, t)
                : isSecondary
                  ? createListingHeaderTitle || t.agent.listings.addRoom
                  : isAgentWeb
                    ? activeTab === 'contracts' ? t.mobile.drawerMenu.agentContracts : t.mobile.tabs[activeTab]
                    : getScreenTitle(activeTab, t)
          }
          workspaceLabel={
            isTenantDetail
              ? tenantDetail.subtitle || undefined
              : isSecondary
                ? undefined
                : activeTab === 'clients'
                  ? clientsView === 'work'
                    ? t.agent.tenants.list.subtitleWork
                    : t.agent.tenants.list.subtitleAll
                  : workspace
          }
          accentColor={accent}
          leading={isSecondary ? 'back' : 'menu'}
          onMenuPress={openMenu}
          onBackPress={
            isCreateLead
              ? handleCreateLeadBack
              : isCreateTenant
                ? handleCreateTenantBack
              : isTenantDetail
                ? () => tenantDetailActionsRef.current?.back()
              : isLeadPage
                ? goBackFromLead
                : isSecondary
                  ? handleCreateListingBack
                  : undefined
          }
          backDisabled={
            (isCreateLead && createLeadBusy) ||
            (isCreateTenant && createTenantBusy) ||
            (isTenantDetail && tenantDetail.saving)
          }
          onActionPress={
            activeTab === 'leadInfo' && activeLead
              ? () => openLeadEdit('profile')
              : hasLeadMenu
                ? () => setLeadMenuRequest((n) => n + 1)
                : canEditTenant
                  ? () => tenantDetailActionsRef.current?.edit()
                  : undefined
          }
          actionLabel={
            activeTab === 'leadInfo'
              ? t.agent.leads.editLead
              : hasLeadMenu
                ? t.agent.leads.moreActions
                : canEditTenant
                  ? t.agent.tenants.edit
                  : undefined
          }
          actionIcon={
            activeTab === 'leadInfo' || canEditTenant ? 'pencil' : hasLeadMenu ? 'dots-vertical' : undefined
          }
          actionVariant={activeTab === 'leadInfo' || hasLeadMenu || canEditTenant ? 'icon' : undefined}
          onAddPress={
            !isSecondary && activeTab === 'listingRoom'
              ? openCreateListing
              : !isSecondary && activeTab === 'listingLead'
                ? openCreateLead
                : !isSecondary && activeTab === 'clients'
                  ? () => setCreatingTenant(true)
                  : undefined
          }
          addVariant={
            activeTab === 'listingRoom'
              ? 'room'
              : activeTab === 'listingLead' || activeTab === 'clients'
                ? 'lead'
                : undefined
          }
          addAccessibilityLabel={
            activeTab === 'listingRoom'
              ? t.agent.listings.addRoom
              : activeTab === 'listingLead'
                ? t.agent.leads.create
              : activeTab === 'clients'
                ? t.agent.tenants.create
                : undefined
          }
        />
      );
    }

    return (
      <MobileWorkspaceHeader
        workspaceLabel={workspace}
        accentColor={accent}
        notificationCount={unreadCount}
        onMenuPress={openMenu}
        onNotificationsPress={() => setNotificationsOpen(true)}
      />
    );
  };

  const handleAgentDashboardNavigate = useCallback(
    (link: AgentDashboardDeepLink) => {
      if (link.type === 'tab') {
        if (link.tab === 'listingLead') {
          if (link.filter?.kind === 'lead_create') {
            setClientsWorkFilter(null);
            openCreateLead();
            return;
          }
          setLeadsWorkFilter(link.filter?.kind === 'work' && link.filter.work === 'lead_follow_up' ? 'lead_follow_up' : null);
          setClientsWorkFilter(null);
        } else if (link.tab === 'clients') {
          setClientsWorkFilter(link.filter?.kind === 'work' ? link.filter.work : null);
          setLeadsWorkFilter(null);
        } else {
          setLeadsWorkFilter(null);
          setClientsWorkFilter(null);
        }
        setActiveTab(link.tab);
        return;
      }
      switch (link.id) {
        case 'addListing':
          openCreateListing();
          return;
        case 'newLead':
          openCreateLead();
          return;
        case 'viewCalendar':
        case 'viewAppointment':
          setActiveTab('calendar');
          return;
        case 'viewCommission':
          Alert.alert(t.agent.dashboard.openCommission, t.agent.dashboard.unavailableSection);
          return;
        case 'viewPayments':
          setClientsWorkFilter('overdue_payment');
          setActiveTab('clients');
          return;
        case 'viewServices':
        case 'viewContacts':
        case 'viewContracts':
          // Pages not ready yet (same "coming soon" as the More tab)
          Alert.alert(t.agent.dashboard.comingSoon, t.agent.dashboard.unavailableSection);
          return;
        case 'viewListing':
          setActiveTab('listingRoom');
          return;
        case 'viewLead':
          setActiveTab('listingLead');
          return;
        case 'viewClient':
          setActiveTab('clients');
          return;
        default:
          return;
      }
    },
    [t, openCreateListing, openCreateLead],
  );

  const dashboardGreetingName = useMemo(() => {
    // Prefer a person-facing first name; avoid treating "Admin" as the role label.
    const raw = (displayName || '').trim();
    const first = raw.split(/\s+/)[0] || '';
    const greetingName =
      !first || first.toLowerCase() === 'admin' || raw === t.roles.guest
        ? (session?.email?.split('@')[0] || t.roles.agent)
        : first;
    return greetingName;
  }, [displayName, session?.email, t.roles.agent, t.roles.guest]);

  const finishPageRefresh = useCallback((token: number) => {
    if (pendingRefresh.current !== token) return;
    pendingRefresh.current = null;
    setPageRefreshing(false);
  }, []);

  const agentDashboardSnapshot = useAgentDashboard({
    enabled: activeRole === 'agent' && activeTab === 'dashboard' && isAuthenticated,
    accountId: session?.userId ?? null,
    refreshToken: dashboardRefreshKey,
    greetingName: dashboardGreetingName,
    locale,
    onSettled: finishPageRefresh,
  });

  const calendarViewings = useAgentCalendarViewings({
    enabled: activeRole === 'agent' && activeTab === 'calendar' && isAuthenticated,
    accountId: session?.userId ?? null,
    visibleMonth: calendarMonth,
    refreshToken: calendarReloadToken,
    onSettled: finishPageRefresh,
  });

  useEffect(() => {
    // A completion from a previous tab/role must never stop a newer refresh.
    pendingRefresh.current = null;
    setPageRefreshing(false);
  }, [activeRole, activeTab, partyInbox]);

  const handlePageRefresh = useCallback(() => {
    if (pendingRefresh.current !== null) return;
    const token = ++refreshSequence.current;
    pendingRefresh.current = token;
    setPageRefreshing(true);
    if (partyInbox && activeRole !== 'agent') {
      setPartyContractsReloadToken(token);
    } else if (activeRole === 'agent' && activeTab === 'dashboard') {
      setDashboardRefreshKey(token);
    } else if (activeRole === 'agent' && activeTab === 'calendar') {
      setCalendarReloadToken(token);
    } else if ((activeRole === 'tenant' || activeRole === 'landlord') && activeTab === 'dashboard') {
      setBillsReloadToken(token);
    } else if (activeTab === 'clients') {
      setBillsReloadToken(token);
    } else if (activeTab === 'listingLead') {
      setLeadsReloadToken(token);
    } else if (activeTab === 'listingRoom') {
      setRoomsReloadToken(token);
    } else if (activeTab === 'bills' || activeTab === 'income') {
      setBillsReloadToken(token);
    } else {
      finishPageRefresh(token);
    }
  }, [activeRole, activeTab, partyInbox, finishPageRefresh]);

  const renderListingCards = () => (
    <>
      <Text style={[styles.listingSectionTitle, headingText]}>Featured Listings ({MOCK_LISTINGS.length})</Text>
      {MOCK_LISTINGS.map((item) => (
        <View key={item.id} style={[styles.listingCard, cardStyle]}>
          <View style={styles.listingTopRow}>
            <MobileBadge role={item.badgeRole} label={item.tag} />
            <Text style={styles.listingPrice}>{item.price} ฿/mo</Text>
          </View>
          <Text style={[styles.listingTitle, headingText]}>{item.title}</Text>
          <Text style={[styles.listingSub, secondaryText]}>{item.roomType} • {item.floor}</Text>
          <View style={styles.listingActionRow}>
            <View style={{ flex: 1 }}>
              <MobileButton variant="outline" onPress={() => Alert.alert(t.common.scheduleViewing, item.title)}>
                <View style={styles.buttonRow}>
                  <MobileIcon name="calendar-plus" size={16} color={tokens.colors.primary} />
                  <Text style={styles.buttonLabel}>{t.common.schedule}</Text>
                </View>
              </MobileButton>
            </View>
            <View style={{ flex: 1 }}>
              <MobileButton onPress={() => Alert.alert(t.common.viewDetails, item.title)}>{t.common.viewDetails}</MobileButton>
            </View>
          </View>
        </View>
      ))}
    </>
  );

  const renderBillsBody = () => (
    <View style={styles.bodyContainer}>
      <TenantBillsScreen
        reloadToken={billsReloadToken}
        onReloadSettled={finishPageRefresh}
        roomHistory={billHistory}
        selectedRoom={selectedBillRoom}
        onSelectRoom={setSelectedBillRoom}
      />
    </View>
  );

  const renderDashboardBody = () => {
    if (activeRole === 'agent') {
      if (agentDashboardSnapshot.business.status === 'loading') {
        return (
          <View style={styles.bodyContainer}>
            <MobileBrandLoader fill size="md" />
          </View>
        );
      }
      if (isAgentWeb) {
        return (
          <AgentOverview
            snapshot={agentDashboardSnapshot}
            onNavigate={handleAgentDashboardNavigate}
            onRefresh={handlePageRefresh}
            deletionScheduledFor={deletionScheduledFor}
          />
        );
      }
      return (
        <View style={styles.bodyContainer}>
          <MobileAgentDashboardBody
            snapshot={agentDashboardSnapshot}
            onNavigate={handleAgentDashboardNavigate}
            initials={profileInitials}
            onRefresh={handlePageRefresh}
            deletionScheduledFor={deletionScheduledFor}
          />
        </View>
      );
    }
    // QA (4 Nov 2026): the old card showed made-up numbers ("Pending tickets: 3", "24 co-broke listings") in English.
    const home = t.mobile.roleHome;
    const summaries: Record<UserRole, { title: string; desc: string; badge: string }> = {
      guest: { title: home.guestTitle, desc: home.guestDesc, badge: t.roles.guest },
      tenant: { title: home.tenantTitle, desc: '', badge: t.roles.tenant },
      landlord: { title: home.landlordTitle, desc: '', badge: t.roles.landlord },
      agent: { title: home.agentTitle, desc: '', badge: t.roles.agent },
      admin: { title: home.adminTitle, desc: home.comingSoon, badge: t.roles.admin },
    };
    const summary = summaries[activeRole];
    return (
      <View style={styles.bodyContainer}>
        {deletionScheduledFor ? <AccountDeletionNotice scheduledFor={deletionScheduledFor} /> : null}
        <View style={[styles.card, cardStyle]}>
          <View style={styles.listingTopRow}>
            <Text style={[styles.sectionHeader, headingText]}>{summary.title}</Text>
            <MobileBadge role={activeRole} label={summary.badge} />
          </View>
          {activeRole === 'tenant' ? (
            <TenantNextBillCard
              reloadToken={billsReloadToken}
              onReloadSettled={finishPageRefresh}
              onOpenBills={() => handleTabPress('bills')}
            />
          ) : activeRole === 'landlord' ? (
            <OwnerConfirmedRent
              reloadToken={billsReloadToken}
              onReloadSettled={finishPageRefresh}
            />
          ) : (
            <Text style={[styles.sectionDesc, secondaryText]}>{summary.desc}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderTabBody = () => {
    if (activeTab === 'home') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>Discover rooms near you</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>Featured condos and apartments in Bangkok</Text>
          </View>
          {renderListingCards()}
        </View>
      );
    }

    if (activeTab === 'search') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>Search rooms & condos nearby</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>Live GPS · Schedule real viewings instantly</Text>
            <View style={{ marginTop: 12 }}>
              <MobileInput
                placeholder="Project name, BTS/MRT station, or area..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
          {renderListingCards()}
        </View>
      );
    }

    if (activeTab === 'dashboard') {
      return renderDashboardBody();
    }

    // Living (/tenant/home): showed one sample lease to every tenant (QA web flow bugs 6 Nov 2026 item 1). The menu
    // and the tab are "coming soon" until the page reads the tenant's own lease; a direct link lands here.
    if (activeTab === 'living') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>{t.agent.dashboard.comingSoon}</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>{t.agent.dashboard.unavailableSection}</Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'bills') {
      return renderBillsBody();
    }

    if (activeTab === 'income') {
      return (
        <View style={styles.bodyContainer}>
          <TenantBillsScreen
            mode="owner"
            reloadToken={billsReloadToken}
            onReloadSettled={finishPageRefresh}
          />
        </View>
      );
    }

    if (activeTab === 'deals') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>My Deals</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>2 active negotiations · 1 closing this month</Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'listingLead') {
      // Desktop web (W2, Mos 5 Nov 2026): leads table; phone and phone-width web keep the app screen.
      if (isAgentWeb) {
        return (
          <AgentLeadsPage
            workFilter={leadsWorkFilter}
            reloadToken={leadsReloadToken}
            onReloadSettled={finishPageRefresh}
            onOpenLead={openLeadDetail}
            onAddLead={openCreateLead}
          />
        );
      }
      return (
        <View style={styles.bodyContainer}>
          <AgentLeadsScreen
            workFilter={leadsWorkFilter}
            reloadToken={leadsReloadToken}
            onReloadSettled={finishPageRefresh}
            onOpenLead={openLeadDetail}
          />
        </View>
      );
    }

    if (activeTab === 'leadDetail' && activeLead) {
      return (
        <Animated.View entering={SlideInRight.duration(200)} style={styles.bodyContainer}>
          <AgentLeadDetailBody
            lead={activeLead}
            onLeadChange={setActiveLead}
            onOpenInfo={() => setActiveTab('leadInfo')}
            onEditMatching={() => openLeadEdit('matching')}
            onOpenMatch={openLeadMatch}
            onOpenTenant={(tenantId) => openTenantPage({ tenantId })}
            menuRequest={leadMenuRequest}
          />
        </Animated.View>
      );
    }

    if (activeTab === 'leadRoom' && activeLead && activeMatch) {
      return (
        <Animated.View entering={SlideInRight.duration(200)} style={styles.bodyContainer}>
          <LeadRoomViewingBanner viewing={leadRoomViewing.viewing} />
          <LeadMatchedRoomBody
            lead={activeLead}
            match={activeMatch}
            onOpenRoom={(roomId) => {
              setMatchRoomPreview(null);
              setMatchRoomId(roomId);
            }}
            onPreviewRoom={(roomId, visibility, contactId) => {
              setMatchRoomPreview({ visibility, contactId });
              setMatchRoomId(roomId);
            }}
            roomVersion={matchRoomVersion}
            menuRequest={leadMenuRequest}
          />
          <AgentRoomDetailModal
            roomId={matchRoomId}
            preview={matchRoomPreview}
            onClose={() => {
              setMatchRoomId(null);
              setMatchRoomPreview(null);
            }}
            onSaved={() => setMatchRoomVersion((n) => n + 1)}
          />
        </Animated.View>
      );
    }

    if (activeTab === 'leadInfo' && activeLead) {
      return (
        <Animated.View
          entering={SlideInRight.duration(200)}
          style={[styles.wizardBody, styles.fullBleedBody]}
        >
          <LeadFullInfoBody lead={activeLead} />
        </Animated.View>
      );
    }

    if (activeTab === 'clients') {
      // One wrapper for both layouts so the tenants screen keeps its state when the form closes.
      return (
        <View style={creatingTenant ? [styles.wizardBody, styles.fullBleedBody] : styles.bodyContainer}>
          <AgentTenantsScreen
            workFilter={clientsWorkFilter}
            onWorkFilterHandled={clearClientsWorkFilter}
            onListViewChange={setClientsView}
            reloadToken={billsReloadToken}
            onReloadSettled={finishPageRefresh}
            creating={creatingTenant}
            onCreatingChange={setCreatingTenant}
            onCreateBusy={setCreateTenantBusy}
            createBackRef={createTenantBackRef}
            createdTenant={createdTenant}
            onTenantCreated={handleTenantCreated}
            entry={tenantEntry}
            onEntryBack={handleTenantEntryBack}
            detailActionsRef={tenantDetailActionsRef}
            onDetailStateChange={setTenantDetail}
          />
        </View>
      );
    }

    if (activeTab === 'more') {
      return <AgentMoreToolsBody onOpen={setActiveTab} />;
    }

    // Agent pages that are not ready (contacts, contracts archive, services): "coming soon" instead of mock content.
    if (activeRole === 'agent' && isAgentComingSoonTab(activeTab)) {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>{t.agent.dashboard.comingSoon}</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>{t.agent.dashboard.unavailableSection}</Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'contact') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionDesc, secondaryText]}>
              Owners · buyers · co-broke partners (mock contact book)
            </Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'contracts') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionDesc, secondaryText]}>
              Draft · pending signature · active co-broke contracts (mock)
            </Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'calendar' && activeRole === 'agent') {
      const calendarProps: AgentCalendarPageProps = {
        viewings: calendarViewings.viewings,
        status: calendarViewings.status,
        onRetry: () => setCalendarReloadToken(++refreshSequence.current),
        onSaved: viewing => {
          if (viewing.status !== 'cancelled') {
            const date = calendarDateKey(new Date(viewing.scheduledAt));
            setCalendarSelectedDate(date);
            setCalendarMonth(date.slice(0, 7) + '-01');
          }
          setCalendarReloadToken(++refreshSequence.current);
        },
        selectedDate: calendarSelectedDate,
        onSelectDate: setCalendarSelectedDate,
        visibleMonth: calendarMonth,
        onMonthChange: setCalendarMonth,
      };
      // Desktop web (W13, Mos 6 Nov 2026): calendar page; phone and phone-width web keep the app screen.
      if (isAgentWeb) {
        return <AgentCalendarPage key={session?.userId ?? 'guest'} {...calendarProps} onOpenLeads={() => handleTabPress('listingLead')} />;
      }
      return <AgentCalendarScreen key={session?.userId ?? 'guest'} {...calendarProps} />;
    }

    if (activeTab === 'calendar') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionDesc, secondaryText]}>
              Viewings · deal deadlines · follow-ups (mock calendar)
            </Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'tickets') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>Service Tickets</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>
              {MOCK_SERVICE_TICKETS.length} open tickets · 1 assigned today
            </Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'services') {
      return (
        <View style={styles.bodyContainer}>
          <MobileServiceCatalogBody
            currentRole={activeRole}
            activeTickets={MOCK_SERVICE_TICKETS}
            onRequestService={(cat) =>
              Alert.alert(t.mobile.demoAlerts.serviceRequestTitle, t.mobile.demoAlerts.serviceRequested.replace('{category}', t.services[cat]))
            }
            onHubAction={(id) => {
              if (id === 'tickets') Alert.alert(t.services.myTickets, t.mobile.demoAlerts.openTickets.replace('{count}', String(MOCK_SERVICE_TICKETS.length)));
              if (id === 'emergency') Alert.alert(t.services.emergency, t.mobile.demoAlerts.emergencyBody);
              if (id === 'move') Alert.alert(t.mobile.demoAlerts.moveTitle, t.mobile.demoAlerts.moveBody);
            }}
          />
        </View>
      );
    }

    if (activeTab === 'listingRoom') {
      // Desktop web (plan step 4): table / card grid page; phone and phone-width web keep the app screen.
      if (isAgentWeb) {
        return (
          <AgentRoomsPage
            reloadToken={roomsReloadToken}
            onReloadSettled={finishPageRefresh}
            onAddRoom={openCreateListing}
          />
        );
      }
      return (
        <View style={styles.bodyContainer}>
          <AgentRoomsScreen
            reloadToken={roomsReloadToken}
            onReloadSettled={finishPageRefresh}
          />
        </View>
      );
    }

    if (activeTab === 'createLead') {
      const leadForm = (bind: LeadFormBind) =>
        leadEdit && activeLead ? (
          <CreateLeadForm
            key={activeLead.id}
            initialLead={activeLead}
            initialTab={leadEdit.tab}
            onBusy={setCreateLeadBusy}
            onSaved={(lead) => {
              setActiveLead(lead);
              setLeadEdit(null);
              setActiveTab(leadEdit.returnTab);
            }}
            {...bind}
          />
        ) : (
          <CreateLeadForm
            onBusy={setCreateLeadBusy}
            onSaved={() => {
              Alert.alert(t.agent.leads.saved);
              setSecondaryReturnTab(null);
              setActiveTab('listingLead');
            }}
            {...bind}
          />
        );
      return (
        <Animated.View
          entering={FadeIn.duration(150)}
          style={[styles.wizardBody, styles.fullBleedBody]}
        >
          {/* Desktop web (W17, Mos 6 Nov 2026): form + readiness panel; phone and phone-width web keep the app form. */}
          {isAgentWeb ? (
            <AgentLeadFormPage key={leadEdit && activeLead ? `edit-${activeLead.id}` : 'create'} mode={leadEdit && activeLead ? 'edit' : 'create'}>
              {leadForm}
            </AgentLeadFormPage>
          ) : (
            leadForm({})
          )}
        </Animated.View>
      );
    }

    if (activeTab === 'createListing') {
      return (
        <View style={[styles.bodyContainer, styles.wizardBody]}>
          <MobileCreateListingWizardBody
            config={defaultAgentListingConfig}
            backHandlerRef={createListingBackRef}
            onHeaderTitleChange={setCreateListingHeaderTitle}
            pickPhotos={pickRoomPhotos}
            uploadPhoto={uploadRoomPhoto}
            enhancePhoto={enhanceRoomPhoto}
            searchPlaces={handleSearchPlaces}
            getPlaceDetails={handleGetPlaceDetails}
            reverseGeocode={(lat, lng) => reverseMapLocation(lat, lng)}
            listContacts={handleListContacts}
            listPropertyTypes={handleListPropertyTypes}
            listContractTypes={handleListContractTypes}
            listRoomTypes={handleListRoomTypes} listFacilities={fetchAgentFacilities} mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
    searchNearby={(lat, lng) => searchNearbyPlaces(lat, lng, locale)}
            generateListingPromo={generateListingPromo}
            onSubmitListing={async (data) => {
              await createAgentScoutRoom(data);
              Alert.alert(
                t.agent.createRoom.successTitle,
                t.agent.createRoom.successBody,
              );
              setSecondaryReturnTab(null);
              setActiveTab('listingRoom');
            }}
          />
        </View>
      );
    }

    return null;
  };

  const profileName = isAuthenticated ? displayName : t.roles.guest;
  const profileEmail = isAuthenticated ? session!.email : t.common.signIn;
  const profilePhone = isAuthenticated ? session?.phone ?? undefined : undefined;
  const profileInitials = isAuthenticated ? initials : '?';
  const saveProfile = async (input: { firstName: string; lastName: string; phone: string | null }) => {
    await updateMyProfile(input);
    await refreshProfile();
  };
  const uploadAvatar = async (photo: Parameters<typeof uploadProfileAvatar>[0]) => {
    const url = await uploadProfileAvatar(photo);
    await refreshProfile();
    return url;
  };
  const removeAvatar = async () => {
    await clearProfileAvatar();
    await refreshProfile();
  };
  const changePassword = async (input: { currentPassword: string; newPassword: string; captchaToken?: string }) => {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured() || !session?.email) {
      throw Object.assign(new Error(), { code: 'SUPABASE_NOT_CONFIGURED' });
    }
    try {
      // The "password changed" email comes from Supabase (Authentication → Emails → Password changed), for this and for
      // a reset. The API's own notice was removed: users got the same news twice (4 Nov 2026).
      await changeAccountPassword(supabase, session.email, input.currentPassword, input.newPassword, input.captchaToken);
    } finally {
      setPasswordCaptchaToken(null);
      setPasswordCaptchaKey(passwordCaptchaKey + 1);
    }
  };
  const loadAccountDeletion = () => apiGet<{
    blocked: boolean;
    reasons: Array<'open_contract' | 'open_agent_contract' | 'unpaid_bill' | 'bill_awaiting_review' | 'unrefunded_deposit'>;
    scheduledFor: string | null;
    deleteNowAvailable?: boolean;
  }>('/auth/account/deletion');
  useEffect(() => {
    if (!isAuthenticated) {
      setDeletionScheduledFor(null);
      return;
    }
    let cancelled = false;
    loadAccountDeletion()
      .then((preview) => { if (!cancelled) setDeletionScheduledFor(preview.scheduledFor); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, session?.email]);
  const proveAccountPassword = async (password: string, captchaToken?: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured() || !session?.email) {
      throw Object.assign(new Error(), { code: 'SUPABASE_NOT_CONFIGURED' });
    }
    await confirmCurrentPassword(supabase, session.email, password, captchaToken);
  };
  const deleteAccount = async (proof: { password: string; captchaToken?: string }) => {
    await proveAccountPassword(proof.password, proof.captchaToken);
    await apiDelete('/auth/account');
    await signOut();
    // QA B4: say it is done and land on the home page as a guest (like signing out, without the login page).
    setDrawerOpen(false);
    setPartyInbox(false);
    setSelectedPartyRoom(null);
    setOpenedPartyContract(null);
    setDeletionScheduledFor(null);
    setActiveRole('guest');
    setActiveTab(getDefaultTabForRole('guest'));
    const done = t.mobile.account.deleteAccountDone;
    // react-native-web's Alert does nothing, so the browser's own dialog says it on the web.
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(done);
    else Alert.alert(t.mobile.account.deleteAccount, done);
  };
  const scheduleAccountDeletion = async (proof: { password: string; captchaToken?: string }) => {
    await proveAccountPassword(proof.password, proof.captchaToken);
    const result = await apiPost<{ scheduledFor: string }>('/auth/account/deletion', {});
    setDeletionScheduledFor(result.scheduledFor);
    setDrawerOpen(false);
    setActiveTab('dashboard');
  };
  const cancelAccountDeletion = async () => {
    await apiDelete('/auth/account/deletion');
    setDeletionScheduledFor(null);
  };

  const handleAuthAction = async () => {
    setDrawerOpen(false);
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    try {
      await signOut();
      setPartyInbox(false);
      setSelectedPartyRoom(null);
      setOpenedPartyContract(null);
      setActiveRole('guest');
      setActiveTab(getDefaultTabForRole('guest'));
      Alert.alert(t.common.signOut, t.mobile.auth.signedOut);
      router.replace(AFTER_SIGN_OUT_PATH);
    } catch {
      setPartyInbox(false);
      setSelectedPartyRoom(null);
      setOpenedPartyContract(null);
      setActiveRole('guest');
      setActiveTab(getDefaultTabForRole('guest'));
      Alert.alert(t.common.signOut, t.mobile.auth.signedOut);
      router.replace(AFTER_SIGN_OUT_PATH);
    }
  };

  /** Web account menu: "Sign out of all devices". Throws if Supabase cannot be reached (the dialog shows it). */
  const handleSignOutEverywhere = async () => {
    await signOutEverywhere();
    setDrawerOpen(false);
    setPartyInbox(false);
    setSelectedPartyRoom(null);
    setOpenedPartyContract(null);
    setActiveRole('guest');
    setActiveTab(getDefaultTabForRole('guest'));
    router.replace(AFTER_SIGN_OUT_PATH);
  };

  const handleRequireAuth = () => {
    setDrawerOpen(false);
    Alert.alert(t.common.signIn, t.mobile.auth.signInToContinue, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.signIn, onPress: () => router.push('/login') },
    ]);
  };

  const isWizardTab =
    activeTab === 'createListing' ||
    activeTab === 'createLead' ||
    activeTab === 'leadInfo' ||
    (activeTab === 'clients' && creatingTenant);

  const onPageRefresh =
    isTenantWorkspace || (partyInbox && activeRole !== 'agent') ||
    (isLandlordWeb && (activeTab === 'dashboard' || activeTab === 'income')) ||
    (isTenantWeb && (activeTab === 'dashboard' || activeTab === 'bills')) ||
    (!partyInbox && !isWizardTab && activeRole === 'agent' &&
      ['dashboard', 'listingLead', 'listingRoom', 'calendar'].includes(activeTab))
      ? handlePageRefresh : undefined;

  const tenantActiveId = tenantWebActiveId({ partyInbox, activeTab });
  const tenantNavSections = (['main', 'more'] as const).map((section) => ({
    id: section,
    caption: section === 'main' ? t.tenant.webWorkspace.main : t.mobile.tabs.more,
    items: TENANT_WEB_MENU.filter((item) => item.section === section).map((item) => {
      const label = tenantWebLabel(item.id, t.mobile);
      const soon = item.target.type === 'soon';
      return {
        id: item.id,
        icon: item.icon,
        label,
        active: tenantActiveId === item.id,
        disabled: soon,
        badge: soon ? t.agent.dashboard.comingSoon : undefined,
        title: soon ? `${label} · ${t.agent.dashboard.comingSoon}` : label,
        onPress: () => openTenantDestination(item),
      };
    }),
  }));
  const landlordActiveId = landlordWebActiveId({ partyInbox, contractHistory, activeTab });
  const landlordNavSections = (['main', 'more'] as const).map((section) => ({
    id: section,
    caption: section === 'main' ? t.owner.webWorkspace.main : t.mobile.tabs.more,
    items: LANDLORD_WEB_MENU.filter((item) => item.section === section).map((item) => {
      const label = landlordWebLabel(item.id, t.mobile);
      const soon = item.target.type === 'soon';
      return {
        id: item.id,
        icon: item.icon,
        label,
        active: landlordActiveId === item.id,
        disabled: soon,
        badge: soon ? t.agent.dashboard.comingSoon : undefined,
        title: soon ? `${label} · ${t.agent.dashboard.comingSoon}` : label,
        onPress: () => openLandlordDestination(item),
      };
    }),
  }));

  return (
    <>
      <AgentWorkspace
        enabled={isDesktopWeb}
        activeRole={isLandlordWeb ? 'landlord' : isTenantWeb ? 'tenant' : 'agent'}
        brandTag={isLandlordWeb ? t.owner.webWorkspace.brandTag : isTenantWeb ? t.tenant.webWorkspace.brandTag : undefined}
        workspaceLabel={isLandlordWeb ? t.owner.webWorkspace.workspaceLabel : isTenantWeb ? t.tenant.webWorkspace.workspaceLabel : undefined}
        navSections={isLandlordWeb ? landlordNavSections : isTenantWeb ? tenantNavSections : undefined}
        navigationDisabled={createLeadBusy || createTenantBusy || tenantDetail.saving}
        activeTab={activeTab}
        onRefresh={onPageRefresh}
        refreshing={pageRefreshing}
        onNavigate={handleTabPress}
        onCreate={isAgentWeb ? openWebCreate : undefined}
        creating={creatingTenant ? 'tenant' : null}
        onRoleChange={handleRoleChange}
        allowedRoles={isAuthenticated ? portalSwitcherRoles(session?.roles) : undefined}
        otherSiteRoles={isAuthenticated ? otherSiteRoles(session?.roles) : undefined}
        notificationsEmptyLabel={t.agent.dashboard.comingSoon}
        onSignOut={handleAuthAction}
        onSignOutEverywhere={isAuthenticated ? handleSignOutEverywhere : undefined}
        userName={profileName}
        userEmail={profileEmail}
        userPhone={profilePhone}
        avatarUrl={isAuthenticated ? session?.avatarUrl : null}
        onSaveProfile={saveProfile}
        onUploadAvatar={uploadAvatar}
        onRemoveAvatar={removeAvatar}
        onChangePassword={isAuthenticated ? changePassword : undefined}
        onLoadAccountDeletion={accountDeletionMenu ? loadAccountDeletion : undefined}
        onDeleteAccount={accountDeletionMenu ? deleteAccount : undefined}
        onScheduleAccountDeletion={accountDeletionMenu ? scheduleAccountDeletion : undefined}
        onCancelAccountDeletion={accountDeletionMenu ? cancelAccountDeletion : undefined}
        initials={profileInitials}
        notificationCount={unreadCount}
        notificationsOpen={notificationsOpen}
        onNotificationsOpen={() => setNotificationsOpen(true)}
        onNotificationsClose={() => setNotificationsOpen(false)}
        activityItems={notifications}
        messageItems={messages}
        onNotificationsClear={() => setNotificationsRead(true)}
      >
      <Page
        role={activeRole}
        backgroundColor={isTenantWorkspace ? theme.surface : undefined}
        screenTitle={screenTitle}
        scrollable={partyInbox || !isWizardTab}
        refreshing={pageRefreshing}
        onRefresh={onPageRefresh}
        header={
          activeRole === 'agent' ? (
            renderAgentHeader()
          ) : isLandlordWeb && !selectedPartyRoom ? (
            null
          ) : isTenantWeb && !partyInbox && activeTab !== 'bills' ? (
            null
          ) : partyInbox ? (
            <SectionHeader
              title={
                selectedPartyRoom?.tenant
                  ? selectedPartyRoom.tenant
                  : selectedPartyRoom
                  ? (selectedPartyRoom.room
                      ? t.mobile.partyContracts.room.replace('{room}', selectedPartyRoom.room)
                      : selectedPartyRoom.property)
                  : contractHistory
                    ? tenantWorkspaceCopy(locale)[partyRole === 'owner' ? 'tenantHistory' : 'roomHistory']
                    : partyRole === 'owner'
                      ? tenantWorkspaceCopy(locale).contractsAndTenants
                      : tenantWorkspaceCopy(locale).myContracts
              }
              workspaceLabel={
                selectedPartyRoom?.tenant
                  ? [selectedPartyRoom.property, selectedPartyRoom.room
                      ? t.mobile.partyContracts.room.replace('{room}', selectedPartyRoom.room)
                      : null].filter(Boolean).join(' · ')
                  : selectedPartyRoom?.room
                  ? selectedPartyRoom.property
                  : contractHistory
                    ? partyRole === 'owner'
                      ? tenantWorkspaceCopy(locale).ownerWorkspace
                      : tenantWorkspaceCopy(locale).myContracts
                    : partyRole === 'owner'
                      ? tenantWorkspaceCopy(locale).ownerWorkspace
                      : t.roles[CONTRACT_PARTY_ROLE[partyRole]]
              }
              accentColor={partyAccent}
              leading={
                selectedPartyRoom || (contractHistory && partyRole !== "owner")
                  ? "back"
                  : "menu"
              }
              onBackPress={() => {
                setOpenedPartyContract(null);
                if (selectedPartyRoom?.tenant && !contractHistory) {
                  setSelectedPartyRoom({ ...selectedPartyRoom, tenant: null });
                } else if (selectedPartyRoom) setSelectedPartyRoom(null);
                else if (contractHistory && partyRole === 'owner') {
                  setContractHistory(false);
                  setPartyInbox(false);
                } else setContractHistory(false);
              }}
              onMenuPress={() => setDrawerOpen(true)}
              onActionPress={
                partyRole === 'tenant' && !selectedPartyRoom && !contractHistory
                  ? () => {
                      setOpenedPartyContract(null);
                      setSelectedPartyRoom(null);
                      setContractHistory(true);
                    }
                  : undefined
              }
              actionLabel={
                partyRole === 'tenant' && !selectedPartyRoom && !contractHistory
                  ? tenantWorkspaceCopy(locale).roomHistory
                  : undefined
              }
              actionIcon="archive"
              actionVariant="icon"
            />
          ) : isTenantWorkspace ? (
            <SectionHeader
              title={
                selectedBillRoom
                  ? (selectedBillRoom.room
                      ? t.mobile.partyContracts.room.replace('{room}', selectedBillRoom.room)
                      : selectedBillRoom.property)
                  : billHistory
                    ? tenantWorkspaceCopy(locale).paymentHistory
                    : t.mobile.tabs.bills
              }
              workspaceLabel={
                selectedBillRoom?.room
                  ? selectedBillRoom.property
                  : billHistory
                    ? t.mobile.tabs.bills
                    : t.roles.tenant
              }
              accentColor={tokens.colors.roles.tenant}
              leading={billHistory || selectedBillRoom ? 'back' : 'menu'}
              onBackPress={() => {
                if (selectedBillRoom) setSelectedBillRoom(null);
                else setBillHistory(false);
              }}
              onMenuPress={() => setDrawerOpen(true)}
              onActionPress={
                !billHistory && !selectedBillRoom
                  ? () => {
                      setSelectedBillRoom(null);
                      setBillHistory(true);
                    }
                  : undefined
              }
              actionLabel={!billHistory && !selectedBillRoom ? tenantWorkspaceCopy(locale).paymentHistory : undefined}
              actionIcon="archive"
              actionVariant="icon"
            />
          ) : (
            <MobileHeaderActions
              initials={profileInitials}
              isAuthenticated={isAuthenticated}
              notificationCount={unreadCount}
              onAvatarPress={() => setDrawerOpen(true)}
              onNotificationsPress={() => setNotificationsOpen(true)}
            />
          )
        }
        bottomBar={
          activeTab === 'leadRoom' && activeLead && activeMatch ? (
            <LeadRoomActions
              lead={activeLead}
              match={activeMatch}
              viewing={leadRoomViewing.viewing}
              ready={leadRoomViewing.ready}
              onViewingSaved={leadRoomViewing.onSaved}
              onReserved={handleRoomReserved}
              onContinue={(tenant, next) =>
                openTenantPage({
                  tenantId: tenant.id,
                  tenant,
                  startContract: next === 'reservation' ? 'reservation' : null,
                })
              }
              onOpenTenant={(tenantId) => openTenantPage({ tenantId })}
            />
          ) : isTenantDetail && tenantDetail.editing ? (
            <TenantEditBar
              saving={tenantDetail.saving}
              error={tenantDetail.error}
              onCancel={() => tenantDetailActionsRef.current?.back()}
              onSave={() => tenantDetailActionsRef.current?.save()}
            />
          ) : null
        }
        tabBar={
          isDesktopWeb || ['createListing', 'createLead', 'leadDetail', 'leadInfo', 'leadRoom'].includes(activeTab) ||
          (activeTab === 'clients' && creatingTenant) ||
          isTenantDetail ? null : (
            <MobileBottomTabBar
              activeRole={activeRole}
              activeTab={activeRole === 'tenant' && partyInbox ? 'menu' : activeTab}
              onTabPress={handleTabPress}
              accentColor={accentColor}
              {...(activeRole === 'agent' || isTenantWorkspace
                ? {
                    activeTintColor: theme.screenTitle,
                    indicatorColor: tokens.colors.brand[500],
                  }
                : {})}
            />
          )
        }
      >
        <React.Fragment key={`${activeRole}-${activeTab}-${partyInbox ? 'inbox' : 'tab'}`}>
          {partyInbox ? (
            <PartyContractsScreen
              mode={partyRole}
              opened={openedPartyContract}
              onOpenedChange={setOpenedPartyContract}
              selectedRoom={selectedPartyRoom}
              onSelectedRoomChange={setSelectedPartyRoom}
              history={contractHistory}
              accentColor={partyAccent}
              reloadToken={partyContractsReloadToken}
              onReloadSettled={finishPageRefresh}
              onRefresh={activeRole !== 'agent' ? handlePageRefresh : undefined}
            />
          ) : (
            renderTabBody()
          )}
          {activeRole === 'guest' && (activeTab === 'home' || activeTab === 'search' || activeTab === 'services') ? (
            <GuestPublicFooter />
          ) : null}
        </React.Fragment>
      </Page>
      </AgentWorkspace>

      <MobileProfileDrawer
        visible={!isDesktopWeb && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={profileName}
        userEmail={profileEmail}
        userPhone={profilePhone}
        avatarUri={isAuthenticated ? session?.avatarUrl : null}
        onSaveProfile={saveProfile}
        onUploadAvatar={uploadAvatar}
        onRemoveAvatar={removeAvatar}
        onChangePassword={isAuthenticated ? changePassword : undefined}
        onLoadAccountDeletion={accountDeletionMenu ? loadAccountDeletion : undefined}
        onDeleteAccount={accountDeletionMenu ? deleteAccount : undefined}
        onScheduleAccountDeletion={accountDeletionMenu ? scheduleAccountDeletion : undefined}
        onCancelAccountDeletion={accountDeletionMenu ? cancelAccountDeletion : undefined}
        captcha={passwordCaptchaRequired ? <HcaptchaField resetKey={passwordCaptchaKey} onToken={setPasswordCaptchaToken} /> : undefined}
        captchaRequired={passwordCaptchaRequired}
        captchaToken={passwordCaptchaToken}
        onCaptchaReset={() => { setPasswordCaptchaToken(null); setPasswordCaptchaKey((key) => key + 1); }}
        initials={profileInitials}
        activeRole={activeRole}
        isAuthenticated={isAuthenticated}
        onRequireAuth={handleRequireAuth}
        onRoleChange={(role) => {
          handleRoleChange(role);
        }}
        allowedRoles={isAuthenticated && session ? portalSwitcherRoles(session.roles) : undefined}
        onSignOut={handleAuthAction}
        signOutLabel={isAuthenticated ? t.common.signOut : t.common.signIn}
        onMenuAction={(action) => {
          if (action.type === 'tab') {
            setActiveTab(action.tab);
            return;
          }
          if (action.type === 'route') {
            if (action.path === '/landlord/tenants') {
              openPartyInbox(true);
              return;
            }
            if (action.path === '/tenant/contract' || action.path === '/landlord/contracts') {
              openPartyInbox(false);
              return;
            }
            Alert.alert(t.mobile.demoAlerts.comingSoon);
            return;
          }
          Alert.alert(t.mobile.demoAlerts.comingSoon);
        }}
      />

      <MobileNotificationsPanel
        visible={!isDesktopWeb && notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      >
        <MobileNotificationsBody
          activityItems={notifications}
          messageItems={messages}
          emptyLabel={t.agent.dashboard.comingSoon}
          onBack={() => setNotificationsOpen(false)}
          onClearAll={() => {
            setNotificationsRead(true);
          }}
        />
      </MobileNotificationsPanel>
    </>
  );
}

const styles = StyleSheet.create({
  bodyContainer: { gap: 16 },
  wizardBody: { flex: 1, minHeight: 0, gap: 0 },
  // CreateLeadForm owns its padding and edge-to-edge footer; cancel MobileModePage body padding.
  fullBleedBody: { marginVertical: Platform.OS === 'web' ? 0 : -16, marginHorizontal: Platform.OS === 'web' ? 0 : -16 },
  card: {},
  sectionHeader: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  sectionDesc: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  listingSectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    marginTop: 8,
  },
  listingCard: {
    gap: 6,
  },
  listingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listingPrice: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: tokens.colors.primary,
  },
  listingTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  listingSub: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  listingActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    color: tokens.colors.primary,
  },
});

/** Route "/". Mobile renders the app shell here. Web renders nothing: the root layout hosts the shell (WebAppHost). */
export default function IndexRoute() {
  return Platform.OS === 'web' ? null : <AppHomeScreen />;
}
