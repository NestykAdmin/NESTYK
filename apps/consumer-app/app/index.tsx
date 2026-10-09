import { AgentCalendarScreen, emptyCalendarDraft } from '../components/AgentCalendarScreen';
import { calendarDateKey, createCalendarDemoEvents, type CalendarDemoEvent } from '../lib/agent-calendar-demo';
import { calendarViewingRange, viewingToCalendarEvent } from '../lib/agent-calendar-viewings';
import { getAgentLead, listAgentViewings } from '../lib/agent-leads-api';
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
import { TenantNextBillCard } from '../components/TenantNextBillCard';
import { OwnerConfirmedRent } from '../components/OwnerConfirmedRent';
import { AgentLeadsScreen } from '../components/AgentLeadsScreen';
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
import { View, Text, StyleSheet, Alert, BackHandler } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useLocale } from '@nestyk/i18n';
import {
  MobileModePage,
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
  tokens,
} from '@nestyk/ui/native';
import { UserRole, type AgentLead, type AgentTenant, type PartyContract } from '@nestyk/types';
import {
  MobileCreateListingWizardBody,
  MobileAgentDashboardBody,
  createAgentDashboardDemoFixture,
  defaultOwnerListingConfig,
  defaultAgentListingConfig,
  type AgentDashboardDeepLink,
} from '@nestyk/feature-listing';
import { MobileServiceCatalogBody } from '@nestyk/feature-services';
import { createAgentScoutRoom, fetchAgentContacts, fetchAgentPropertyTypes, fetchAgentContractTypes, fetchAgentRoomTypes, fetchAgentFacilities, generateListingPromo } from '../lib/agent-listings-api';
import { pickRoomPhotos, uploadRoomPhoto, enhanceRoomPhoto } from '../lib/room-photos';
import { searchPlaces, getPlaceDetails, searchNearbyPlaces, reverseMapLocation } from '../lib/places-api';
import { useAuth } from '../lib/auth/AuthContext';
import { APP_CONFIG } from '../lib/config';
import {
  consumeGuestBrowse,
  consumePendingRole,
  roleRequiresAuth,
  setPendingRole,
} from '../lib/auth/role-gate';
import {
  MOCK_LISTINGS,
  MOCK_ACTIVITY_NOTIFICATIONS,
  MOCK_MESSAGE_NOTIFICATIONS,
  MOCK_SERVICE_TICKETS,
  type DemoNotification,
} from '../lib/mock-data';
import { localeTag } from '../lib/lead-format';

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

