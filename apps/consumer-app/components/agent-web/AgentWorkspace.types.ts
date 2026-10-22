import type React from "react";
import type { MobileAppTab, MobileNotificationItem } from "@nestyk/ui/native";
import type { UserRole } from "@nestyk/types";

export interface AgentWorkspaceProps {
  enabled: boolean;
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
