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
      useWindowDimensions: () => ({ width: 390, height: 844 }),
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

test('hCaptcha always shows in English on web and in the app (Mos, 4 Nov 2026)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['HcaptchaField.web.tsx', 'HcaptchaField.tsx']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const scriptUrls = source.match(/https:\/\/js\.hcaptcha\.com\/1\/api\.js\?[^'"\s]*/g) || [];
    assert.ok(scriptUrls.length > 0, `${file}: script URL`);
    for (const url of scriptUrls) assert.match(url, /[?&]hl=en(&|$)/, `${file}: ${url}`);
    assert.match(source, /hl:\s*['"]en['"]/, `${file}: render option hl`);
  }
});

// The app WebView is the whole page the challenge opens in (on web it floats over the site instead), so the frame
// must grow to the page size while a challenge is open and shrink back to the checkbox after (QA 6 Nov 2026).
function interactive({ windowHeight = 844 } = {}) {
  const state = [], effects = [], tokens = [];
  let cursor = 0;
  const WebView = (props) => null;
  const hooks = { ...React,
    useMemo: (factory) => factory(),
    useEffect: (effect) => effects.push(effect),
    useState: (initial) => {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], (next) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
    } };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id === 'react') return hooks;
    if (id === 'react-native') return {
      View: 'View',
      StyleSheet: { create: (styles) => styles, flatten: (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) },
      useWindowDimensions: () => ({ width: 390, height: windowHeight }),
    };
    if (id === '../lib/auth/hcaptcha-site-key') return { hcaptchaSiteKey: () => 'site-key' };
    if (id === 'react-native-webview') return { WebView };
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports);
  const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const find = (element, match) => {
    if (!element || typeof element !== 'object') return null;
    if (match(element)) return element;
    for (const child of [element.props?.children].flat()) {
      const found = find(child, match);
      if (found) return found;
    }
    return null;
  };
  const render = (resetKey = 0) => {
    cursor = 0;
    const tree = mod.exports.HcaptchaField({ resetKey, onToken: (token) => tokens.push(token) });
    const slot = tree;
    const frame = find(tree, (el) => el.props?.testID === 'hcaptcha-frame');
    const web = find(tree, (el) => el.type === WebView);
    return { slot, frameStyle: flat(frame.props.style), webStyle: flat(web.props.style), web };
  };
  const send = (message) => render().web.props.onMessage({ nativeEvent: { data: JSON.stringify(message) } });
  return { render, send, tokens, effects, challengeHeight: mod.exports.challengeHeight };
}

test('the frame shows only the checkbox until a challenge opens, then the whole challenge page', () => {
  const view = interactive();
  view.render().slot.props.onLayout({ nativeEvent: { layout: { width: 343 } } });
  let shown = view.render();
  assert.equal(shown.frameStyle.width, 304);
  assert.equal(shown.frameStyle.height, 78);
  assert.equal(shown.frameStyle.overflow, 'hidden');
  assert.equal(shown.webStyle.width, 343, 'the page is challenge-sized from the start, so hCaptcha lays the challenge out to fit');
  assert.equal(shown.webStyle.height, view.challengeHeight(844));

  view.send({ challenge: 'open' });
  shown = view.render();
  assert.equal(shown.frameStyle.width, 343);
  assert.equal(shown.frameStyle.height, view.challengeHeight(844));
  assert.deepEqual(view.tokens, [], 'opening a challenge is not a token');

  view.send({ challenge: 'closed' });
  shown = view.render();
  assert.equal(shown.frameStyle.height, 78);
  assert.deepEqual(view.tokens, [], 'closing a challenge clears nothing by itself');
});

test('solving the challenge shrinks the frame and passes the token; a failed challenge clears it', () => {
  const view = interactive();
  view.send({ challenge: 'open' });
  view.send({ token: 'solved' });
  assert.equal(view.render().frameStyle.height, 78);
  view.send({ challenge: 'open' });
  view.send({ token: '' });
  assert.equal(view.render().frameStyle.height, 78);
  assert.deepEqual(view.tokens, ['solved', null]);
});

test('a new reset key closes an open challenge frame', () => {
  const view = interactive();
  view.send({ challenge: 'open' });
  assert.notEqual(view.render().frameStyle.height, 78);
  view.effects.splice(0).forEach((effect) => effect());
  assert.equal(view.render(1).frameStyle.height, 78);
});

test('the challenge page fits the screen: 80% of its height, at most 620, never below the checkbox', () => {
  const { challengeHeight } = interactive();
  assert.equal(challengeHeight(844), 620);
  assert.equal(challengeHeight(667), 534);
  assert.equal(challengeHeight(50), 78);
});

test('the widget page reports when a challenge opens or closes, and keeps the checkbox at the left of the frame', () => {
  const view = fixture();
  const { source, onMessage } = view.webviews[0];
  const messages = [];
  let callbacks;
  const context = {
    hcaptcha: { render: (container, options) => { callbacks = options; } },
    window: { ReactNativeWebView: { postMessage: (data) => messages.push(JSON.parse(data)) } },
  };
  vm.runInNewContext(`${source.html.match(/<script>([\s\S]*?)<\/script>/)[1]}\nonHcaptchaLoad();`, context);
  callbacks['open-callback']();
  callbacks['close-callback']();
  callbacks['open-callback']();
  callbacks['chalexpired-callback']();
  assert.deepEqual(messages, [{ challenge: 'open' }, { challenge: 'closed' }, { challenge: 'open' }, { challenge: 'closed' }]);
  assert.match(source.html, /#box\{display:flex;justify-content:flex-start;\}/);
  assert.equal(typeof onMessage, 'function');
});
