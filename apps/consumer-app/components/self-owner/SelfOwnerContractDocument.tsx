import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocale } from '@nestyk/i18n';
import { tokens, useMobileTheme } from '@nestyk/ui/native';
import { MobileSkeletonCards } from './MobileSkeletonCards';
import { loadDocumentDataUrl, parsePdfMessage, selfOwnerPdfHtml } from '../../lib/self-owner-pdf';


/**
 * A self owner contract file on the phone (Jom 25 Nov 2026, option B): the shared PDF viewer, continuous mode, in a
 * WebView fed the file as a data URL; `onReachedEnd` fires once the owner has scrolled to the end. One page-shaped
 * skeleton covers both loads (the file, then the viewer) until the viewer says it is ready.
 */
export function SelfOwnerContractDocument({ load, onReachedEnd, fill = false, initialFailed = false }: { /** The file's URL (or a data URL); called on every attempt, so a retry asks for a fresh link. */ load: () => Promise<string>; onReachedEnd?: () => void; /** Shows the failed state first (tests). */ initialFailed?: boolean; /** Fill the space left (the parent sets the size). */ fill?: boolean }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const so = t.selfOwnerContracts;
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(initialFailed);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The caller's `load` may be a new function each render; the latest one is used by each attempt.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setReady(false);
    loadDocumentDataUrl(() => loadRef.current())
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const html = useMemo(() => (dataUrl ? selfOwnerPdfHtml(dataUrl) : null), [dataUrl]);
  return (
    <View testID="soc-pdf" accessibilityState={{ busy: !ready && !failed }} style={[styles.box, fill ? styles.fill : styles.fixed, { borderColor: theme.border }]}>
      {html ? (
        <WebView
          source={{ html }}
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('data:')}
          nestedScrollEnabled
          onMessage={(event) => {
            const message = parsePdfMessage(event.nativeEvent.data);
            // A viewer error shows the viewer's own retry, so the skeleton steps aside then too.
            if (message?.type === 'ready' || message?.type === 'error') setReady(true);
            if (message?.type === 'end') onReachedEnd?.();
          }}
          style={[styles.viewer, { opacity: ready ? 1 : 0 }]}
        />
      ) : null}
      {failed ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={[styles.small, { color: tokens.colors.subtle.dangerFg }]}>{so.documentFailed}</Text>
          <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)} style={[styles.retry, { borderColor: theme.border }]}>
            <Text style={[styles.small, { color: theme.screenTitle }]}>{t.agent.dashboard.webStates.retry}</Text>
          </Pressable>
        </View>
      ) : !ready ? (
        <View testID="soc-pdf-skeleton" accessibilityLabel={so.documentLoading} style={styles.skeleton}>
          <MobileSkeletonCards count={1} lines={9} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, backgroundColor: '#F1F5F9' },
  fill: { flex: 1, minHeight: 240 },
  fixed: { height: 460 },
  viewer: { flex: 1, backgroundColor: '#F1F5F9' },
  state: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  skeleton: { ...StyleSheet.absoluteFillObject, padding: 12 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
});
