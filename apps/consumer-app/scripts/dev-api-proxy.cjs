/**
 * Dev only: Metro (:8081) forwards "/api/..." to the API on this machine (default http://localhost:4000), so the
 * web app can call the API on its own origin. Claude's built-in browser blocks a page on :8081 from calling another
 * local port, and the same origin also skips CORS. Pairs with lib/web-api-proxy.ts (the app side).
 * Off with EXPO_PUBLIC_WEB_API_PROXY=false. Not used by `expo export` builds or by the phone app.
 */
const http = require('http');
const https = require('https');

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The API origin to forward to, or null when the API is not on this machine or the proxy is off. */
function loopbackApiOrigin(apiUrl, flag) {
  if (String(flag ?? '').trim().toLowerCase() === 'false') return null;
  let url;
  try {
    url = new URL(apiUrl || 'http://localhost:4000/api/v1');
  } catch {
    return null;
  }
  if (!LOOPBACK_HOSTS.has(url.hostname) || !url.pathname.startsWith('/api')) return null;
  return url.origin;
}

/** Connect-style middleware: "/api/..." goes to `target` unchanged (method, path, query, headers, body). */
function createDevApiProxy(target) {
  const base = new URL(target);
  const client = base.protocol === 'https:' ? https : http;
  return (req, res, next) => {
    if (!req.url || !(req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?'))) return next();
    const upstream = client.request(
      {
        protocol: base.protocol,
        hostname: base.hostname,
        port: base.port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: base.host },
      },
      (apiRes) => {
        res.writeHead(apiRes.statusCode || 502, apiRes.headers);
        apiRes.pipe(res);
      },
    );
    upstream.on('error', (error) => {
      if (res.headersSent) return res.destroy(error);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: `Dev API proxy: ${base.origin} is not reachable (${error.code || error.message})` }));
    });
    req.pipe(upstream);
  };
}

/** Adds the proxy in front of Metro's own middleware. Returns the config unchanged when the proxy is off. */
function withDevApiProxy(config, env = process.env) {
  const target = loopbackApiOrigin(env.EXPO_PUBLIC_API_URL, env.EXPO_PUBLIC_WEB_API_PROXY);
  if (!target) return config;
  const proxy = createDevApiProxy(target);
  const previous = config.server?.enhanceMiddleware;
  config.server = {
    ...config.server,
    enhanceMiddleware: (metroMiddleware, server) => {
      const inner = previous ? previous(metroMiddleware, server) : metroMiddleware;
      return (req, res, next) => proxy(req, res, () => inner(req, res, next));
    },
  };
  return config;
}

module.exports = { loopbackApiOrigin, createDevApiProxy, withDevApiProxy };
