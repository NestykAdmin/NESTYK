#!/usr/bin/env node
/**
 * Serve the exported web build (dist/) on this machine the way the host will (launch plan A0.1, local-first plan):
 * - real files are served as they are;
 * - any other path without a file extension gets index.html, so /agent/leads loads on refresh (route rule 16);
 * - a missing file with an extension (e.g. /x.js) is a 404, not index.html.
 * Optional: --api-proxy <url> forwards /api/... to that API, for a build made with
 * EXPO_PUBLIC_API_URL=http://127.0.0.1:<port>/api/v1 (Claude's browser cannot call another local port).
 *
 *   node scripts/serve-web-dist.cjs [--port 8090] [--dir dist] [--api-proxy http://localhost:4000]
 *
 * Local testing only. Not used by the host. No dependencies.
 */
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

/** Which file answers a request path. `isFile(rel)` says whether dist/<rel> is a file. */
function pickFile(urlPath, isFile) {
  let clean;
  try {
    clean = decodeURIComponent(String(urlPath || "/").split("?")[0].split("#")[0]);
  } catch {
    return { status: 400 };
  }
  const rel = path.posix.normalize(clean).replace(/^\/+/, "");
  if (rel.startsWith("..") || rel.includes("\0")) return { status: 400 };
  if (rel && isFile(rel)) return { status: 200, file: rel };
  if (rel && isFile(path.posix.join(rel, "index.html"))) return { status: 200, file: path.posix.join(rel, "index.html") };
  if (path.posix.extname(rel)) return { status: 404 };
  return { status: 200, file: "index.html", fallback: true };
}

function contentType(file) {
  return TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

/** HTML is never cached (a new deploy shows at once); hashed assets under _expo/ are cached for a year. */
function cacheControl(file) {
  if (file.endsWith(".html")) return "no-cache";
  if (file.startsWith("_expo/") || file.startsWith("assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}

function readArgs(argv) {
  const args = { port: 8090, dir: "dist", apiProxy: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--port") args.port = Number(value), i += 1;
    else if (key === "--dir") args.dir = value, i += 1;
    else if (key === "--api-proxy") args.apiProxy = value, i += 1;
  }
  return args;
}

function proxy(req, res, target) {
  const upstream = new URL(req.url, target);
  const client = upstream.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: upstream.host };
  const out = client.request(upstream, { method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  out.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`API proxy error: ${error.message}`);
  });
  req.pipe(out);
}

function start({ port, dir, apiProxy }) {
  const root = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(path.join(root, "index.html"))) {
    console.error(`No ${path.join(dir, "index.html")}. Run the web export first (npm run build:web).`);
    process.exit(1);
  }
  const isFile = (rel) => {
    try {
      return fs.statSync(path.join(root, rel)).isFile();
    } catch {
      return false;
    }
  };
  const server = http.createServer((req, res) => {
    if (apiProxy && /^\/api(\/|$)/.test(req.url || "")) return proxy(req, res, apiProxy);
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" });
      return res.end();
    }
    const pick = pickFile(req.url, isFile);
    if (pick.status !== 200) {
      res.writeHead(pick.status, { "content-type": "text/plain; charset=utf-8" });
      return res.end(pick.status === 404 ? "Not found" : "Bad request");
    }
    res.writeHead(200, { "content-type": contentType(pick.file), "cache-control": cacheControl(pick.file) });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(path.join(root, pick.file)).pipe(res);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Serving ${dir}/ at http://127.0.0.1:${port}  (paths without a file -> index.html)`);
    if (apiProxy) console.log(`/api/* -> ${apiProxy}`);
  });
}

if (require.main === module) start(readArgs(process.argv.slice(2)));

module.exports = { pickFile, contentType, cacheControl, readArgs };
