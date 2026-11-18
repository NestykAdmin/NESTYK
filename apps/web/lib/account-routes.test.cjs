const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const routes = require('./account-routes.js');
const appRoutesFile = path.join(__dirname, '..', '..', 'consumer-app', 'lib', 'app-routes.ts');

// nestyk-guest-session-plan-20261112.md, A1–A3: nestyk.com is one site; account pages go to the consumer-app.

test('the list covers every sign-in, legal and role path of the consumer-app (kept in step)', () => {
  const app = require(appRoutesFile);
  for (const p of [...app.AUTH_PATHS, ...app.LEGAL_PATHS]) assert.ok(routes.ACCOUNT_PAGE_PATHS.includes(p), `missing ${p}`);
  for (const p of Object.values(app.ROLE_PATH)) assert.ok(routes.ACCOUNT_ROLE_PATHS.includes(p), `missing ${p}`);
  // Old /owner links: the consumer-app sends them on to /landlord (review R5).
  assert.equal(app.parseAppPath('/owner/rooms').kind, 'redirect');
  assert.ok(routes.ACCOUNT_ROLE_PATHS.includes('/owner'), 'missing /owner');
  assert.deepEqual(routes.ACCOUNT_ASSET_PATHS, ['/_expo', '/assets']);
});

test('no account path clashes with a page or file of the guest web (review R5: every route folder, public/)', () => {
  const app = path.join(__dirname, '..', 'app');
  const names = new Set();
  const collect = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) { names.add(entry.name.replace(/\.[^.]+$/, '')); continue; }
      if (/^\(.*\)$/.test(entry.name)) collect(path.join(dir, entry.name)); // route group: its children are top level
      else names.add(entry.name);
    }
  };
  collect(app);
  collect(path.join(app, '[locale]'));
  collect(path.join(__dirname, '..', 'public'));
  assert.ok(names.has('search') && names.has('saved'), 'the scan sees the guest pages');
  for (const p of routes.ACCOUNT_PATHS) assert.ok(!names.has(p.slice(1)), `${p} is also a guest web page or file`);
});

test('the upstream must be an http(s) address; anything else turns the rewrite off', () => {
  assert.equal(routes.accountWebUpstream('https://nestyk-account.vercel.app/'), 'https://nestyk-account.vercel.app');
  assert.equal(routes.accountWebUpstream(' http://localhost:8090 '), 'http://localhost:8090');
  assert.equal(routes.accountWebUpstream('https://x.example/some/path'), 'https://x.example');
  for (const bad of [undefined, '', '   ', 'localhost:8090', 'javascript:alert(1)', 'ftp://x.example', 'https://']) {
    assert.equal(routes.accountWebUpstream(bad), '', String(bad));
  }
});

test('without an upstream there are no account rewrites (same as before)', () => {
  assert.deepEqual(routes.accountRewrites(''), []);
});

test('with an upstream, pages go across as they are and role/file paths keep their sub-paths', () => {
  const list = routes.accountRewrites('http://localhost:8090');
  const find = (source) => list.find((r) => r.source === source);
  assert.deepEqual(find('/login'), { source: '/login', destination: 'http://localhost:8090/login' });
  assert.deepEqual(find('/terms'), { source: '/terms', destination: 'http://localhost:8090/terms' });
  assert.deepEqual(find('/agent'), { source: '/agent', destination: 'http://localhost:8090/agent' });
  assert.deepEqual(find('/agent/:path*'), { source: '/agent/:path*', destination: 'http://localhost:8090/agent/:path*' });
  assert.deepEqual(find('/_expo/:path*'), { source: '/_expo/:path*', destination: 'http://localhost:8090/_expo/:path*' });
  assert.deepEqual(find('/assets/:path*'), { source: '/assets/:path*', destination: 'http://localhost:8090/assets/:path*' });
  assert.equal(find('/search'), undefined, 'guest pages stay on the guest web');
});

test('in local dev only, anything the guest web has no page for goes to the Expo dev server (its bundles live under /node_modules)', () => {
  assert.deepEqual(routes.accountDevFallback('http://127.0.0.1:8081', 'development'), [
    { source: '/:path*', destination: 'http://127.0.0.1:8081/:path*' },
  ]);
  assert.deepEqual(routes.accountDevFallback('http://127.0.0.1:8081', 'production'), [], 'never on a deploy');
  assert.deepEqual(routes.accountDevFallback('http://127.0.0.1:8081', undefined), []);
  assert.deepEqual(routes.accountDevFallback('', 'development'), [], 'off without an upstream');
});

test('next.config.js sends account paths across before the guest pages, and keeps /api', () => {
  const config = fs.readFileSync(path.join(__dirname, '..', 'next.config.js'), 'utf8');
  assert.match(config, /require\('\.\/lib\/account-routes(\.js)?'\)/);
  assert.match(config, /accountWebUpstream\(process\.env\.ACCOUNT_WEB_UPSTREAM\)/);
  assert.match(config, /beforeFiles:\s*accountRewrites\(/);
  assert.match(config, /source: '\/api\/:path\*'/);
  assert.match(config, /fallback:\s*accountDevFallback\(ACCOUNT_WEB_UPSTREAM, process\.env\.NODE_ENV\)/);
});

test('the consumer-app on this site calls /api/v1/... (its dev API proxy path); that goes to the API as it is, not /api/v1/v1', () => {
  const config = fs.readFileSync(path.join(__dirname, '..', 'next.config.js'), 'utf8');
  const v1 = config.indexOf("source: '/api/v1/:path*'");
  const api = config.indexOf("source: '/api/:path*'");
  assert.ok(v1 > -1, 'has an /api/v1 rule');
  assert.ok(v1 < api, 'the /api/v1 rule comes first (Next uses the first match)');
  assert.match(config, /source: '\/api\/v1\/:path\*',\s*destination: `\$\{API_URL\}\/api\/v1\/:path\*`/);
});

test('the language middleware leaves account paths alone and still handles guest pages', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'middleware.ts'), 'utf8');
  const matcher = source.match(/matcher:\s*\[\s*'([^']+)'/)[1].replace(/\\\\/g, '\\');
  const handled = (p) => new RegExp(`^${matcher}$`).test(p);
  for (const p of routes.ACCOUNT_PATHS) {
    assert.equal(handled(p), false, p);
    assert.equal(handled(`${p}/x`), false, `${p}/x`);
  }
  for (const p of ['/agent/leads/123', '/_expo/static/js/web/entry', '/assets/fonts/x']) assert.equal(handled(p), false, p);
  for (const p of ['/', '/search', '/en/search', '/ja', '/saved', '/profile', '/agents-guide', '/loginx', '/termsheet']) {
    assert.equal(handled(p), true, p);
  }
});
