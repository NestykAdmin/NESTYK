import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { hcaptchaSiteKey } from '../lib/auth/hcaptcha-site-key';

type WebViewComponent = React.ComponentType<{
  source: { html: string; baseUrl?: string };
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  style?: object;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  originWhitelist?: string[];
  scrollEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
}>;

function loadWebView(): WebViewComponent | null {
  try {
    const loaded: unknown = require('react-native-webview').WebView;
    const isForwardRef = typeof loaded === 'object' && loaded !== null &&
      '$$typeof' in loaded && loaded.$$typeof === Symbol.for('react.forward_ref');
    return typeof loaded === 'function' || isForwardRef ? loaded as WebViewComponent : null;
  } catch {
    return null;
  }
}

function widgetHtml(siteKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://js.hcaptcha.com/1/api.js?onload=onHcaptchaLoad&render=explicit&hl=en" async defer></script>
<style>html,body{margin:0;background:transparent;}#box{display:flex;justify-content:flex-start;}</style>
</head>
<body>
<div id="box"></div>
<script>
function post(message) {
  var payload = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
}
function onHcaptchaLoad() {
  hcaptcha.render('box', {
    sitekey: ${JSON.stringify(siteKey)},
    hl: 'en',
    theme: 'light',
    callback: function (token) { post({ token: token || '' }); },
    'expired-callback': function () { post({ token: '' }); },
    'error-callback': function () { post({ token: '' }); },
    'open-callback': function () { post({ challenge: 'open' }); },
    'close-callback': function () { post({ challenge: 'closed' }); },
    'chalexpired-callback': function () { post({ challenge: 'closed' }); }
  });
}
</script>
</body>
</html>`;
}

/** Mobile hostname presented to hCaptcha. The site key must allow nestyk.com. */
const MOBILE_BASE_URL = 'https://nestyk.com';

/** The checkbox alone. */
const CHECKBOX = { width: 304, height: 78 };
const CHALLENGE_MAX_HEIGHT = 620;

/**
 * Height of the WebView page. In the app the challenge (drag / pick images) opens inside this page, not over the screen
 * as on web, so the page is always challenge-sized and the frame shows only the checkbox until a challenge opens
 * (QA 6 Nov 2026: a 304x78 page cut the challenge to its title bar, so it could not be solved).
 */
export function challengeHeight(windowHeight: number): number {
  return Math.max(CHECKBOX.height, Math.min(CHALLENGE_MAX_HEIGHT, Math.round(windowHeight * 0.8)));
}

export function HcaptchaField({
  resetKey,
  onToken,
}: {
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const siteKey = hcaptchaSiteKey();
  const html = useMemo(() => (siteKey ? widgetHtml(siteKey) : ''), [siteKey]);
  const { height: windowHeight } = useWindowDimensions();
  const [slotWidth, setSlotWidth] = useState(0);
  const [challengeOpen, setChallengeOpen] = useState(false);
  useEffect(() => setChallengeOpen(false), [resetKey]);
  if (!siteKey) return null;
  const WebView = loadWebView();
  if (!WebView) return null;
  const pageWidth = Math.max(slotWidth, CHECKBOX.width);
  const pageHeight = challengeHeight(windowHeight);
  return (
    <View style={styles.slot} onLayout={(event) => setSlotWidth(Math.round(event.nativeEvent.layout.width))}>
      <View
        testID="hcaptcha-frame"
        style={[styles.frame, challengeOpen ? { width: pageWidth, height: pageHeight } : CHECKBOX]}
      >
        <WebView
          key={resetKey}
          originWhitelist={['*']}
          source={{ html, baseUrl: MOBILE_BASE_URL }}
          onMessage={(event) => {
            let message: { token?: unknown; challenge?: unknown } | null = null;
            try {
              message = JSON.parse(event.nativeEvent.data);
            } catch {
              message = null;
            }
            if (message?.challenge === 'open') {
              setChallengeOpen(true);
              return;
            }
            setChallengeOpen(false);
            if (message?.challenge === 'closed') return;
            const token = message?.token;
            onToken(typeof token === 'string' && token ? token : null);
          }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          setSupportMultipleWindows={false}
          style={[styles.web, { width: pageWidth, height: pageHeight }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignSelf: 'stretch', marginTop: 10, marginBottom: 4 },
  frame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  web: { position: 'absolute', top: 0, left: 0, backgroundColor: 'transparent' },
});
