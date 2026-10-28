import type React from "react";
import type { AppIconName, MobileAppTab, MobileNotificationItem } from "@nestyk/ui/native";
import type { UserRole } from "@nestyk/types";

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
  onRoleChange: (role: UserRole) => void;
  onSignOut: () => void;
  userName: string;
  userEmail: string;
  initials: string;
  notificationCount: number;
  notificationsOpen: boolean;
  onNotificationsOpen: () => void;
  onNotificationsClose: () => void;
  activityItems: MobileNotificationItem[];
  messageItems: MobileNotificationItem[];
  onNotificationsClear: () => void;
  children: React.ReactNode;
}
