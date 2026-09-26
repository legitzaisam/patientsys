// node --test test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_PORT = 18090;
const GATEWAY_PORT = 18099;
let app, gateway, dist;

function get(p, headers = {}) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port: GATEWAY_PORT, path: p, headers }, (res) => {
        let body = "";
        res
          .on("data", (d) => (body += d))
          .on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on("error", reject);
  });
}

before(async () => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
  fs.writeFileSync(path.join(dist, "index.html"), "<h1>website home</h1>");
  fs.mkdirSync(path.join(dist, "journal"));
  fs.writeFileSync(path.join(dist, "journal", "index.html"), "<h1>journal</h1>");
  fs.writeFileSync(path.join(dist, "404.html"), "<h1>site 404</h1>");
  fs.mkdirSync(path.join(dist, "_astro"));
  fs.writeFileSync(path.join(dist, "_astro", "a.js"), "console.log(1)");

  app = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        app: true,
        url: req.url,
        host: req.headers.host,
        proto: req.headers["x-forwarded-proto"],
        origin: req.headers.origin,
      }),
    );
  });
  app.on("upgrade", (req, socket) => {
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n",
    );
    socket.on("data", (d) => socket.write(d)); // echo
  });
  await new Promise((r) => app.listen(APP_PORT, r));

  gateway = spawn(process.execPath, [path.join(here, "server.mjs")], {
    env: {
      ...process.env,
      GATEWAY_PORT: String(GATEWAY_PORT),
      APP_PORT: String(APP_PORT),
      WEBSITE_DIST: dist,
      GATEWAY_QUIET: "1",
    },
    stdio: "pipe",
  });
  await new Promise((resolve) => gateway.stdout.once("data", resolve));
});

after(() => {
  gateway?.kill();
  app?.close();
});

test("website answers its own paths", async () => {
  assert.match((await get("/")).body, /website home/);
  assert.match((await get("/journal")).body, /journal/);
  const asset = await get("/_astro/a.js");
  assert.equal(asset.status, 200);
  assert.match(asset.headers["cache-control"], /immutable/);
});

test("unknown website path gets the site 404", async () => {
  const r = await get("/journal/missing-article");
  assert.equal(r.status, 404);
  assert.match(r.body, /site 404/);
});

test("app paths are proxied with host and proto preserved", async () => {
  for (const p of [
    "/auth",
    "/dashboard",
    "/my-record/plan",
    "/api/comms/drain",
    "/patients",
    "/@vite/client",
  ]) {
    const r = await get(p, { host: "demo.ngrok-free.dev", "x-forwarded-proto": "https" });
    const json = JSON.parse(r.body);
    assert.equal(json.app, true, p);
    assert.equal(json.url, p);
    assert.equal(json.host, "demo.ngrok-free.dev");
    assert.equal(json.proto, "https");
  }
});

test("same-host https Origin is mapped for the app's CSRF check, others untouched", async () => {
  const h = { host: "demo.ngrok-free.dev", "x-forwarded-proto": "https" };
  const same = JSON.parse(
    (await get("/_serverFn/x", { ...h, origin: "https://demo.ngrok-free.dev" })).body,
  );
  assert.equal(same.origin, "http://demo.ngrok-free.dev");
  const other = JSON.parse(
    (await get("/_serverFn/x", { ...h, origin: "https://evil.example.com" })).body,
  );
  assert.equal(other.origin, "https://evil.example.com");
  const plain = JSON.parse(
    (await get("/_serverFn/x", { host: "localhost:8099", origin: "https://localhost:8099" })).body,
  );
  assert.equal(plain.origin, "https://localhost:8099");
});

test("demo enter sets the persona cookie and redirects", async () => {
  const staff = await get("/demo/enter?role=front_desk");
  assert.equal(staff.status, 302);
  assert.equal(staff.headers.location, "/dashboard");
  assert.match(staff.headers["set-cookie"][0], /demo_role=front_desk/);
  const patient = await get("/demo/enter?role=patient");
  assert.equal(patient.headers.location, "/my-record");
  assert.equal((await get("/demo/enter?role=admin")).status, 400);
});

test("custom-domain hosts open the right portal", async () => {
  assert.equal((await get("/", { host: "clinic.example.com" })).headers.location, "/auth");
  assert.equal((await get("/", { host: "my.example.com" })).headers.location, "/portal");
});

test("path traversal is refused", async () => {
  const r = await get("/journal/..%2F..%2F..%2Fetc%2Fpasswd");
  assert.notEqual(r.status, 200);
});

test("websocket upgrades pass through to the app", async () => {
  const echoed = await new Promise((resolve, reject) => {
    const s = net.connect(GATEWAY_PORT, "127.0.0.1", () => {
      s.write("GET /hmr HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n");
    });
    let buf = "";
    s.on("data", (d) => {
      buf += d;
      if (buf.includes("101") && !buf.includes("ping")) s.write("ping");
      if (buf.includes("ping")) {
        s.end();
        resolve(buf);
      }
    });
    s.on("error", reject);
  });
  assert.match(echoed, /101 Switching Protocols/);
  assert.match(echoed, /ping/);
});
