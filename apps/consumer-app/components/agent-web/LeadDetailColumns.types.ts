import type React from "react";

export interface LeadDetailColumnsProps {
  /** True in the desktop web shell (768px+). False: children only, exactly as the app. */
  web: boolean;
  children: React.ReactNode;
}

export interface LeadDetailColumnProps {
  web: boolean;
  /** The matched-rooms side: wider column on the right. */
  side: "main" | "rooms";
  children: React.ReactNode;
}
