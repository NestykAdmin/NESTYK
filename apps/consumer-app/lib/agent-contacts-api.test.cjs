const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');

test('directory API keeps person IDs in their own category and reuses the shared Owner/Landlord contact', async () => {
  const calls = [], loaded = { exports: {} };
  const mock = name => {
    if (name === './agent-session') return { ensureAgentSession: async () => {} };
    if (name === './api') return {
      apiGet: async url => { calls.push(['get', url]); return {}; },
      apiRequest: async (url, input) => { calls.push([input.method.toLowerCase(), url, JSON.parse(input.body)]); return {}; },
    };
    if (name === './agent-listings-api') return {
      fetchAgentContact: async id => { calls.push(['owner-detail', id]); return {}; },
      fetchAgentOwnerContacts: async () => { calls.push(['owner-list']); return []; },
      fetchAgentLandlordContacts: async () => { calls.push(['landlord-list']); return []; },
      updateAgentContact: async (id, body) => { calls.push(['owner-update', id, body]); return {}; },
    };
    throw new Error(name);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'agent-contacts-api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(mock, loaded, loaded.exports);
  const api = loaded.exports, values = { name: 'New', phone: '0801', email: null, lineId: null, facebook: null, note: null };
  for (const kind of ['lead', 'tenant']) {
    await api.listDirectoryContacts(kind); await api.fetchDirectoryContact(kind, 1); await api.updateDirectoryContact(kind, 1, values);
  }
  assert.deepEqual(calls, [
    ['get', '/agent/contacts/lead?q=&page=1&limit=20'], ['get', '/agent/contacts/lead/1'], ['patch', '/agent/contacts/lead/1', values],
    ['get', '/agent/contacts/tenant?q=&page=1&limit=20'], ['get', '/agent/contacts/tenant/1'], ['patch', '/agent/contacts/tenant/1', values],
  ]);
  calls.length = 0;
  await api.listDirectoryContacts('owner'); await api.listDirectoryContacts('landlord');
  await api.fetchDirectoryContact('owner', 1); await api.fetchDirectoryContact('landlord', 1);
  await api.updateDirectoryContact('landlord', 1, values);
  assert.deepEqual(calls, [['get', '/agent/rooms/owner-contacts?q=&page=1&limit=20'], ['get', '/agent/rooms/landlord-contacts?q=&page=1&limit=20'], ['owner-detail', 1], ['owner-detail', 1], ['owner-update', 1, values]]);
  calls.length = 0;
  await api.listDirectoryContacts('landlord', '  Alice +66  ', 2);
  assert.deepEqual(calls, [['get', '/agent/rooms/landlord-contacts?q=Alice+%2B66&page=2&limit=20']]);
  calls.length = 0;
  await api.fetchContactRooms(1);
  assert.deepEqual(calls, [['get', '/agent/rooms/contacts/1/rooms']]);
  calls.length = 0;
  await api.listDirectoryContacts('coAgent');
  await api.fetchDirectoryContact('coAgent', 1);
  await api.updateDirectoryContact('coAgent', 1, values);
  await api.createCoAgentContact(values);
  assert.deepEqual(calls, [['get', '/agent/rooms/co-agent-contacts?q=&page=1&limit=20'], ['owner-detail', 1],
    ['owner-update', 1, values], ['post', '/agent/rooms/co-agent-contacts', values]]);
});
