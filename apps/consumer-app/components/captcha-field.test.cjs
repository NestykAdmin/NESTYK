// CaptchaField: Cloudflare Turnstile (replaced hCaptcha, Jom 12 Nov 2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const compile = (file) => ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const source = compile('CaptchaField.tsx');

function load({ siteKey = randomUUID(), react = React, WebView, missingModule = false, counter = { loads: 0 } } = {}) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id === 'react') return react;
    if (id === 'react-native') return {
      View: ({ children }) => React.createElement('div', null, children),
      StyleSheet: { create: (styles) => styles },
    };
    if (id === '../lib/auth/captcha-site-key') return { captchaSiteKey: () => siteKey };
    if (id === 'react-native-webview') {
      counter.loads += 1;
      if (missingModule) throw new Error('Native module unavailable');
      return { WebView };
    }
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}

function fixture({ siteKey = randomUUID(), forwardRef = true, missingModule = false } = {}) {
  const webviews = [];
  const tokens = [];
  const counter = { loads: 0 };
  const renderWebView = (props) => {
    webviews.push(props);
    return React.createElement('iframe', { srcDoc: props.source.html });
  };
  const WebView = forwardRef ? React.forwardRef((props) => renderWebView(props)) : renderWebView;
  const exports = load({ siteKey, WebView, missingModule, counter });
  const markup = renderToStaticMarkup(React.createElement(exports.CaptchaField, {
    resetKey: 0,
    onToken: (token) => tokens.push(token),
  }));
  return { markup, webviews, tokens, siteKey, moduleLoads: counter.loads, exports };
}

/** Runs the WebView page's script with a stand-in for Cloudflare's `turnstile` global. */
function runWidgetPage(webview) {
  let rendered;
  const context = {
    turnstile: { render: (container, options) => { rendered = { container, options }; } },
    window: { ReactNativeWebView: { postMessage: (data) => webview.onMessage({ nativeEvent: { data } }) } },
  };
  const script = webview.source.html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(`${script}\nonTurnstileLoad();`, context);
  return rendered;
}

for (const forwardRef of [true, false]) {
  test(`native Turnstile renders its WebView when the component is ${forwardRef ? 'forwardRef' : 'a function'}`, () => {
    const view = fixture({ forwardRef });
    assert.equal(view.webviews.length, 1);
    assert.match(view.markup, /<iframe/);
    assert.equal(view.webviews[0].source.baseUrl, 'https://nestyk.com');
    assert.ok(view.webviews[0].source.html.includes(view.siteKey));
  });
}

test('the app page loads Turnstile from Cloudflare, not hCaptcha', () => {
  const { html } = fixture().webviews[0].source;
  assert.ok(html.includes('https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit'));
  assert.doesNotMatch(html, /hcaptcha/i);
});

test('native Turnstile stays hidden without a site key and does not load WebView', () => {
  const view = fixture({ siteKey: '' });
  assert.equal(view.markup, '');
  assert.equal(view.moduleLoads, 0);
});

test('native Turnstile does not crash when the native WebView module is unavailable', () => {
  assert.equal(fixture({ missingModule: true }).markup, '');
});

test('the native widget renders into #box with the site key, in English', () => {
  const view = fixture();
  const { container, options } = runWidgetPage(view.webviews[0]);
  assert.equal(container, '#box');
  assert.equal(options.sitekey, view.siteKey);
  assert.equal(options.language, 'en');
});

test('the native widget forwards a solved token and clears it on expiration, error or timeout', () => {
  const view = fixture();
  const { options } = runWidgetPage(view.webviews[0]);
  const token = randomUUID();
  options.callback(token);
  options['expired-callback']();
  options.callback(token);
  options['error-callback']('300030');
  options.callback(token);
  options['timeout-callback']();
  assert.deepEqual(view.tokens, [token, null, token, null, token, null]);
});

test('a message that is not JSON clears the token instead of crashing', () => {
  const view = fixture();
  view.webviews[0].onMessage({ nativeEvent: { data: 'not json' } });
  assert.deepEqual(view.tokens, [null]);
});

test('the app frame is Turnstile-sized: the widget box, with no separate challenge page', () => {
  const view = fixture();
  assert.deepEqual(view.exports.WIDGET, { width: 300, height: 65 });
  const style = Object.assign({}, ...[view.webviews[0].style].flat(Infinity).filter(Boolean));
  assert.equal(style.width, 300);
  assert.equal(style.height, 65);
  assert.equal(view.exports.challengeHeight, undefined, 'the hCaptcha challenge page sizing is gone');
});

test('Turnstile always shows in English on web and in the app (Mos, 4 Nov 2026)', () => {
  for (const file of ['CaptchaField.web.tsx', 'CaptchaField.tsx']) {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(text, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?[^'"\s]*render=explicit/, `${file}: script URL`);
    assert.match(text, /language:\s*['"]en['"]/, `${file}: render option language`);
    assert.doesNotMatch(text, /js\.hcaptcha\.com/, `${file}: no hCaptcha script`);
  }
});

test('the web widget clears the token on expiration, error and timeout, and removes the widget on cleanup', () => {
  const text = fs.readFileSync(path.join(__dirname, 'CaptchaField.web.tsx'), 'utf8');
  for (const callback of ['expired-callback', 'error-callback', 'timeout-callback']) {
    assert.match(text, new RegExp(`'${callback}': clear`), callback);
  }
  assert.match(text, /window\.turnstile\.remove\(widgetId\)/);
});

test('the site key comes from EXPO_PUBLIC_TURNSTILE_SITE_KEY, never the old hCaptcha variable', () => {
  const keySource = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../lib/auth/captcha-site-key.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const read = (env) => {
    const mod = { exports: {} };
    new Function('module', 'exports', 'process', keySource)(mod, mod.exports, { env });
    return mod.exports.captchaSiteKey();
  };
  assert.equal(read({ EXPO_PUBLIC_TURNSTILE_SITE_KEY: ' 0x4AAAAAAA ' }), '0x4AAAAAAA');
  assert.equal(read({ EXPO_PUBLIC_HCAPTCHA_SITE_KEY: 'old-hcaptcha-key' }), '');
  assert.equal(read({}), '');
});
