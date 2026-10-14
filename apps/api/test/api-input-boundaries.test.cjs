const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { DatabaseIdPipe } = require('../src/common/database-id.pipe.ts');
const { SingleQueryPipe } = require('../src/common/single-query.pipe.ts');
const { AgentRoomsService } = require('../src/agent/rooms/agent-rooms.service.ts');
const { ListingPromoService } = require('../src/agent/rooms/listing-promo.service.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const bad = e => e.getStatus?.() === 400;

test('database IDs reject SQL overflow, non-positive and non-integer IDs', async () => {
  const pipe = new DatabaseIdPipe();
  for (const id of ['2147483648', '99999999999999999', '-1', '0', '1.5', '1e3', 'abc']) {
    await assert.rejects(() => pipe.transform(id, { type: 'param', data: 'id' }), bad);
  }
  for (const id of ['1', '2147483647']) assert.equal(await pipe.transform(id, { type: 'param', data: 'id' }), Number(id));
});

test('query parsing rejects arrays and nested values before service filtering', () => {
  const pipe = new SingleQueryPipe();
  for (const value of [['a', 'b'], { nested: 'x' }, null, 12]) {
    assert.throws(() => pipe.transform(value, { type: 'query', data: 'q' }), bad);
    assert.throws(() => pipe.transform({ q: value }, { type: 'query' }), bad);
  }
  assert.deepEqual(pipe.transform({ q: 'Bangkok', locations: '["A","B"]' }, { type: 'query' }), { q: 'Bangkok', locations: '["A","B"]' });
});

test('room create and update reject wrong JSON types and overlong fields before any writes', async () => {
  const service = new AgentRoomsService({}, { transaction: async () => assert.fail('Invalid input must not enter a transaction') });
  const base = { visibility: 'private', propertyId: 1, contactId: 1, listingTitle: 'Room', roomTypeId: 1, listingSourceCode: 'owner', prices: [{ contractTypeId: 1, price: 15000 }], layout: [{ code: 'bedroom', value: '1' }, { code: 'bathroom', value: '1' }] };
  const inputs = [null, [], { ...base, listingTitle: 42 }, { ...base, listingTitle: 'x'.repeat(256) },
    { ...base, contactId: undefined, contact: { name: 42, phone: '0800000000' } },
    { ...base, contactIds: [2147483648] }, { ...base, propertyId: undefined, property: { address: [] } },
    { ...base, medias: {} }, { ...base, medias: [null] }, { ...base, prices: [null] },
    { ...base, prices: [{ contractTypeId: 1, price: 1e20 }] }, { ...base, layout: {} },
    { ...base, documents: [{ kind: 'other', mediaUrl: 'https://example.invalid/document.pdf', sortOrder: {} }] }];
  for (const input of inputs) for (const existingId of [undefined, 9]) {
    await assert.rejects(() => service.createScoutRoom({ id: 7 }, input, 'http://localhost', existingId), bad);
  }
});

test('listing locale validation rejects arrays and objects before calling Gemini', async () => {
  const service = new ListingPromoService({ generateContent: async () => assert.fail('Must not call AI with invalid locale') });
  for (const locale of [['th', 'en'], { language: 'th' }, 42]) {
    await assert.rejects(() => service.generate({ listing: {}, outputLocale: locale }), bad);
  }
});

test('Agent profile rejects bad types/column overflow and recomputes completion after a patch', async () => {
  const user = { id: 7, first_name: 'Agent', last_name: '', phone: '0800000000', profile_completed: true };
  let writes = 0;
  const service = new AuthService({ findOne: async () => user, save: async () => { writes++; } }, {}, {}, {});
  service.loadUserWithRoles = async () => ({ ...user, user_roles: [] });
  for (const patch of [null, [], { firstName: 42 }, { firstName: 'a'.repeat(256) }, { phone: {} }, { phone: '1'.repeat(51) }]) {
    await assert.rejects(() => service.updateProfile(7, patch), bad);
  }
  for (const avatar of [42, {}, 'https://example.invalid/' + 'a'.repeat(513)]) await assert.rejects(() => service.updateAvatar(7, avatar), bad);
  assert.equal(writes, 0);
  await service.updateProfile(7, { phone: null });
  assert.equal(user.profile_completed, false);
  await service.updateProfile(7, { phone: '0800000001' });
  assert.equal(user.profile_completed, true);
});
