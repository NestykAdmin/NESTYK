import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
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
<style>html,body{margin:0;background:transparent;}#box{display:flex;justify-content:center;}</style>
</head>
<body>
<div id="box"></div>
<script>
function post(token) {
  var payload = JSON.stringify({ token: token || '' });
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
}
function onHcaptchaLoad() {
  hcaptcha.render('box', {
    sitekey: ${JSON.stringify(siteKey)},
    hl: 'en',
    theme: 'light',
    callback: function (token) { post(token); },
    'expired-callback': function () { post(''); },
    'error-callback': function () { post(''); }
  });
}
</script>
</body>
</html>`;
}

/** Mobile hostname presented to hCaptcha. The site key must allow nestyk.com. */
const MOBILE_BASE_URL = 'https://nestyk.com';

export function HcaptchaField({
  resetKey,
  onToken,
}: {
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const siteKey = hcaptchaSiteKey();
  const html = useMemo(() => (siteKey ? widgetHtml(siteKey) : ''), [siteKey]);
  if (!siteKey) return null;
  const WebView = loadWebView();
  if (!WebView) return null;
  return (
    <View style={styles.frame}>
      <WebView
        key={resetKey}
        originWhitelist={['*']}
        source={{ html, baseUrl: MOBILE_BASE_URL }}
        onMessage={(event) => {
          try {
            const token = JSON.parse(event.nativeEvent.data).token;
            onToken(typeof token === 'string' && token ? token : null);
          } catch {
            onToken(null);
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'flex-start',
    width: 304,
    height: 78,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  web: { flex: 1, backgroundColor: 'transparent' },
});
