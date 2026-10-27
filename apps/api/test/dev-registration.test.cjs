const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { AuthService } = require('../src/auth/auth.service.ts');

function environment(t, values = {}) {
  const next = { NODE_ENV: 'development', ALLOW_DEV_REGISTRATION: 'true', ...values };
  for (const [name, value] of Object.entries(next)) {
    const before = process.env[name];
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
    t.after(() => { if (before === undefined) delete process.env[name]; else process.env[name] = before; });
  }
}

function allowed(request = {}) {
  const { DevRegistrationGuard } = require('../src/auth/guards/dev-registration.guard.ts');
  const req = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:4000', origin: 'http://localhost:8081' }, ...request };
  return new DevRegistrationGuard().canActivate({ switchToHttp: () => ({ getRequest: () => req }) });
}

test('test registration is closed unless explicitly enabled in development', t => {
  environment(t, { ALLOW_DEV_REGISTRATION: undefined });
  assert.throws(() => allowed(), e => e.getStatus() === 404);
  process.env.ALLOW_DEV_REGISTRATION = 'true';
  for (const env of ['production', 'staging', 'test', '']) {
    process.env.NODE_ENV = env;
    assert.throws(() => allowed(), e => e.getStatus() === 404);
  }
  process.env.NODE_ENV = 'development';
  assert.equal(allowed(), true);
});

test('only direct local requests from local pages may use test registration', t => {
  environment(t);
  for (const remoteAddress of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    assert.equal(allowed({ socket: { remoteAddress } }), true);
  }
  assert.equal(allowed({ headers: { host: '[::1]:4000' } }), true);
  for (const remoteAddress of ['192.168.1.5', '203.0.113.7', undefined]) {
    assert.throws(() => allowed({ socket: { remoteAddress } }), e => e.getStatus() === 404);
  }
  for (const headers of [
    { host: 'api.example.test' },
    { host: 'localhost:4000', origin: 'https://untrusted.example' },
    { host: 'localhost:4000', origin: 'http://localhost.evil.test' },
    { host: 'localhost:4000', origin: 'null' },
    { host: 'localhost:4000', 'sec-fetch-site': 'cross-site' },
    ...['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'].map(header => ({ host: 'localhost:4000', [header]: '127.0.0.1' })),
  ]) assert.throws(() => allowed({ headers }), e => e.getStatus() === 404);
});

function serviceWithAdmin(result) {
  const calls = [];
  const service = new AuthService({}, {}, {}, {});
  service.registrationAdminClient = { auth: { admin: { createUser: async input => { calls.push(input); return result; } } } };
  return { service, calls };
}
const input = () => ({ email: `${randomUUID()}@example.test`, password: randomBytes(12).toString('hex'), firstName: 'Mary Ann', lastName: 'Van Buren' });

test('local test signup creates a confirmed Supabase user with normal registration metadata and returns no credentials', async t => {
  environment(t);
  const { service, calls } = serviceWithAdmin({ data: { user: { id: randomUUID() } }, error: null });
  const body = input();
  assert.deepEqual(await service.registerForTesting({ ...body, email: ` ${body.email.toUpperCase()} `, firstName: ' Mary Ann ' }), { created: true });
  assert.deepEqual(calls, [{ email: body.email, password: body.password, email_confirm: true,
    user_metadata: { first_name: 'Mary Ann', last_name: 'Van Buren', full_name: 'Mary Ann Van Buren', registration_source: 'self_service' } }]);
});

test('invalid input and disabled environments never call the privileged Supabase operation', async t => {
  environment(t);
  const { service, calls } = serviceWithAdmin({ data: { user: { id: randomUUID() } }, error: null });
  for (const body of [null, [], {}, { ...input(), email: 'invalid' }, { ...input(), password: 'short' },
    { ...input(), firstName: ' ' }, { ...input(), lastName: 7 }]) {
    await assert.rejects(service.registerForTesting(body), e => e.getStatus() === 400);
  }
  process.env.NODE_ENV = 'production';
  await assert.rejects(service.registerForTesting(input()), e => e.getStatus() === 404);
  assert.deepEqual(calls, []);
});

test('duplicate emails are refused without confirming or changing an existing user', async t => {
  environment(t);
  const { service, calls } = serviceWithAdmin({ data: { user: null }, error: { code: 'email_exists', message: 'Already exists' } });
  await assert.rejects(service.registerForTesting(input()), e => e.getStatus() === 409 && e.getResponse().code === 'email_exists');
  assert.equal(calls.length, 1);
});

test('an unconfigured test signup and provider failures return safe machine-readable errors', async t => {
  environment(t, { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined });
  const unconfigured = new AuthService({}, {}, {}, {});
  await assert.rejects(unconfigured.registerForTesting(input()), e => e.getStatus() === 503 && e.getResponse().code === 'TEST_REGISTRATION_UNAVAILABLE');
  const { service } = serviceWithAdmin({ data: { user: null }, error: { message: 'Private provider diagnostic' } });
  await assert.rejects(service.registerForTesting(input()), e => e.getStatus() === 400 && e.getResponse().code === 'REGISTRATION_FAILED' && !e.message.includes('Private'));
});

test('the HTTP test registration route enforces the guard before it reaches the service', async t => {
  environment(t);
  const { Module } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const { AuthController } = require('../src/auth/auth.controller.ts');
  const calls = [];
  class TestModule {}
  Module({ controllers: [AuthController], providers: [{ provide: AuthService, useValue: {
    registerForTesting: async body => { calls.push(body); return { created: true }; },
  } }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const url = `http://127.0.0.1:${app.getHttpServer().address().port}/auth/dev/register`;
  const body = input();
  const send = (headers = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await send()).status, 201);
  assert.deepEqual(calls, [body]);
  process.env.NODE_ENV = 'production';
  assert.equal((await send()).status, 404);
  process.env.NODE_ENV = 'development';
  process.env.ALLOW_DEV_REGISTRATION = 'false';
  assert.equal((await send()).status, 404);
  process.env.ALLOW_DEV_REGISTRATION = 'true';
  assert.equal((await send({ origin: 'https://untrusted.example' })).status, 404);
  assert.equal((await send({ 'x-forwarded-for': '127.0.0.1' })).status, 404);
  assert.equal(calls.length, 1);
});
