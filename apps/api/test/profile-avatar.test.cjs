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
    } },
  );
  const uploaded = await service.uploadAvatar(7, { buffer: Buffer.from('x'), size: 1 });
  assert.equal(uploaded.avatarUrl, 'https://cdn.example/avatar.jpg');
  assert.equal(user.avatar_url, 'https://cdn.example/avatar.jpg');
  const cleared = await service.clearAvatar(7);
  assert.equal(cleared.avatarUrl, null);
  assert.equal(user.avatar_url, null);
  assert.equal(writes, 2);
});
