import type React from "react";
import type { AppIconName, MobileAppTab, MobileNotificationItem } from "@nestyk/ui/native";
import type { UserRole } from "@nestyk/types";

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
  onRoleChange: (role: UserRole) => void;
  /** Roles the signed-in account holds; the role switcher lists only these (plus the active role). Omitted = every role. */
  allowedRoles?: readonly string[];
  onSignOut: () => void;
  /** "Sign out of all devices" (web account menu). Rejects when it could not reach Supabase; the menu shows the error. */
  onSignOutEverywhere?: () => Promise<void>;
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
