const test = require("node:test");
const assert = require("node:assert/strict");
const { pickFile, contentType, cacheControl, readArgs } = require("../scripts/serve-web-dist.cjs");

const files = new Set(["index.html", "_expo/static/js/web/entry-abc.js", "favicon.ico", "privacy/index.html"]);
const isFile = (rel) => files.has(rel);

test("serves real files as they are", () => {
  assert.deepEqual(pickFile("/_expo/static/js/web/entry-abc.js", isFile), { status: 200, file: "_expo/static/js/web/entry-abc.js" });
  assert.deepEqual(pickFile("/favicon.ico?v=2", isFile), { status: 200, file: "favicon.ico" });
  assert.deepEqual(pickFile("/privacy", isFile), { status: 200, file: "privacy/index.html" });
});

test("app paths fall back to index.html so a refresh on a deep path loads", () => {
  for (const p of ["/", "/agent", "/agent/leads", "/agent/calendar?date=2026-11-05", "/agent/rooms/new#x"]) {
    assert.deepEqual(pickFile(p, isFile), { status: 200, file: "index.html", fallback: true }, p);
  }
});

test("a missing file with an extension is 404, not the app", () => {
  assert.deepEqual(pickFile("/_expo/static/js/web/old-123.js", isFile), { status: 404 });
  assert.deepEqual(pickFile("/logo.png", isFile), { status: 404 });
});

test("paths outside dist and broken encoding are refused", () => {
  // "/.." cannot climb above dist: the path is cleaned to "etc/passwd" inside dist, which is not a file -> the app.
  assert.deepEqual(pickFile("/../../etc/passwd", isFile), { status: 200, file: "index.html", fallback: true });
  assert.deepEqual(pickFile("/%E0%A4%A", isFile), { status: 400 });
});

test("content type and cache rules", () => {
  assert.equal(contentType("index.html"), "text/html; charset=utf-8");
  assert.equal(contentType("a.woff2"), "font/woff2");
  assert.equal(contentType("a.unknown"), "application/octet-stream");
  assert.equal(cacheControl("index.html"), "no-cache");
  assert.match(cacheControl("_expo/static/js/web/entry-abc.js"), /immutable/);
});

test("reads the command line", () => {
  assert.deepEqual(readArgs([]), { port: 8090, dir: "dist", apiProxy: "" });
  assert.deepEqual(readArgs(["--port", "9000", "--api-proxy", "http://localhost:4000"]), { port: 9000, dir: "dist", apiProxy: "http://localhost:4000" });
});
