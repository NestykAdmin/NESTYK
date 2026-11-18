import React, { useEffect, useMemo, useState } from 'react';
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

export type CaptchaAppearance = 'always' | 'interaction-only';

function widgetHtml(siteKey: string, appearance: CaptchaAppearance): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="${TURNSTILE_SCRIPT_URL}" async defer onerror="clear()"></script>
<style>html,body{margin:0;background:transparent;}#box{width:100%;}</style>
</head>
<body>
<div id="box"></div>
<script>
function post(message) {
  var payload = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
}
function clear() { post({ token: '', failed: true }); }
function onTurnstileLoad() {
  turnstile.render('#box', {
    sitekey: ${JSON.stringify(siteKey)},
    language: 'en',
    theme: 'light',
    size: 'flexible',
    appearance: ${JSON.stringify(appearance)},
    callback: function (token) { post({ token: token || '' }); },
    'before-interactive-callback': function () { post({ interactive: true }); },
    'after-interactive-callback': function () { post({ interactive: false }); },
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
 * Turnstile runs any interactive check inside its one box, so the frame keeps one height. The widget is "flexible": it
 * fills the form's width like the inputs. The frame is not clipped or rounded: the widget has its own square border,
 * and rounding it cut the border off at the corners (Jom, 12 Nov 2026).
 */
export const WIDGET_HEIGHT = 65;

/** Cloudflare's test site keys (1x…, 2x…, 3x…) add a "For testing only" line under the widget. */
export const TEST_KEY_HEIGHT = 82;

export function isTestSiteKey(siteKey: string): boolean {
  return /^[123]x0{20}[A-Z]{2}$/.test(siteKey);
}

export function CaptchaField({
  resetKey,
  onToken,
  appearance = 'always',
  onFailed,
}: {
  resetKey: number;
  onToken: (token: string | null) => void;
  /** "interaction-only": the frame keeps no height until Cloudflare asks the person to click (Mos 17 Nov 2026). */
  appearance?: CaptchaAppearance;
  /** Called when there is no token any more (expired, error, timeout), so the form can stop waiting. */
  onFailed?: () => void;
}) {
  const siteKey = captchaSiteKey();
  const html = useMemo(() => (siteKey ? widgetHtml(siteKey, appearance) : ''), [siteKey, appearance]);
  const [interactive, setInteractive] = useState(false);
  // A new widget starts hidden again (review R9).
  useEffect(() => setInteractive(false), [resetKey]);
  if (!siteKey) return null;
  const WebView = loadWebView();
  if (!WebView) return null;
  const height = isTestSiteKey(siteKey) ? TEST_KEY_HEIGHT : WIDGET_HEIGHT;
  // The WebView keeps its full height inside so Turnstile can lay out; only the frame around it folds to 0.
  const open = appearance !== 'interaction-only' || interactive;
  return (
    <View style={open ? styles.slot : styles.slotHidden}>
      <View testID="captcha-frame" style={[styles.frame, { height: open ? height : 0 }]}>
        <WebView
          key={resetKey}
          originWhitelist={['*']}
          source={{ html, baseUrl: MOBILE_BASE_URL }}
          onMessage={(event) => {
            let message: { token?: unknown; interactive?: unknown; failed?: unknown } | null = null;
            try {
              message = JSON.parse(event.nativeEvent.data);
            } catch {
              message = null;
            }
            if (typeof message?.interactive === 'boolean') {
              setInteractive(message.interactive);
              return;
            }
            const token = message?.token;
            onToken(typeof token === 'string' && token ? token : null);
            if (message?.failed === true) onFailed?.();
          }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          setSupportMultipleWindows={false}
          style={[styles.web, { height }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignSelf: 'stretch', marginTop: 10, marginBottom: 4 },
  slotHidden: { alignSelf: 'stretch', height: 0, overflow: 'hidden' },
  frame: { alignSelf: 'stretch' },
  web: { width: '100%', backgroundColor: 'transparent' },
});
