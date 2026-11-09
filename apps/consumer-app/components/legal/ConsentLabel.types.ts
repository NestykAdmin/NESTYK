import type { StyleProp, TextStyle } from 'react-native';

export interface ConsentLabelProps {
  /** The plain sentence (mobile shows it as before). */
  fallback: string;
  style?: StyleProp<TextStyle>;
  linkColor?: string;
  /**
   * Which sentence the web shows with its document link (PDPA plan FE5, 9 Nov 2026):
   * `consent` = the register checkbox, terms only · `privacyNotice` = the line under the register button (no checkbox).
   */
  template?: 'consent' | 'privacyNotice';
}
