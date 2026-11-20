import type React from "react";
import type { AppIconName, MobileAppTab, MobileNotificationItem } from "@nestyk/ui/native";
import type { UserRole } from "@nestyk/types";
import type { SettingsSection } from "../../lib/app-routes";

export type AgentWebCreateKind = "room" | "lead" | "tenant";

export interface WorkspaceNavItem {
  id: string;
  icon: AppIconName;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  title?: string;
  onPress: () => void;
  /**
   * Sub-pages (self owner "rooms and listings", Jom 20 Nov 2026): the item becomes a group like the agent's Listing.
   * It folds open and closed; on the folded (icon) sidebar `onPress` runs instead. Mark the current sub-page `active`.
   */
  children?: WorkspaceNavItem[];
}

export interface WorkspaceNavSection {
  id: string;
  caption: string;
  items: WorkspaceNavItem[];
}

export interface AgentWorkspaceProps {
  enabled: boolean;
  /** Shown in the account menu. Defaults to the agent workspace. */
  activeRole?: UserRole;
  brandTag?: string;
  workspaceLabel?: string;
  /** When set, replaces the agent sidebar. The agent menu stays the default. */
  navSections?: WorkspaceNavSection[];
  activeTab: MobileAppTab;
  navigationDisabled?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onNavigate: (tab: MobileAppTab) => void;
  /** Agent "+ Create" menu and the sidebar create links (add room, create lead, create tenant). Omit to hide them. */
  onCreate?: (kind: AgentWebCreateKind) => void;
  /** A create flow open inside the current tab (today only "tenant" inside Tenants), so the sidebar marks it. */
  creating?: AgentWebCreateKind | null;
  /** The add-lead page is editing an existing lead: the top bar says "Edit lead" (F3). */
  editingLead?: boolean;
  onRoleChange: (role: UserRole) => void;
  /** Roles the signed-in account holds; the role switcher lists only these (plus the active role). Omitted = every role. */
  allowedRoles?: readonly string[];
  /** Roles in `allowedRoles` that open on another site (web portal, lib/route-access.ts): marked in the switcher. */
  otherSiteRoles?: readonly string[];
  onSignOut: () => void;
  /** "Sign out of all devices" (web account menu). Rejects when it could not reach Supabase; the menu shows the error. */
  onSignOutEverywhere?: () => Promise<void>;
  /** Settings page section (Mos 18 Nov 2026), shown in place of the page while set; any menu choice closes it. */
  settingsSection?: SettingsSection | null;
  onOpenSettings?: (section: SettingsSection) => void;
  /** The signed-in account has the admin role: it cannot delete itself (settings A2, review R1). */
  adminAccount?: boolean;
  onCloseSettings?: () => void;
  userName: string;
  userEmail: string;
  userPhone?: string;
  avatarUrl?: string | null;
  onSaveProfile?: (input: { firstName: string; lastName: string; phone: string | null }) => Promise<void>;
  onUploadAvatar?: (photo: { uri: string; name: string; mimeType: string; file?: Blob }) => Promise<string>;
  onRemoveAvatar?: () => Promise<void>;
  onChangePassword?: (input: { currentPassword: string; newPassword: string; captchaToken?: string }) => Promise<void>;
  onLoadAccountDeletion?: () => Promise<{ blocked: boolean; reasons: Array<'open_contract' | 'open_agent_contract' | 'unpaid_bill' | 'bill_awaiting_review' | 'unrefunded_deposit'>; scheduledFor: string | null; deleteNowAvailable?: boolean }>;
  onDeleteAccount?: (proof: { password: string; captchaToken?: string }) => Promise<void>;
  onScheduleAccountDeletion?: (proof: { password: string; captchaToken?: string }) => Promise<void>;
  onCancelAccountDeletion?: () => Promise<void>;
  initials: string;
  notificationCount: number;
  /** Text for an empty notification list. Defaults to the generic "no data" text. */
  notificationsEmptyLabel?: string;
  notificationsOpen: boolean;
  onNotificationsOpen: () => void;
  onNotificationsClose: () => void;
  activityItems: MobileNotificationItem[];
  messageItems: MobileNotificationItem[];
  onNotificationsClear: () => void;
  children: React.ReactNode;
}
