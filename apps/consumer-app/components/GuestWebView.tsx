import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { useLocale } from '@nestyk/i18n';
import { useMobileTheme } from '@nestyk/ui/native';
import { useAuth } from '../lib/auth/AuthContext';
import { loadAuthSession } from '../lib/auth/session-storage';
import { signedInAccessToken } from '../lib/api';
import { APP_CONFIG } from '../lib/config';
import {
  APP_UA_MARK,
  bootScript,
  fromGuestWeb,
  guestWebOrigin,
  guestWebUrl,
  navigationDecision,
  parseWebMessage,
  profileForWeb,
  receiveScript,
} from '../lib/guest-web-bridge';
import type { GuestWebViewProps } from './GuestWebView.types';

/**
 * The guest web inside the app for the guest role (W1, project-docs nestyk-guest-app-webview-plan-20261124.md;
 * Mos 24 Nov 2026). The app keeps the sign-in: the page asks for who is signed in and, per API call, for the
 * current access token; the app answers only pages of the guest web's own origin and never puts a token in the
 * page's address or storage. Other sites open in the phone's browser.
 */
export function GuestWebView({ path }: GuestWebViewProps) {
  const { locale } = useLocale();
  const { theme } = useMobileTheme();
  const { session, signOut } = useAuth();
  const ref = useRef<WebView>(null);
  const origin = useMemo(() => guestWebOrigin(APP_CONFIG.baseUrl), []);
  const uri = useMemo(() => guestWebUrl(APP_CONFIG.baseUrl, locale, path), [locale, path]);

  const reply = useCallback(
    (payload: object) => {
      ref.current?.injectJavaScript(receiveScript(payload, origin));
    },
    [origin],
  );

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
      if (message.type === 'session.get') {
        // Read the saved copy, not the render's: the page may ask in the same moment the app signs in.
        void loadAuthSession().then((saved) => reply({ type: 'session', id: message.id, profile: profileForWeb(saved) }));
        return;
      }
      void signedInAccessToken().then((auth) =>
        reply({ type: 'token', id: message.id, token: auth?.token ?? null, userId: auth?.userId ?? null }),
      );
    },
    [origin, reply, signOut],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      const decision = navigationDecision(request.url, origin, request.isTopFrame ?? true);
      if (decision === 'external') void Linking.openURL(request.url).catch(() => undefined);
      return decision === 'allow';
    },
    [origin],
  );

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]} testID="guestWeb.view">
      <WebView
        ref={ref}
        source={{ uri }}
        style={styles.fill}
        applicationNameForUserAgent={APP_UA_MARK}
        injectedJavaScriptBeforeContentLoaded={bootScript(origin)}
        onMessage={onMessage}
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
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
