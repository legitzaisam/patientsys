// Aetheria launch gateway.
//
// One local port that ngrok exposes. The marketing website (a static Astro
// build) answers its own paths; every other request, including websockets,
// is proxied unchanged to the Aetheria app running in demo mode.
//
// Dependency-free on purpose: plain Node 22, nothing to install.
//
//   GATEWAY_PORT=8099 APP_PORT=8090 WEBSITE_DIST=../website/dist node server.mjs

import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(here, "routes.json"), "utf8"));

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT || 8099);
const APP_HOST = process.env.APP_HOST || "127.0.0.1";
const APP_PORT = Number(process.env.APP_PORT || 8090);
const WEBSITE_DIST = path.resolve(process.env.WEBSITE_DIST || path.join(here, "../website/dist"));
const DEFAULT_ROLE = process.env.DEMO_DEFAULT_ROLE || "owner";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".vtt": "text/vtt; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".glb": "model/gltf-binary",
};

/** True when the website should answer this path. */
export function isWebsitePath(pathname) {
  const { exact, prefixes } = config.website;
  if (exact.includes(pathname) || exact.includes(pathname.replace(/\/$/, ""))) return true;
  return prefixes.some((p) => {
    const base = p.replace(/\/$/, "");
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

/** Map a URL path to a file in the website build, or null. */
export function resolveWebsiteFile(pathname, dist = WEBSITE_DIST) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const base = path.join(dist, clean);
  if (!base.startsWith(dist)) return null; // path traversal
  const candidates = [base, path.join(base, "index.html"), `${base}.html`];
  for (const file of candidates) {
    try {
      if (fs.statSync(file).isFile()) return file;
    } catch {
      /* try next */
    }
  }
  return null;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

function serveFile(req, res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const immutable = file.includes(`${path.sep}_astro${path.sep}`);
  const stat = fs.statSync(file);
  const headers = {
    "content-type": MIME[ext] || "application/octet-stream",
    "cache-control": immutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  };

  // Byte ranges, so videos can seek.
  const range = req.headers.range;
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [startRaw, endRaw] = range.replace("bytes=", "").split("-");
    const start = startRaw ? Number(startRaw) : 0;
    const end = endRaw ? Math.min(Number(endRaw), stat.size - 1) : stat.size - 1;
    if (start <= end && start < stat.size) {
      res.writeHead(206, {
        ...headers,
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "content-length": end - start + 1,
      });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
  }

  res.writeHead(status, { ...headers, "accept-ranges": "bytes", "content-length": stat.size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

function serveWebsite(req, res, pathname) {
  const file = resolveWebsiteFile(pathname);
  if (file) return serveFile(req, res, file);
  const notFound = resolveWebsiteFile("/404");
  if (notFound) return serveFile(req, res, notFound, 404);
  if (!fs.existsSync(WEBSITE_DIST)) {
    return send(
      res,
      503,
      "The website is not built yet. Run: cd launch-plan/website && npm install && npm run build",
    );
  }
  return send(res, 404, "Not found");
}

function forwardedHeaders(req) {
  const headers = { ...req.headers };
  const remote = req.socket.remoteAddress || "";
  headers["x-forwarded-for"] = headers["x-forwarded-for"]
    ? `${headers["x-forwarded-for"]}, ${remote}`
    : remote;
  headers["x-forwarded-proto"] = headers["x-forwarded-proto"] || "http";
  headers["x-forwarded-host"] = headers["x-forwarded-host"] || headers.host || "";
  // The app sees plain http from us, so it computes its own origin as
  // http://<host>. A browser behind ngrok sends Origin https://<host>. Map
  // only that exact same-host value so the app's CSRF origin check matches.
  // (Modern browsers send Sec-Fetch-Site, which the check prefers anyway.)
  const selfHttps = `https://${headers.host || ""}`;
  if (headers["x-forwarded-proto"] === "https" && headers.origin === selfHttps) {
    headers.origin = `http://${headers.host}`;
  }
  return headers;
}

function proxyToApp(req, res) {
  const upstream = http.request(
    {
      host: APP_HOST,
      port: APP_PORT,
      method: req.method,
      path: req.url,
      headers: forwardedHeaders(req),
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent)
      send(
        res,
        502,
        `The demo app is not reachable on port ${APP_PORT}. Is start-demo.sh running?`,
      );
    else res.destroy();
  });
  req.pipe(upstream);
}

function demoEnter(res, url) {
  const role = url.searchParams.get("role") || DEFAULT_ROLE;
  const target = config.demoRoles[role];
  if (!target)
    return send(
      res,
      400,
      `Unknown demo role "${role}". Use one of: ${Object.keys(config.demoRoles).join(", ")}`,
    );
  res.writeHead(302, {
    location: target,
    "set-cookie": `demo_role=${role}; Path=/; Max-Age=86400; SameSite=Lax`,
    "cache-control": "no-store",
  });
  res.end();
}

export function handle(req, res) {
  const url = new URL(req.url || "/", "http://gateway.local");
  const { pathname } = url;
  const host = String(req.headers.host || "");

  if (pathname === "/healthz") return send(res, 200, "ok");
  if (pathname === "/demo/enter") return demoEnter(res, url);

  // Custom-domain hosts (clinic.*, my.*): their root opens the right portal.
  if (pathname === "/") {
    for (const [prefix, target] of Object.entries(config.hostRoots)) {
      if (!prefix.startsWith("$") && host.startsWith(prefix)) {
        res.writeHead(302, { location: target });
        return res.end();
      }
    }
  }

  if ((req.method === "GET" || req.method === "HEAD") && isWebsitePath(pathname)) {
    return serveWebsite(req, res, pathname);
  }
  return proxyToApp(req, res);
}

function handleUpgrade(req, socket, head) {
  // Websockets (Vite HMR, Supabase realtime is direct and never comes here).
  const upstream = net.connect(APP_PORT, APP_HOST, () => {
    const headers = forwardedHeaders(req);
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (const [k, v] of Object.entries(headers)) {
      for (const value of Array.isArray(v) ? v : [v]) lines.push(`${k}: ${value}`);
    }
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const server = http.createServer((req, res) => {
    const started = Date.now();
    res.on("finish", () => {
      if (process.env.GATEWAY_QUIET) return;
      console.log(
        `${new Date().toISOString()} ${res.statusCode} ${req.method} ${req.url} ${Date.now() - started}ms`,
      );
    });
    handle(req, res);
  });
  server.on("upgrade", handleUpgrade);
  server.listen(GATEWAY_PORT, () => {
    console.log(`Aetheria gateway on http://localhost:${GATEWAY_PORT}`);
    console.log(
      `  website: ${WEBSITE_DIST}${fs.existsSync(WEBSITE_DIST) ? "" : " (not built yet)"}`,
    );
    console.log(`  app:     http://${APP_HOST}:${APP_PORT}`);
  });
}
