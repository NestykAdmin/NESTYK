// AUTH-3 (nestyk-auth3-saved-rooms-plan-20261113.md 2.3): the guest web saves rooms through the API with the
// signed-in account's token. The rules here are the browser half of /me/saved-rooms (apps/api/src/me).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in deps) return deps[id];
    throw new Error(`unexpected import ${id} in ${file}`);
  }, mod, mod.exports);
  return mod.exports;
}

const saved = loadTs(path.join(__dirname, 'guest-saved.ts'));

/** A fetch that records the calls and answers with the given status and body. */
function fakeFetch(status, body) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError('no body');
        return body;
      },
    };
  };
  fn.calls = calls;
  return fn;
}

test('room ids: only the public id form the API accepts (same rule as parseSavedRoomId)', () => {
  assert.equal(saved.isSavedRoomId('1'), true);
  assert.equal(saved.isSavedRoomId('2147483647'), true);
  for (const bad of ['0', '01', '-1', '1.5', '2147483648', '12345678901', 'abc', '', ' 1', '1/2', undefined, null, 7]) {
    assert.equal(saved.isSavedRoomId(bad), false, String(bad));
  }
});

test('the API is reached through this site (/api → /api/v1), one room per path', () => {
  assert.equal(saved.SAVED_ROOMS_URL, '/api/me/saved-rooms');
  assert.equal(saved.SAVED_ROOM_IDS_URL, '/api/me/saved-rooms/ids');
  assert.equal(saved.savedRoomUrl('42'), '/api/me/saved-rooms/42');
  assert.throws(() => saved.savedRoomUrl('../users'), /room id/);
});

test('saved ids from the API: strings only, valid ids only, each once', () => {
  assert.deepEqual(saved.parseSavedIds({ ids: ['3', '1', '3', 'x', 5, null, '0'] }), ['3', '1']);
  assert.deepEqual(saved.parseSavedIds({ ids: 'nope' }), []);
  assert.deepEqual(saved.parseSavedIds(null), []);
});

test('a toggle answer tells the heart what happened', () => {
  assert.equal(saved.toggleResult(204, undefined), 'ok');
  assert.equal(saved.toggleResult(200, {}), 'ok');
  assert.equal(saved.toggleResult(409, { code: 'SAVED_ROOMS_LIMIT', message: 'x' }), 'limit');
  assert.equal(saved.toggleResult(409, { code: 'OTHER' }), 'failed');
  assert.equal(saved.toggleResult(404, { statusCode: 404, message: 'Room not found' }), 'gone');
  // review R8: a 404 for the route itself (API not deployed yet) is a failure, not "this room is gone".
  assert.equal(saved.toggleResult(404, { statusCode: 404, message: 'Cannot PUT /api/v1/me/saved-rooms/9' }), 'failed');
  assert.equal(saved.toggleResult(404, {}), 'failed');
  assert.equal(saved.toggleResult(401, {}), 'signedOut');
  assert.equal(saved.toggleResult(500, {}), 'failed');
  assert.equal(saved.toggleResult(0, undefined), 'failed');
});

test('withSaved never changes the set it was given', () => {
  const before = new Set(['1', '2']);
  const added = saved.withSaved(before, '3', true);
  const removed = saved.withSaved(before, '1', false);
  assert.deepEqual([...before], ['1', '2']);
  assert.deepEqual([...added].sort(), ['1', '2', '3']);
  assert.deepEqual([...removed], ['2']);
  assert.equal(saved.withSaved(before, '1', true), before, 'no change keeps the same set (no re-render)');
});

test('requests carry the bearer token, skip every cache, and send no cookies', async () => {
  const fetchIds = fakeFetch(200, { ids: ['9'] });
  assert.deepEqual(await saved.fetchSavedIds('tok', fetchIds), ['9']);
  const [{ url, init }] = fetchIds.calls;
  assert.equal(url, '/api/me/saved-rooms/ids');
  assert.equal(init.headers.Authorization, 'Bearer tok');
  assert.equal(init.cache, 'no-store');
  assert.equal(init.credentials, 'omit');

  const put = fakeFetch(204);
  assert.equal(await saved.setRoomSaved('tok', '9', true, put), 'ok');
  assert.equal(put.calls[0].init.method, 'PUT');
  assert.equal(put.calls[0].url, '/api/me/saved-rooms/9');

  const del = fakeFetch(204);
  assert.equal(await saved.setRoomSaved('tok', '9', false, del), 'ok');
  assert.equal(del.calls[0].init.method, 'DELETE');
});

test('a failed or broken answer is reported, never thrown', async () => {
  assert.equal(await saved.fetchSavedIds('tok', fakeFetch(500, {})), null);
  assert.equal(await saved.fetchSavedRooms('tok', fakeFetch(401, {})), null);
  assert.equal(await saved.fetchSavedRooms('tok', fakeFetch(200, { not: 'a list' })), null);
  const offline = async () => {
    throw new TypeError('Failed to fetch');
  };
  assert.equal(await saved.fetchSavedIds('tok', offline), null);
  assert.equal(await saved.setRoomSaved('tok', '9', true, offline), 'failed');
  assert.equal(await saved.setRoomSaved('tok', 'bad', true, fakeFetch(204)), 'failed', 'a bad id never reaches the API');
});

test('the saved list keeps the API order (newest first) and drops cards without an id', async () => {
  const list = fakeFetch(200, [{ id: '7' }, { id: '' }, { id: '3' }, null]);
  assert.deepEqual((await saved.fetchSavedRooms('tok', list)).map((card) => card.id), ['7', '3']);
  assert.equal(list.calls[0].url, '/api/me/saved-rooms');
});
