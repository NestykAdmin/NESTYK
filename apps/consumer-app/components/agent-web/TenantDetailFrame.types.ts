import type React from "react";
import type { TenantSection } from "../../lib/tenant-detail";

export interface TenantDetailFrameProps {
  /** True in the desktop web shell (768px+): side menu + content. False: children only, exactly as the app. */
  web: boolean;
  name: string;
  /** "Project · Room" under the name. */
  place: string;
  /** Open section; null is the overview (hub). */
  section: TenantSection | null;
  onSection: (section: TenantSection | null) => void;
  /** While the profile is being edited or saved the menu waits (the edit bar must be saved or cancelled first). */
  disabled?: boolean;
  children: React.ReactNode;
}
