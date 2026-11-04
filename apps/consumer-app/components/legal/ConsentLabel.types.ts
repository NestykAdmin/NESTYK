import type { StyleProp, TextStyle } from 'react-native';

export interface ConsentLabelProps {
  /** The plain sentence (mobile shows it as before). */
  fallback: string;
  style?: StyleProp<TextStyle>;
  linkColor?: string;
}
