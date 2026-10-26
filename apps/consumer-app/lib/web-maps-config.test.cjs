const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const configPath = path.resolve(__dirname, '../app.config.js');
const source = fs.readFileSync(configPath, 'utf8');
function evaluate(code, env) {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, __dirname: path.dirname(configPath), process: { env },
    require(name) {
      if (name === 'path') return path;
      // Configuration tests never load the developer's environment files.
      if (name === 'fs') return { existsSync: () => false };
      throw new Error(`Unexpected configuration dependency: ${name}`);
    },
  });
  return JSON.parse(JSON.stringify(module.exports));
}

test('Agent website reuses the public website Maps key while native Maps configuration stays unchanged', () => {
  const env = { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'website-key', EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'native-key' };
  const config = evaluate(source, env);
  assert.equal(config.extra.webGoogleMapsApiKey, 'website-key');
  assert.equal(config.ios.config.googleMapsApiKey, 'native-key');
  assert.equal(config.android.config.googleMaps.apiKey, 'native-key');
  const previous = evaluate(execFileSync('git', ['show', 'HEAD:apps/consumer-app/app.config.js'], { cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8' }), env);
  delete config.extra.webGoogleMapsApiKey;
  assert.deepEqual(config, previous);
});

test('web Maps falls back to the existing Expo key and handles an unconfigured environment', () => {
  assert.equal(evaluate(source, { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'expo-key' }).extra.webGoogleMapsApiKey, 'expo-key');
  assert.equal(evaluate(source, {}).extra.webGoogleMapsApiKey, '');
});
