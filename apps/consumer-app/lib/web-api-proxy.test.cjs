// Dev web API proxy (Mos 4 Nov 2026): app side (lib/web-api-proxy.ts) and Metro side (scripts/dev-api-proxy.cjs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'web-api-proxy.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('web-api-proxy must stay dependency free'); }, mod, mod.exports);
const { webDevApiUrl } = mod.exports;
const { loopbackApiOrigin, createDevApiProxy, withDevApiProxy } = require('../scripts/dev-api-proxy.cjs');

const web = { dev: true, isWeb: true, origin: 'http://127.0.0.1:8081' };

test('dev web: a local API on another port is called through the page origin', () => {
  assert.equal(webDevApiUrl('http://localhost:4000/api/v1', web), 'http://127.0.0.1:8081/api/v1');
  assert.equal(webDevApiUrl('http://127.0.0.1:4000/api/v1/', { ...web, origin: 'http://localhost:8081' }), 'http://localhost:8081/api/v1');
});

test('phones, builds, remote APIs, same origin and the off switch keep the URL', () => {
  const api = 'http://localhost:4000/api/v1';
  assert.equal(webDevApiUrl(api, { ...web, dev: false }), api);
  assert.equal(webDevApiUrl(api, { ...web, isWeb: false }), api);
  assert.equal(webDevApiUrl(api, { ...web, origin: null }), api);
  assert.equal(webDevApiUrl(api, { ...web, flag: 'false' }), api);
  assert.equal(webDevApiUrl('https://nestyk-dev.up.railway.app/api/v1', web), 'https://nestyk-dev.up.railway.app/api/v1');
  assert.equal(webDevApiUrl('http://192.168.1.5:4000/api/v1', web), 'http://192.168.1.5:4000/api/v1');
  assert.equal(webDevApiUrl(api, { ...web, origin: 'https://agent.nestyk.com' }), api);
  assert.equal(webDevApiUrl('http://localhost:4000/v1', web), 'http://localhost:4000/v1');
  assert.equal(webDevApiUrl('http://localhost:8081/api/v1', { ...web, origin: 'http://localhost:8081' }), 'http://localhost:8081/api/v1');
});

test('Metro side forwards only for a local API, and can be switched off', () => {
  assert.equal(loopbackApiOrigin('http://localhost:4000/api/v1'), 'http://localhost:4000');
  assert.equal(loopbackApiOrigin(undefined), 'http://localhost:4000');
  assert.equal(loopbackApiOrigin('https://nestyk-dev.up.railway.app/api/v1'), null);
  assert.equal(loopbackApiOrigin('http://localhost:4000/api/v1', 'false'), null);
  const config = { server: {} };
  assert.equal(withDevApiProxy(config, { EXPO_PUBLIC_API_URL: 'https://x.example/api/v1' }), config);
  assert.equal(config.server.enhanceMiddleware, undefined);
  assert.equal(typeof withDevApiProxy({ server: {} }, {}).server.enhanceMiddleware, 'function');
});

test('proxy passes method, path, query, headers and body, and answers 502 when the API is down', async () => {
  const api = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(201, { 'content-type': 'application/json', 'x-api': 'yes' });
      res.end(JSON.stringify({ method: req.method, url: req.url, auth: req.headers.authorization, body }));
    });
  });
  await new Promise((r) => api.listen(0, '127.0.0.1', r));
  const target = `http://127.0.0.1:${api.address().port}`;
  const proxy = createDevApiProxy(target);
  const front = http.createServer((req, res) => proxy(req, res, () => { res.writeHead(200); res.end('metro'); }));
  await new Promise((r) => front.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${front.address().port}`;
  try {
    const res = await fetch(`${base}/api/v1/leads?q=a`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: 'x=1' });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('x-api'), 'yes');
    assert.deepEqual(await res.json(), { method: 'POST', url: '/api/v1/leads?q=a', auth: 'Bearer t', body: 'x=1' });
    assert.equal(await (await fetch(`${base}/agent/leads`)).text(), 'metro');
    assert.equal(await (await fetch(`${base}/apis`)).text(), 'metro');
    api.close();
    await new Promise((r) => setTimeout(r, 50));
    const down = await fetch(`${base}/api/v1/health`);
    assert.equal(down.status, 502);
  } finally {
    front.close();
    api.close();
  }
});
