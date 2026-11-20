import React, { useContext } from 'react';
import type { ViewStyle } from 'react-native';

/**
 * Desktop look of the listing form (self owner web, Jom 20 Nov 2026): the wizard's pickers open as centred dialogs
 * instead of phone bottom sheets. The wizard sets the context for the fields it renders (e.g. the move-in date).
 * Default false: the agent and the phone keep the bottom sheets.
 */
export const WizardDesktopContext = React.createContext(false);

const DESKTOP_SHEET: ViewStyle = {
  alignSelf: 'center',
  width: '100%',
  maxWidth: 560,
  marginTop: 'auto',
  marginBottom: 'auto',
  borderRadius: 16,
  paddingTop: 16,
};

/** Props for MobileBottomSheet: none on the phone look; a centred dialog without the drag handle on desktop. */
export function wizardSheetProps(desktop: boolean): { sheetStyle?: ViewStyle; showHandle?: boolean } {
  if (!desktop) return {};
  return { sheetStyle: DESKTOP_SHEET, showHandle: false };
}

export function useWizardSheetProps() {
  return wizardSheetProps(useContext(WizardDesktopContext));
}
