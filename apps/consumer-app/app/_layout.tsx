import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { LocaleProvider, resolveSupportedLocale, type SupportedLocale } from '@nestyk/i18n';
import { MobileThemeProvider, MobilePreloadScreen } from '@nestyk/ui/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from '../lib/auth/AuthContext';
import WebAppHost from '../components/web-routes/WebAppHost';
import { IdleSignOutGate } from '../components/web-session/IdleSignOutGate';
import { WebNotifier } from '../components/web-notify/WebNotifier';
import { CookieNotice } from '../components/legal/CookieNotice';
import { loadPreferredLocale, savePreferredLocale } from '../lib/locale-storage';
import { authPageLocale } from '../lib/app-routes';
import { Mitr_400Regular, Mitr_500Medium } from '@expo-google-fonts/mitr';
import {
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
} from '@expo-google-fonts/baloo-2';
import {
  NotoSansThai_400Regular,
  NotoSansThai_500Medium,
  NotoSansThai_600SemiBold,
  NotoSansThai_700Bold,
} from '@expo-google-fonts/noto-sans-thai';

SplashScreen.preventAutoHideAsync();

/** Shortest preload, so the smile is seen filling; the app mounts behind it meanwhile (600 ms: Mos 27 Nov 2026, was 1.1 s). */
const PRELOAD_MIN_MS = 600;

const deviceLocale = resolveSupportedLocale(
  Localization.getLocales()[0]?.languageTag ?? Localization.getLocales()[0]?.languageCode,
);

function BootstrapGate({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), PRELOAD_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  const bootstrapReady = ready && minElapsed;
  // Web closes the preload as soon as bootstrap is ready (Mos 3 Nov 2026); phones fade it out once its smile is full
  // (loading design A, Mos 25 Nov 2026: no "tap to enter" anywhere).
  useEffect(() => {
    if (Platform.OS === 'web' && bootstrapReady) setEntered(true);
  }, [bootstrapReady]);
  const showPreload = !entered;

  return (
    <>
      {children}
      {showPreload ? (
        <MobilePreloadScreen ready={bootstrapReady} onEnter={() => setEntered(true)} />
      ) : null}
    </>
  );
}

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    Mitr_400Regular,
    Mitr_500Medium,
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    NotoSansThai_400Regular,
    NotoSansThai_500Medium,
    NotoSansThai_600SemiBold,
    NotoSansThai_700Bold,
  });
  const [initialLocale, setInitialLocale] = useState<SupportedLocale | null>(null);

  useEffect(() => {
    let cancelled = false;
    // D6 (Mos 13 Nov 2026): a sign-in page opened from a guest web page shows that page's language.
    const fromUrl =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? authPageLocale(window.location.pathname, window.location.search)
        : null;
    loadPreferredLocale().then((saved) => {
      if (!cancelled) setInitialLocale(fromUrl ?? saved ?? deviceLocale);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLocaleChange = useCallback((locale: SupportedLocale) => {
    void savePreferredLocale(locale);
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && initialLocale) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, initialLocale]);

  if ((!fontsLoaded && !fontError) || !initialLocale) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <LocaleProvider defaultLocale={initialLocale} onLocaleChange={handleLocaleChange}>
        <MobileThemeProvider>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <BootstrapGate>
                <Slot />
                {/* Web only: the app shell stays mounted across paths (route plan R1). Mobile: renders nothing. */}
                <WebAppHost />
                {/* Web only: 8 hours with no input signs this device out (lib/auth/idle-rules.ts). Mobile: nothing. */}
                <IdleSignOutGate />
                {/* Web only: Alert.alert shows a toast (bottom right) or a confirm dialog (plan A6). Mobile: nothing. */}
                <WebNotifier />
                {/* Web only: first-visit cookie notice (PDPA plan FE1). Mobile: nothing. */}
                <CookieNotice />
              </BootstrapGate>
            </GestureHandlerRootView>
          </AuthProvider>
        </MobileThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
