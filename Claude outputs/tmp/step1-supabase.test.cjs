// lib/auth/supabase.ts: one shared client, and the token refresh follows the app's foreground/background state.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const SOURCE = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'supabase.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

/** Loads a fresh copy of supabase.ts with fake Supabase / React Native modules. */
function load({ os = 'android', url = 'https://abc.supabase.co', key = 'sb_publishable_test' } = {}) {
  const calls = { created: [], listeners: [], start: 0, stop: 0 };
  const storage = { name: 'AsyncStorage' };
  const deps = {
    '@supabase/supabase-js': {
      createClient: (u, k, options) => {
        calls.created.push({ u, k, options });
        return {
          auth: {
            startAutoRefresh: async () => { calls.start += 1; },
            stopAutoRefresh: async () => { calls.stop += 1; },
          },
        };
      },
    },
    '@react-native-async-storage/async-storage': { default: storage },
    'react-native': {
      Platform: { OS: os },
      AppState: { addEventListener: (event, fn) => { calls.listeners.push({ event, fn }); return { remove() {} }; } },
    },
  };
  const saved = { url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY };
  process.env.EXPO_PUBLIC_SUPABASE_URL = url;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
  const loaded = { exports: {} };
  try {
    new Function('module', 'exports', 'require', 'process', SOURCE)(loaded, loaded.exports, (id) => {
      if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`);
      return deps[id];
    }, process);
  } finally {
    for (const [name, value] of [['EXPO_PUBLIC_SUPABASE_URL', saved.url], ['EXPO_PUBLIC_SUPABASE_ANON_KEY', saved.key]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  return { mod: loaded.exports, calls, storage };
}

test('phone: one client, one AppState listener, refresh stops in the background and restarts on return', async () => {
  const { mod, calls, storage } = load({ os: 'android' });
  const first = mod.getSupabaseClient();
  const second = mod.getSupabaseClient();
  assert.equal(first, second, 'the same client is reused');
  assert.equal(calls.created.length, 1);
  assert.equal(calls.listeners.length, 1, 'listener is added once, not on every call');
  assert.equal(calls.listeners[0].event, 'change');

  // Existing auth options are unchanged.
  const { options } = calls.created[0];
  assert.equal(options.auth.storage, storage);
  assert.equal(options.auth.autoRefreshToken, true);
  assert.equal(options.auth.persistSession, true);
  assert.equal(options.auth.detectSessionInUrl, false);

  const onChange = calls.listeners[0].fn;
  onChange('background');
  assert.deepEqual([calls.start, calls.stop], [0, 1]);
  onChange('active');
  assert.deepEqual([calls.start, calls.stop], [1, 1]);
  // iOS reports 'inactive' while switching apps or opening Control Center: treated as not in the foreground.
  onChange('inactive');
  assert.deepEqual([calls.start, calls.stop], [1, 2]);
  onChange('active');
  assert.deepEqual([calls.start, calls.stop], [2, 2]);
});

test('iOS behaves the same as Android', () => {
  const { mod, calls } = load({ os: 'ios' });
  mod.getSupabaseClient();
  assert.equal(calls.listeners.length, 1);
});

test('web build: no AppState listener (Supabase follows the browser tab itself)', () => {
  const { mod, calls } = load({ os: 'web' });
  assert.ok(mod.getSupabaseClient());
  assert.equal(calls.listeners.length, 0);
});

test('Supabase not configured: no client and no listener', () => {
  for (const env of [{ url: '' }, { key: '' }, { url: 'https://your-project-ref.supabase.co' }]) {
    const { mod, calls } = load(env);
    assert.equal(mod.getSupabaseClient(), null);
    assert.equal(mod.isSupabaseConfigured(), false);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.listeners.length, 0);
  }
});
