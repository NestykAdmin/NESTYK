import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { useFocusEffect } from 'expo-router';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { useLocale } from '@nestyk/i18n';
import { useMobileTheme } from '@nestyk/ui/native';
import { useAuth } from '../lib/auth/AuthContext';
import { loadAuthSession } from '../lib/auth/session-storage';
import { signedInAccessToken } from '../lib/api';
import { APP_CONFIG } from '../lib/config';
import {
  APP_UA_MARK,
  appPageOf,
  bootScript,
  fromGuestWeb,
  guestWebOrigin,
  guestWebUrl,
  navigationDecision,
  parseWebMessage,
  profileForWeb,
  receiveScript,
} from '../lib/guest-web-bridge';
import type { GuestWebViewHandle, GuestWebViewProps } from './GuestWebView.types';

/**
 * The guest's whole screen in the app (step 2, design W): the guest web with its own app bar and tab bar.
 * The guest web inside the app for the guest role (W1, project-docs nestyk-guest-app-webview-plan-20261124.md;
 * Mos 24 Nov 2026). The app keeps the sign-in: the page asks for who is signed in and, per API call, for the
 * current access token; the app answers only pages of the guest web's own origin and never puts a token in the
 * page's address or storage. Other sites open in the phone's browser.
 */
export const GuestWebView = forwardRef<GuestWebViewHandle, GuestWebViewProps>(function GuestWebView(
  { onOpenMenu, onOpenNotifications, onOpenPage, backEnabled },
  handle,
) {
  const { locale } = useLocale();
  const { theme } = useMobileTheme();
  const { session, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const ref = useRef<WebView>(null);
  const origin = useMemo(() => guestWebOrigin(APP_CONFIG.baseUrl), []);
  const uri = useMemo(() => guestWebUrl(APP_CONFIG.baseUrl, locale, '/'), [locale]);
  // Step 2: the view fills the screen; the page pads its app bar and tab bar by the phone's edges (read once per load).
  const boot = useMemo(() => bootScript(origin, { top: insets.top, bottom: insets.bottom }), [origin, insets.top, insets.bottom]);

  const reply = useCallback(
    (payload: object) => {
      ref.current?.injectJavaScript(receiveScript(payload, origin));
    },
    [origin],
  );

  // Android Back walks back through the web's own pages first (review R1), only while this screen is in front and
  // the side menu / notifications are closed (they handle Back themselves). At the web's first page Back goes on.
  const canGoBack = useRef(false);
  const backOn = useRef(backEnabled);
  backOn.current = backEnabled;
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!backOn.current || !canGoBack.current) return false;
        ref.current?.goBack();
        return true;
      });
      return () => sub.remove();
    }, []),
  );
  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    canGoBack.current = state.canGoBack;
  }, []);

  useImperativeHandle(handle, () => ({ navigate: (path: string) => reply({ type: 'navigate', path }) }), [reply]);

  // Signing in, out or switching account in the app: the page asks again.
  const userId = session?.userId ?? null;
  const firstLook = useRef(true);
  useEffect(() => {
    if (firstLook.current) {
      firstLook.current = false;
      return;
    }
    reply({ type: 'session.changed' });
  }, [userId, reply]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!fromGuestWeb(event.nativeEvent.url, origin)) return;
      const message = parseWebMessage(event.nativeEvent.data);
      if (!message) return;
      if (message.type === 'auth.signOut') {
        void signOut();
        return;
      }
      if (message.type === 'app.menu') {
        onOpenMenu();
        return;
      }
      if (message.type === 'app.notifications') {
        onOpenNotifications();
        return;
      }
      if (message.type === 'app.open') {
        onOpenPage(message.page);
        return;
      }
      if (message.type === 'session.get') {
        // Read the saved copy, not the render's: the page may ask in the same moment the app signs in.
        void loadAuthSession().then((saved) => reply({ type: 'session', id: message.id, profile: profileForWeb(saved) }));
        return;
      }
      void signedInAccessToken().then((auth) =>
        reply({ type: 'token', id: message.id, token: auth?.token ?? null, userId: auth?.userId ?? null }),
      );
    },
    [origin, reply, signOut, onOpenMenu, onOpenNotifications, onOpenPage],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      const decision = navigationDecision(request.url, origin, request.isTopFrame ?? true);
      if (decision === 'external') void Linking.openURL(request.url).catch(() => undefined);
      // An account page of our site (a plain link the page did not hand over itself): the app's own screen.
      if (decision === 'app') {
        const page = appPageOf(request.url, origin);
        if (page) onOpenPage(page);
      }
      return decision === 'allow';
    },
    [origin, onOpenPage],
  );

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]} testID="guestWeb.view">
      {/* The page's app bar is ink (design W): light status bar text, drawn over the page on Android too. */}
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <WebView
        ref={ref}
        source={{ uri }}
        style={styles.fill}
        applicationNameForUserAgent={APP_UA_MARK}
        // The page pads itself by the phone's edges (--nk-app-top / --nk-app-bottom); iOS must not add its own.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        // iOS: no "▲ ▼ Done" bar above the keyboard, as on the web in a phone browser app.
        hideKeyboardAccessoryView
        injectedJavaScriptBeforeContentLoaded={boot}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationStateChange}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        // Every address goes through navigationDecision (review R6): a narrower list hands the rest to the OS first.
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.loading, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.spinner} />
          </View>
        )}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
      />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
