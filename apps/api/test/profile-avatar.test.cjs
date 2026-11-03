const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
  fileName: filename,
}).outputText, filename);
const { AuthService } = require('../src/auth/auth.service.ts');
const { ProfileAvatarStorage, MAX_PROFILE_AVATAR_BYTES } = require('../src/auth/profile-avatar-storage.service.ts');
const bad = (error) => error.getStatus?.() === 400;

test('profile photo upload rejects a missing, invalid, or oversized file before storage', async () => {
  const storage = new ProfileAvatarStorage();
  await assert.rejects(() => storage.upload(1, undefined), bad);
  await assert.rejects(() => storage.upload(1, { buffer: Buffer.from('not-an-image'), size: 12 }), bad);
  await assert.rejects(() => storage.upload(1, { buffer: Buffer.alloc(MAX_PROFILE_AVATAR_BYTES + 1), size: MAX_PROFILE_AVATAR_BYTES + 1 }), bad);
});

test('saving a profile photo stores the uploaded address and clearing removes it', async () => {
  const user = {
    id: 7,
    email: 'agent@example.test',
    first_name: 'Ann',
    last_name: 'Agent',
    phone: '0800000000',
    avatar_url: null,
    profile_completed: true,
    user_roles: [],
  };
  let writes = 0;
  const service = new AuthService(
    { findOne: async () => user, save: async (row) => { writes += 1; return row; } },
    {},
    {},
    {},
    { upload: async (userId, file) => {
      assert.equal(userId, 7);
      assert.equal(file.size, 1);
      return 'https://cdn.example/avatar.jpg';
    }, removeOwned: async (userId, url) => { removed.push([userId, url]); return true; } },
  );
  const removed = [];
  const uploaded = await service.uploadAvatar(7, { buffer: Buffer.from('x'), size: 1 });
  assert.equal(uploaded.avatarUrl, 'https://cdn.example/avatar.jpg');
  assert.equal(user.avatar_url, 'https://cdn.example/avatar.jpg');
  assert.deepEqual(removed, [], 'no old photo to remove');
  const cleared = await service.clearAvatar(7);
  assert.equal(cleared.avatarUrl, null);
  assert.equal(user.avatar_url, null);
  assert.equal(writes, 2);
  // R5: clearing removes the photo that was saved before.
  assert.deepEqual(removed, [[7, 'https://cdn.example/avatar.jpg']]);
});

test('R5: replacing a photo removes the old one after the new address is saved', async () => {
  const user = { id: 7, email: 'a@example.test', first_name: 'A', last_name: 'B', avatar_url: 'old-url', user_roles: [] };
  const order = [];
  const service = new AuthService(
    { findOne: async () => user, save: async (row) => { order.push(['save', row.avatar_url]); return row; } },
    {}, {}, {},
    { upload: async () => 'new-url', removeOwned: async (_id, url) => { order.push(['remove', url]); return true; } },
  );
  await service.uploadAvatar(7, { buffer: Buffer.from('x'), size: 1 });
  assert.deepEqual(order, [['save', 'new-url'], ['remove', 'old-url']]);
  order.length = 0;
  await service.updateAvatar(7, 'new-url');
  assert.deepEqual(order, [['save', 'new-url']], 'the same address is not removed');
});

test('R5: only this user\'s file in this bucket on this project is ever removed', async () => {
  const old = process.env.SUPABASE_URL; process.env.SUPABASE_URL = 'https://proj.supabase.co';
  try {
    const storage = new ProfileAvatarStorage();
    const own = 'https://proj.supabase.co/storage/v1/object/public/profile-avatars/7/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
    assert.equal(storage.ownedObjectPath(7, own), '7/0f8fad5b-d9cb-469f-a165-70867728950e.jpg');
    for (const url of [
      own.replace('/7/', '/8/'),                                  // another user's photo
      own.replace('proj.supabase.co', 'evil.example'),            // another host
      own.replace('profile-avatars', 'contract-documents'),       // another bucket
      'https://proj.supabase.co/storage/v1/object/public/profile-avatars/7/..%2F8%2Fx.jpg',
      'https://lh3.googleusercontent.com/a/photo',                // a Google profile picture
      'not a url', null,
    ]) assert.equal(storage.ownedObjectPath(7, url), null, String(url));
    const calls = [];
    storage.storage = () => ({ remove: async (paths) => { calls.push(paths); return { error: null }; } });
    assert.equal(await storage.removeOwned(7, own), true);
    assert.equal(await storage.removeOwned(7, 'https://lh3.googleusercontent.com/a/photo'), false);
    assert.deepEqual(calls, [['7/0f8fad5b-d9cb-469f-a165-70867728950e.jpg']]);
    storage.storage = () => ({ remove: async () => ({ error: new Error('storage down') }) });
    storage.logger = { warn() {} };
    assert.equal(await storage.removeOwned(7, own), false, 'a failed removal does not throw');
  } finally { if (old === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = old; }
});
