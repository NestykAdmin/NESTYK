import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { captchaSiteKey } from '../lib/auth/captcha-site-key';

// Bot check on sign-in, sign-up and password forms: Cloudflare Turnstile (replaced hCaptcha, Jom 12 Nov 2026).

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

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';

function widgetHtml(siteKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="${TURNSTILE_SCRIPT_URL}" async defer></script>
<style>html,body{margin:0;background:transparent;}#box{display:flex;justify-content:flex-start;}</style>
</head>
<body>
<div id="box"></div>
<script>
function post(message) {
  var payload = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
}
function clear() { post({ token: '' }); }
function onTurnstileLoad() {
  turnstile.render('#box', {
    sitekey: ${JSON.stringify(siteKey)},
    language: 'en',
    theme: 'light',
    size: 'normal',
    callback: function (token) { post({ token: token || '' }); },
    'expired-callback': clear,
    'error-callback': clear,
    'timeout-callback': clear
  });
}
</script>
</body>
</html>`;
}

/** Mobile hostname presented to Turnstile. The site key must allow nestyk.com. */
const MOBILE_BASE_URL = 'https://nestyk.com';

/**
 * Turnstile's "normal" widget. Unlike hCaptcha's picture challenge (QA 6 Nov 2026), Turnstile runs any interactive
 * check inside this same box, so the frame keeps one size.
 */
export const WIDGET = { width: 300, height: 65 };

export function CaptchaField({
  resetKey,
  onToken,
}: {
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const siteKey = captchaSiteKey();
  const html = useMemo(() => (siteKey ? widgetHtml(siteKey) : ''), [siteKey]);
  if (!siteKey) return null;
  const WebView = loadWebView();
  if (!WebView) return null;
  return (
    <View style={styles.slot}>
      <View testID="captcha-frame" style={[styles.frame, WIDGET]}>
        <WebView
          key={resetKey}
          originWhitelist={['*']}
          source={{ html, baseUrl: MOBILE_BASE_URL }}
          onMessage={(event) => {
            let message: { token?: unknown } | null = null;
            try {
              message = JSON.parse(event.nativeEvent.data);
            } catch {
              message = null;
            }
            const token = message?.token;
            onToken(typeof token === 'string' && token ? token : null);
          }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          setSupportMultipleWindows={false}
          style={[styles.web, WIDGET]}
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
  web: { backgroundColor: 'transparent' },
});
