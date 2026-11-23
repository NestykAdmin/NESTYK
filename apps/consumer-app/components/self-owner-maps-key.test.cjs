// Jom 23 Nov 2026 (UI minor 6): the self owner screens read the Google Maps key the same way as the agent web room
// detail (AgentRoomDetailModal.web.tsx): on web the app config's webGoogleMapsApiKey (NEXT_PUBLIC_…, else EXPO_PUBLIC_…)
// first, then EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. The phone keeps EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, 'self-owner/self-owner-maps-key.ts');
function load(constants) {
  const module = { exports: {} };
  const localRequire = (name) => {
    if (name === 'expo-constants') return { __esModule: true, default: constants };
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    return require(name);
  };
  new Function('require', 'module', 'exports', 'process', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(localRequire, module, module.exports, { env: {} });
  return module.exports;
}

test('web: the app config web key first, then the EXPO_PUBLIC key; phone: the EXPO_PUBLIC key', () => {
  const { selfOwnerMapsApiKey } = load({ expoConfig: { extra: { webGoogleMapsApiKey: 'web-key' } } });
  assert.equal(selfOwnerMapsApiKey('web', { webGoogleMapsApiKey: 'web-key' }, 'expo-key'), 'web-key');
  assert.equal(selfOwnerMapsApiKey('web', { webGoogleMapsApiKey: '' }, 'expo-key'), 'expo-key');
  assert.equal(selfOwnerMapsApiKey('web', {}, 'expo-key'), 'expo-key', 'config without a web key');
  assert.equal(selfOwnerMapsApiKey('ios', { webGoogleMapsApiKey: 'web-key' }, 'expo-key'), 'expo-key');
  assert.equal(selfOwnerMapsApiKey('web', { webGoogleMapsApiKey: '' }, ''), undefined, 'no key → undefined, so the map shows its own fallback');
  assert.equal(selfOwnerMapsApiKey(), 'web-key', 'defaults read Platform and the app config');
});

test('the self owner room detail (web + phone) and the listing form use the shared key', () => {
  const dir = path.join(__dirname, 'self-owner');
  for (const f of ['SelfOwnerRoomDetailModal.web.tsx', 'SelfOwnerRoomDetailModal.tsx', 'SelfOwnerListingEditor.tsx']) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.match(code, /mapsApiKey=\{selfOwnerMapsApiKey\(\)\}/, f);
    assert.doesNotMatch(code, /mapsApiKey=\{process\.env/, f);
  }
});
