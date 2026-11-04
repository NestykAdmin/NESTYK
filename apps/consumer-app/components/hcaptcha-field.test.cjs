const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'HcaptchaField.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

function fixture({ siteKey = randomUUID(), forwardRef = true, missingModule = false } = {}) {
  const webviews = [];
  const tokens = [];
  let moduleLoads = 0;
  const renderWebView = (props) => {
    webviews.push(props);
    return React.createElement('iframe', { srcDoc: props.source.html });
  };
  const WebView = forwardRef ? React.forwardRef((props, ref) => renderWebView(props)) : renderWebView;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id === 'react') return React;
    if (id === 'react-native') return {
      View: ({ children }) => React.createElement('div', null, children),
      StyleSheet: { create: (styles) => styles },
    };
    if (id === '../lib/auth/hcaptcha-site-key') return { hcaptchaSiteKey: () => siteKey };
    if (id === 'react-native-webview') {
      moduleLoads += 1;
      if (missingModule) throw new Error('Native module unavailable');
      return { WebView };
    }
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports);
  const markup = renderToStaticMarkup(React.createElement(mod.exports.HcaptchaField, {
    resetKey: 0,
    onToken: (token) => tokens.push(token),
  }));
  return { markup, webviews, tokens, siteKey, moduleLoads };
}

for (const forwardRef of [true, false]) {
  test(`native hCaptcha renders its WebView when the component is ${forwardRef ? 'forwardRef' : 'a function'}`, () => {
    const view = fixture({ forwardRef });
    assert.equal(view.webviews.length, 1);
    assert.match(view.markup, /<iframe/);
    assert.equal(view.webviews[0].source.baseUrl, 'https://nestyk.com');
    assert.ok(view.webviews[0].source.html.includes(view.siteKey));
  });
}

test('native hCaptcha stays hidden without a site key and does not load WebView', () => {
  const view = fixture({ siteKey: '' });
  assert.equal(view.markup, '');
  assert.equal(view.moduleLoads, 0);
});

test('native hCaptcha does not crash when the native WebView module is unavailable', () => {
  assert.equal(fixture({ missingModule: true }).markup, '');
});

test('the native widget forwards a solved token and clears it on expiration or error', () => {
  const view = fixture();
  assert.equal(view.webviews.length, 1);
  const { source, onMessage } = view.webviews[0];
  let callbacks;
  const context = {
    hcaptcha: { render: (container, options) => { callbacks = options; } },
    window: { ReactNativeWebView: { postMessage: (data) => onMessage({ nativeEvent: { data } }) } },
  };
  const script = source.html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(`${script}\nonHcaptchaLoad();`, context);
  const token = randomUUID();
  callbacks.callback(token);
  callbacks['expired-callback']();
  callbacks.callback(token);
  callbacks['error-callback']();
  assert.deepEqual(view.tokens, [token, null, token, null]);
});
