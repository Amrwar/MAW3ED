/**
 * Serves the app's web build (mobile: `npx expo export --platform web`)
 * and forwards /api/* to a Maw3ed server, on one origin — so the app in a
 * browser talks to a local QA server exactly as the phone talks to the
 * site, without CORS and without ever reaching production.
 *
 *   node scripts/app-web-serve.mjs <exportDir> [--port 8090] [--api http://localhost:3101]
 *
 * Local only: refuses an API target that is not localhost.
 */
import http from "http";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a) && !/^http/.test(a)) ?? "dist");
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const port = Number(opt("--port", 8090));
const api = new URL(opt("--api", "http://localhost:3101"));
if (!["localhost", "127.0.0.1"].includes(api.hostname)) {
  console.error("Local API targets only.");
  process.exit(1);
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2", ".ico": "image/x-icon" };

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith("/api/")) {
      const fwd = http.request(
        { hostname: api.hostname, port: api.port, path: url.pathname + url.search, method: req.method, headers: { ...req.headers, host: api.host } },
        (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        },
      );
      fwd.on("error", () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(fwd);
      return;
    }
    // A file of the build, or the app's single page for any route.
    let file = path.join(dir, decodeURIComponent(url.pathname));
    // Inside the build folder only (a sibling named like it is outside).
    const rel = path.relative(dir, file);
    if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`app on http://localhost:${port} → api ${api.origin}`));
