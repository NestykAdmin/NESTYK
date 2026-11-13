import React, { createContext, useContext, useMemo, useState } from 'react';
import { StatusBarStyle } from 'react-native';
import { tokens } from './tokens';

export type ThemeMode = 'light' | 'dark';

export interface MobileThemeColors {
  mode: ThemeMode;
  background: string;
  surface: string;
  card: string;
  header: string;
  textHeading: string;
  textSecondary: string;
  border: string;
  screenTitle: string;
  statusBarStyle: StatusBarStyle;
  overlay: string;
  /** Loading spinners (v1.2): ink in light mode, brand yellow in dark mode. */
  spinner: string;
}

const LIGHT_THEME: Omit<MobileThemeColors, 'mode'> = {
  background: tokens.colors.background,
  surface: '#FFFFFF',
  card: '#FFFFFF',
  header: '#FFFFFF',
  textHeading: tokens.colors.textHeading,
  textSecondary: tokens.colors.textSecondary,
  border: tokens.colors.border,
  screenTitle: '#211E1E',
  statusBarStyle: 'dark-content',
  overlay: 'rgba(0,0,0,0.28)',
  spinner: tokens.colors.primary,
};

const DARK_THEME: Omit<MobileThemeColors, 'mode'> = {
  // Colour system v1.1 (CI, 12 Nov 2026): brand ink family instead of navy.
  background: '#211E1E',
  surface: '#2F2B2B',
  card: '#2F2B2B',
  header: '#2F2B2B',
  textHeading: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: '#3F3A3A',
  screenTitle: '#F8FAFC',
  statusBarStyle: 'light-content',
  overlay: 'rgba(0,0,0,0.55)',
  spinner: tokens.colors.brand[500],
};

export interface MobileThemeContextValue {
  theme: MobileThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const MobileThemeContext = createContext<MobileThemeContextValue | null>(null);

export interface MobileThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
}

export const MobileThemeProvider: React.FC<MobileThemeProviderProps> = ({
  children,
  defaultMode = 'light',
}) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(defaultMode);

  const value = useMemo<MobileThemeContextValue>(() => {
    const palette = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;
    return {
      theme: { mode: themeMode, ...palette },
      themeMode,
      setThemeMode,
      isDark: themeMode === 'dark',
    };
  }, [themeMode]);

  return <MobileThemeContext.Provider value={value}>{children}</MobileThemeContext.Provider>;
};

/** Theme when a provider is mounted, otherwise null (for shared pieces that may render outside the app shell). */
export function useMobileThemeOptional(): MobileThemeContextValue | null {
  return useContext(MobileThemeContext);
}

export function useMobileTheme(): MobileThemeContextValue {
  const ctx = useContext(MobileThemeContext);
  if (!ctx) {
    throw new Error('useMobileTheme must be used within MobileThemeProvider');
  }
  return ctx;
}