export default function AppHomeScreen() {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const router = useRouter();
  const { ready, isAuthenticated, session, displayName, initials, signOut } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRole>(APP_CONFIG.defaultRole);
  const [calendarEvents, setCalendarEvents] = useState(createCalendarDemoEvents);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => calendarDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => calendarDateKey(new Date()).slice(0, 7) + '-01');
  const [calendarDraft, setCalendarDraft] = useState(emptyCalendarDraft);
  const [calendarViewings, setCalendarViewings] = useState<CalendarDemoEvent[]>([]);
  const [activeTab, setActiveTab] = useState<MobileAppTab>(() =>
    getDefaultTabForRole(APP_CONFIG.defaultRole),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [partyInbox, setPartyInbox] = useState(false);
  const [selectedPartyRoom, setSelectedPartyRoom] = useState<PartyContractRoom | null>(null);
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
    return [show(MOCK_ACTIVITY_NOTIFICATIONS), show(MOCK_MESSAGE_NOTIFICATIONS)];
  }, [t, locale, notificationsRead]);
  const [createLeadBusy, setCreateLeadBusy] = useState(false);
  const [leadsWorkFilter, setLeadsWorkFilter] = useState<'lead_follow_up' | null>(null);
  const [clientsWorkFilter, setClientsWorkFilter] = useState<
    'overdue_payment' | 'awaiting_signature' | 'renewal' | 'lead_follow_up' | null
  >(null);
  const [clientsView, setClientsView] = useState<TenantListView>('work');
  const clearClientsWorkFilter = useCallback(() => setClientsWorkFilter(null), []);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [pageRefreshing, setPageRefreshing] = useState(false);
  const refreshSequence = useRef(0);
  const pendingRefresh = useRef<number | null>(null);
  const [leadsReloadToken, setLeadsReloadToken] = useState(0);
  const [roomsReloadToken, setRoomsReloadToken] = useState(0);
  const [creatingTenant, setCreatingTenant] = useState(false);
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

  const calendarOpen = activeTab === 'calendar' && activeRole === 'agent';
  useEffect(() => {
    if (!calendarOpen) return;
    let active = true;
    const { from, to } = calendarViewingRange(calendarMonth);
    listAgentViewings(from, to)
      .then((rows) => {
        if (active) setCalendarViewings(rows.map(viewingToCalendarEvent));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [calendarOpen, calendarMonth]);

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
    } else if (hostOrPath.includes('owner')) {
      setActiveRole('owner');
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

  const goBackFromSecondary = useCallback(() => {
    const fallback: MobileAppTab =
      activeTab === 'createLead'
        ? 'listingLead'
        : activeRole === 'owner'
          ? 'listings'
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
    if (!partyInbox || !selectedPartyRoom || openedPartyContract) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedPartyRoom(null);
      return true;
    });
    return () => sub.remove();
  }, [partyInbox, selectedPartyRoom, openedPartyContract]);

  const handleRoleChange = (role: UserRole) => {
    if (roleRequiresAuth(role) && !isAuthenticated) {
      setPendingRole(role);
      setDrawerOpen(false);
      router.push('/login');
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
      if (pending && roleRequiresAuth(pending)) {
        setActiveRole(pending);
        setActiveTab(getDefaultTabForRole(pending));
      }
      return;
    }

    if (consumeGuestBrowse()) {
      setActiveRole('guest');
      setActiveTab(getDefaultTabForRole('guest'));
      return;
    }

    if (roleRequiresAuth(activeRole)) {
      router.replace('/login');
    }
  }, [ready, isAuthenticated, activeRole, router]);

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

  const screenTitle =
    activeRole === 'agent' || partyInbox
      ? undefined
      : getScreenTitle(activeTab, t);
  const partyRole = activeRole === 'tenant' ? 'tenant' : 'owner';

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

    if (agentSectionTabs.includes(activeTab)) {
      const isCreateLead = activeTab === 'createLead';
      const isCreateTenant = activeTab === 'clients' && creatingTenant;
      const isLeadPage = activeTab === 'leadDetail' || activeTab === 'leadInfo' || activeTab === 'leadRoom';
      const hasLeadMenu = activeTab === 'leadDetail' || activeTab === 'leadRoom';
      const isSecondary =
        activeTab === 'createListing' || isCreateLead || isCreateTenant || isTenantDetail || isLeadPage;
      const canEditTenant = isTenantDetail && tenantDetail.canEdit;

      return (
        <MobileSectionHeader
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
          setActiveTab('services');
          return;
        case 'viewContacts':
          setActiveTab('contact');
          return;
        case 'viewContracts':
          setActiveTab('contracts');
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

  const agentDashboardSnapshot = useMemo(() => {
    const dateLabel = new Date().toLocaleDateString(
      locale === 'th' ? 'th-TH' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-GB',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    );
    // Prefer a person-facing first name; avoid treating "Admin" as the role label.
    const raw = (displayName || '').trim();
    const first = raw.split(/\s+/)[0] || '';
    const greetingName =
      !first || first.toLowerCase() === 'admin' || raw === t.roles.guest
        ? (session?.email?.split('@')[0] || t.roles.agent)
        : first;
    return createAgentDashboardDemoFixture({
      greetingName,
      localDateLabel: dateLabel,
    });
  }, [displayName, locale, session?.email, t.roles.agent, t.roles.guest, dashboardRefreshKey]);

  const finishPageRefresh = useCallback((token: number) => {
    if (pendingRefresh.current !== token) return;
    pendingRefresh.current = null;
    setPageRefreshing(false);
  }, []);

  useEffect(() => {
    // A completion from a previous tab/role must never stop a newer refresh.
    pendingRefresh.current = null;
    setPageRefreshing(false);
  }, [activeRole, activeTab, partyInbox]);

  useEffect(() => {
    // Demo data is synchronous: finish after the new snapshot is committed.
    // Replace this with the dashboard request's settlement when its API is connected.
    if (activeRole === 'agent' && activeTab === 'dashboard' && dashboardRefreshKey > 0) {
      finishPageRefresh(dashboardRefreshKey);
    }
  }, [agentDashboardSnapshot, dashboardRefreshKey, activeRole, activeTab, finishPageRefresh]);

  const handlePageRefresh = useCallback(() => {
    if (pendingRefresh.current !== null) return;
    const token = ++refreshSequence.current;
    pendingRefresh.current = token;
    setPageRefreshing(true);
    if (partyInbox && activeRole !== 'agent') {
      setPartyContractsReloadToken(token);
    } else if (activeRole === 'agent' && activeTab === 'dashboard') {
      setDashboardRefreshKey(token);
    } else if ((activeRole === 'tenant' || activeRole === 'owner') && activeTab === 'dashboard') {
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
      <TenantBillsScreen reloadToken={billsReloadToken} onReloadSettled={finishPageRefresh} />
    </View>
  );

  const renderDashboardBody = () => {
    if (activeRole === 'agent') {
      return (
        <View style={styles.bodyContainer}>
          <MobileAgentDashboardBody
            snapshot={agentDashboardSnapshot}
            onNavigate={handleAgentDashboardNavigate}
            initials={profileInitials}
          />
        </View>
      );
    }
    const summaries: Record<UserRole, { title: string; desc: string; badge: string }> = {
      guest: { title: 'Welcome to NESTYK', desc: 'Browse rooms and schedule viewings nearby.', badge: 'Guest' },
      tenant: { title: 'Tenant Dashboard', desc: '', badge: 'Active Lease' },
      owner: { title: 'Owner Dashboard', desc: '3 active listings · 2 tenants occupied', badge: '3 Listings' },
      agent: { title: 'Agent Dashboard', desc: '24 co-broke listings · 45,000 THB commission', badge: 'Partner' },
      admin: { title: 'Operations Dashboard', desc: 'Pending tickets: 3 · Inspections today: 2', badge: 'Ops' },
    };
    const summary = summaries[activeRole];
    return (
      <View style={styles.bodyContainer}>
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
          ) : activeRole === 'owner' ? (
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

    if (activeTab === 'living') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <View style={styles.listingTopRow}>
              <Text style={[styles.sectionHeader, headingText]}>My Rental</Text>
              <MobileBadge role="tenant" label="Active Lease" />
            </View>
            <Text style={[styles.listingTitle, headingText]}>The Base Sukhumvit 77 (Room 1804)</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>Lease: Sep 1, 2026 – Aug 31, 2027 (12 months left)</Text>
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
      return <AgentCalendarScreen
        events={[...calendarViewings, ...calendarEvents]}
        onAdd={event => setCalendarEvents(previous => [...previous, event])}
        selectedDate={calendarSelectedDate}
        onSelectDate={setCalendarSelectedDate}
        visibleMonth={calendarMonth}
        onMonthChange={setCalendarMonth}
        draft={calendarDraft}
        onDraftChange={setCalendarDraft}
      />;
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
      return (
        <Animated.View
          entering={FadeIn.duration(150)}
          style={[styles.wizardBody, styles.fullBleedBody]}
        >
          {leadEdit && activeLead ? (
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
            />
          ) : (
            <CreateLeadForm
              onBusy={setCreateLeadBusy}
              onSaved={() => {
                Alert.alert(t.agent.leads.saved);
                setSecondaryReturnTab(null);
                setActiveTab('listingLead');
              }}
            />
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

    if (activeTab === 'listings') {
      if (activeRole === 'owner') {
        return (
          <View style={[styles.bodyContainer, styles.wizardBody]}>
            <MobileCreateListingWizardBody
              config={defaultOwnerListingConfig}
              searchPlaces={handleSearchPlaces}
              getPlaceDetails={handleGetPlaceDetails}
              onSubmitListing={() => Alert.alert(t.mobile.demoAlerts.listingPublished)}
            />
          </View>
        );
      }
    }

    return null;
  };

  const profileName = isAuthenticated ? displayName : t.roles.guest;
  const profileEmail = isAuthenticated ? session!.email : t.common.signIn;
  const profilePhone = isAuthenticated ? session?.phone ?? undefined : undefined;
  const profileInitials = isAuthenticated ? initials : '?';

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
    } catch {
      setPartyInbox(false);
      setSelectedPartyRoom(null);
      setOpenedPartyContract(null);
      setActiveRole('guest');
      setActiveTab(getDefaultTabForRole('guest'));
      Alert.alert(t.common.signOut, t.mobile.auth.signedOut);
    }
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
    (activeTab === 'clients' && creatingTenant) ||
    (activeTab === 'listings' && activeRole === 'owner');

  return (
    <>
      <MobileModePage
        role={activeRole}
        screenTitle={screenTitle}
        scrollable={partyInbox || !isWizardTab}
        refreshing={pageRefreshing}
        onRefresh={
          (partyInbox && activeRole !== 'agent') ||
          (!partyInbox && !isWizardTab && activeRole === 'agent' &&
          ['dashboard', 'listingLead', 'listingRoom'].includes(activeTab))
            ? handlePageRefresh : undefined
        }
        header={
          activeRole === 'agent' ? (
            renderAgentHeader()
          ) : partyInbox ? (
            <MobileSectionHeader
              title={
                selectedPartyRoom
                  ? (selectedPartyRoom.room
                      ? t.mobile.partyContracts.room.replace('{room}', selectedPartyRoom.room)
                      : selectedPartyRoom.property)
                  : t.mobile.partyContracts.title
              }
              workspaceLabel={
                selectedPartyRoom?.room ? selectedPartyRoom.property : t.roles[partyRole]
              }
              accentColor={tokens.colors.roles[partyRole]}
              leading={selectedPartyRoom ? "back" : "menu"}
              onBackPress={() => {
                setOpenedPartyContract(null);
                setSelectedPartyRoom(null);
              }}
              onMenuPress={() => setDrawerOpen(true)}
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
          ['createListing', 'createLead', 'leadDetail', 'leadInfo', 'leadRoom'].includes(activeTab) ||
          (activeTab === 'clients' && creatingTenant) ||
          isTenantDetail ? null : (
            <MobileBottomTabBar
              activeRole={activeRole}
              activeTab={activeTab}
              onTabPress={handleTabPress}
              accentColor={accentColor}
              {...(activeRole === 'agent'
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
              opened={openedPartyContract}
              onOpenedChange={setOpenedPartyContract}
              selectedRoom={selectedPartyRoom}
              onSelectedRoomChange={setSelectedPartyRoom}
              accentColor={tokens.colors.roles[partyRole]}
              reloadToken={partyContractsReloadToken}
              onReloadSettled={finishPageRefresh}
              onRefresh={activeRole !== 'agent' ? handlePageRefresh : undefined}
            />
          ) : (
            renderTabBody()
          )}
        </React.Fragment>
      </MobileModePage>

      <MobileProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={profileName}
        userEmail={profileEmail}
        userPhone={profilePhone}
        initials={profileInitials}
        activeRole={activeRole}
        isAuthenticated={isAuthenticated}
        onRequireAuth={handleRequireAuth}
        onRoleChange={(role) => {
          handleRoleChange(role);
        }}
        onSignOut={handleAuthAction}
        signOutLabel={isAuthenticated ? t.common.signOut : t.common.signIn}
        onMenuAction={(action) => {
          if (action.type === 'tab') {
            setActiveTab(action.tab);
            return;
          }
          if (action.type === 'route') {
            if (action.path === '/tenant/contract' || action.path === '/owner/contracts') {
              setDrawerOpen(false);
              setOpenedPartyContract(null);
              setSelectedPartyRoom(null);
              setPartyInbox(true);
              return;
            }
            Alert.alert(t.mobile.demoAlerts.comingSoon);
            return;
          }
          Alert.alert(t.mobile.demoAlerts.comingSoon);
        }}
      />

      <MobileNotificationsPanel
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      >
        <MobileNotificationsBody
          activityItems={notifications}
          messageItems={messages}
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
  fullBleedBody: { margin: -16 },
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
