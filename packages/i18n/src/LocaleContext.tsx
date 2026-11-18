'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { th } from './locales/th';
import { en } from './locales/en';
import { zh } from './locales/zh';
import { ja } from './locales/ja';
import { SupportedLocale, TranslationSchema } from './types';

const localeMap: Record<SupportedLocale, TranslationSchema> = { th, en, zh, ja };

export interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: TranslationSchema;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export interface LocaleProviderProps {
  children: React.ReactNode;
  defaultLocale?: SupportedLocale;
  /** Persist / sync when the user changes language. */
  onLocaleChange?: (locale: SupportedLocale) => void;
}

export const LocaleProvider: React.FC<LocaleProviderProps> = ({
  children,
  defaultLocale = 'en',
  onLocaleChange,
}) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);
  const t = useMemo(() => localeMap[locale] || th, [locale]);

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      setLocaleState(next);
      onLocaleChange?.(next);
    },
    [onLocaleChange],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
