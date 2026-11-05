// lib/agent-session.ts: self-registered accounts get the agent role from the API (auth.service.ts). The app does not
// ask for the role itself unless a dev build opts in (QA web role URL bug, 4 Nov 2026: typing /agent/rooms as a tenant
// sent POST /auth/dev/roles {role:"agent"}).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const SOURCE = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'agent-session.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load({ roles, development = true, env }) {
  const posts = [];
  const apiPost = async (route, body) => {
    posts.push([route, body]);
    return route === '/auth/sync' ? { id: 1, email: 'a@example.test', roles } : { id: 1, email: 'a@example.test', roles: [...roles, 'agent'] };
  };
  const saved = process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT;
  if (env === undefined) delete process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT; else process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT = env;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', SOURCE)((id) => {
    if (id === './api') return { apiPost };
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports, development);
  const restore = () => { if (saved === undefined) delete process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT; else process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT = saved; };
  return { ...mod.exports, posts, restore };
}

test('an agent (a self-registered account) only syncs', async () => {
  const s = load({ roles: ['guest', 'agent'] });
  try {
    assert.deepEqual((await s.ensureAgentSession()).roles, ['guest', 'agent']);
    assert.deepEqual(s.posts.map((p) => p[0]), ['/auth/sync']);
  } finally { s.restore(); }
});

test('an account without the agent role gets AGENT_ROLE_REQUIRED and never asks for the role', async () => {
  for (const [development, env] of [[true, undefined], [true, 'false'], [false, 'true']]) {
    const s = load({ roles: ['guest', 'tenant'], development, env });
    try {
      await assert.rejects(() => s.ensureAgentSession(), (e) => e.code === s.AGENT_ROLE_REQUIRED);
      assert.deepEqual(s.posts.map((p) => p[0]), ['/auth/sync'], `development=${development} env=${env}`);
    } finally { s.restore(); }
  }
});

test('a dev build that opts in still asks for the agent role (local development)', async () => {
  const s = load({ roles: ['guest'], development: true, env: 'true' });
  try {
    await s.ensureAgentSession();
    assert.deepEqual(s.posts, [['/auth/sync', {}], ['/auth/dev/roles', { role: 'agent' }]]);
  } finally { s.restore(); }
});

test('a failed check is not cached: the next call syncs again', async () => {
  const s = load({ roles: ['guest'] });
  try {
    await assert.rejects(() => s.ensureAgentSession());
    await assert.rejects(() => s.ensureAgentSession());
    assert.deepEqual(s.posts.map((p) => p[0]), ['/auth/sync', '/auth/sync']);
  } finally { s.restore(); }
});
