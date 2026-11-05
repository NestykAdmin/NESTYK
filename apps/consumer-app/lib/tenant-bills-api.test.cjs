// lib/tenant-bills-api.ts: QA (5 Nov 2026) — GET /bills/* only reads now. The app asks the API to issue due bills
// (POST .../refresh) right before it reads them, so a bill still shows on the day it falls due.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'tenant-bills-api.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load({ refreshFails = false } = {}) {
  const calls = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const api = {
    apiGet: async (route) => { calls.push(['GET', route]); return route.endsWith('next') ? null : []; },
    apiPost: async (route) => {
      calls.push(['POST', route]);
      await gate;
      if (refreshFails) throw new Error('HTTP 500');
      return { issued: 1 };
    },
    apiRequest: async () => ({}),
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id === './api') return api;
    if (id === './agent-session') return { ensureAgentSession: async () => ({}) };
    if (id === 'react-native') return { Platform: { OS: 'web' } };
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports);
  return { ...mod.exports, calls, release };
}

test('tenant bills: issue due bills (POST) first, then read (GET)', async () => {
  const m = load();
  const read = m.listMyBills();
  m.release();
  await read;
  assert.deepEqual(m.calls, [['POST', '/bills/mine/refresh'], ['GET', '/bills/mine']]);
});

test('the home card and the bills page asking together share one refresh', async () => {
  const m = load();
  const both = Promise.all([m.getMyNextBill(), m.listMyBills()]);
  m.release();
  await both;
  assert.equal(m.calls.filter(([verb]) => verb === 'POST').length, 1);
  assert.deepEqual(m.calls.filter(([verb]) => verb === 'GET').map(([, route]) => route).sort(), ['/bills/mine', '/bills/mine/next']);
});

test('a failed refresh still reads the bills (the 00:05 job issues them tonight)', async () => {
  const m = load({ refreshFails: true });
  const read = m.listMyBills();
  m.release();
  assert.deepEqual(await read, []);
  assert.deepEqual(m.calls.map(([verb]) => verb), ['POST', 'GET']);
});

test('landlord income refreshes its own leases; the agent tenant page only reads', async () => {
  const m = load();
  const received = m.listReceivedBills();
  m.release();
  await received;
  await m.getAgentTenantBilling(2);
  assert.deepEqual(m.calls, [['POST', '/bills/received/refresh'], ['GET', '/bills/received'], ['GET', '/bills/agent/tenants/2']]);
});
