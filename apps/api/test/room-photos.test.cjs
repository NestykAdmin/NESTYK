const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
// Load the actual Nest classes, including decorator metadata, without a build artifact.
require.extensions['.ts'] = (module, filename) => {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
  }, fileName: filename }).outputText, filename);
};
const sharp = require('sharp');
const { RoomPhotoStorageService, MAX_ROOM_PHOTO_BYTES } = require('../src/agent/rooms/room-photo-storage.service.ts');
const { AgentRoomsController } = require('../src/agent/rooms/agent-rooms.controller.ts');
const { AgentRoomsService } = require('../src/agent/rooms/agent-rooms.service.ts');
const { ListingPromoService } = require('../src/agent/rooms/listing-promo.service.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

test('real multipart room photo upload, retrieval and ownership validation', async (t) => {
  process.env.ALLOW_DEV_AUTH = 'true';
  delete process.env.PUBLIC_API_URL;
  const objects = new Map();
  let failUpload = false;
  let failVerify = false;
  const cloudOrigin = 'https://photos.supabase.co';
  const cloud = {
    upload: async (key, buffer, options) => {
      assert.equal(options.contentType, 'image/jpeg');
      assert.equal(options.upsert, false);
      if (failUpload) return { error: new Error('unavailable') };
      objects.set(key, buffer);
      return { error: null };
    },
    getPublicUrl: (key) => ({ data: { publicUrl: `${cloudOrigin}/storage/v1/object/public/property-images/${key}` } }),
    exists: async (key) => ({ data: objects.has(key), error: failVerify ? new Error('unavailable') : null }),
  };
  const storage = new RoomPhotoStorageService();
  storage.storage = () => cloud;
  let bucketExists = false;
  let bucketAttempts = 0;
  storage.client = { storage: {
    listBuckets: async () => ({ data: bucketExists ? [{ name: 'property-images' }] : [], error: null }),
    createBucket: async (name, options) => {
      bucketAttempts++;
      assert.equal(name, 'property-images');
      assert.equal(options.public, true);
      if (bucketAttempts === 1) return { error: new Error('temporary failure') };
      bucketExists = true;
      return { error: null };
    },
  } };
  class TestModule {}
  Module({ controllers: [AgentRoomsController], providers: [
    { provide: RoomPhotoStorageService, useValue: storage },
    { provide: AgentRoomsService, useValue: {} },
    { provide: ListingPromoService, useValue: {} },
    { provide: AuthService, useValue: {
      findBySupabaseUserId: async () => ({ id: 7 }),
      loadUserWithRoles: async () => ({ id: 7, roleNames: ['agent'] }),
    } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api/v1');
  t.after(async () => { await app.close(); });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const upload = async (buffer, auth = true) => {
    const body = new FormData();
    body.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'untrusted.jpg');
    return fetch(`${base}/api/v1/agent/rooms/media/upload`, { method: 'POST', body,
      headers: auth ? { Authorization: 'Bearer dev|photo-test|test@example.invalid' } : {} });
  };
  const original = await sharp({ create: { width: 3000, height: 100, channels: 3, background: 'red' } }).png().toBuffer();
  assert.equal((await upload(original, false)).status, 401);
  assert.equal((await upload(Buffer.from('<script>not an image</script>'))).status, 400);
  assert.equal((await upload(Buffer.alloc(MAX_ROOM_PHOTO_BYTES + 1))).status, 413);
  assert.equal((await upload(original)).status, 503);
  const response = await upload(original);
  assert.equal(bucketAttempts, 2);
  assert.equal(response.status, 200);
  const { mediaUrl } = await response.json();
  assert.ok(mediaUrl.startsWith(`${cloudOrigin}/storage/v1/object/public/property-images/7/`));
  const metadata = await sharp(objects.values().next().value).metadata();
  assert.equal(metadata.width, 2400);
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.exif, undefined);
  await storage.validateRoomPhotos(7, [{ mediaUrl }], base);
  await assert.rejects(storage.validateRoomPhotos(8, [{ mediaUrl }], base));
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl }, { mediaUrl }], base));
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl: mediaUrl.replace(cloudOrigin, 'https://evil.invalid') }], base));
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl: `${base}/api/v1/room-images/7/00000000-0000-4000-8000-000000000000.jpg` }], base));
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl: `${mediaUrl}?download=1` }], base));
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl, mediaType: 'video' }], base));
  failUpload = true;
  assert.equal((await upload(original)).status, 503);
  failVerify = true;
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl }], base), { status: 503 });
  failVerify = false;
  objects.clear();
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl }], base), { status: 400 });
  assert.equal((await fetch(`${base}/api/v1/room-images/7/00000000-0000-4000-8000-000000000000.jpg`)).status, 404);
  await storage.validateRoomPhotos(7, [], base);
});

test('AI photo enhance requires CLAID_API_KEY and returns enhanced upload when configured', async (t) => {
  const previousKey = process.env.CLAID_API_KEY;
  const previousUrl = process.env.CLAID_API_URL;
  t.after(() => {
    if (previousKey == null) delete process.env.CLAID_API_KEY; else process.env.CLAID_API_KEY = previousKey;
    if (previousUrl == null) delete process.env.CLAID_API_URL; else process.env.CLAID_API_URL = previousUrl;
  });
  delete process.env.CLAID_API_KEY;
  const objects = new Map();
  const cloudOrigin = 'https://photos.supabase.co';
  const storage = new RoomPhotoStorageService();
  storage.storage = () => ({
    upload: async (key, buffer) => { objects.set(key, buffer); return { error: null }; },
    getPublicUrl: (key) => ({ data: { publicUrl: `${cloudOrigin}/storage/v1/object/public/property-images/${key}` } }),
    exists: async (key) => ({ data: objects.has(key), error: null }),
  });
  storage.client = { storage: {
    listBuckets: async () => ({ data: [{ name: 'property-images' }], error: null }),
    createBucket: async () => ({ error: null }),
  } };
  const jpeg = await sharp({ create: { width: 200, height: 200, channels: 3, background: 'blue' } }).jpeg().toBuffer();
  await assert.rejects(storage.enhance(7, { buffer: jpeg, size: jpeg.length }, 'http://localhost'), { status: 503 });

  process.env.CLAID_API_KEY = 'test-key';
  process.env.CLAID_API_URL = 'https://claid.test';
  const originalFetch = globalThis.fetch;
  const enhancedJpeg = await sharp({ create: { width: 180, height: 180, channels: 3, background: 'green' } }).jpeg().toBuffer();
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://claid.test/v1/image/edit/upload') {
      assert.equal(init.headers.Authorization, 'Bearer test-key');
      assert.ok(init.body instanceof FormData);
      return new Response(JSON.stringify({ data: { output: { tmp_url: 'https://claid.test/tmp/enhanced.jpg' } } }), { status: 200 });
    }
    if (url === 'https://claid.test/tmp/enhanced.jpg') {
      return new Response(enhancedJpeg, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const result = await storage.enhance(7, { buffer: jpeg, size: jpeg.length }, 'http://localhost');
  assert.ok(result.mediaUrl.startsWith(`${cloudOrigin}/storage/v1/object/public/property-images/7/`));
  assert.equal(objects.size, 1);
});
