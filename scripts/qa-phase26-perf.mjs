/**
 * Phase 26 performance baseline: key public pages in Chromium at 390 px,
 * five fresh loads each (median), plus server response times for the
 * pages and the search API. Local production build on the QA database —
 * absolute numbers are this machine's, not production's; they are a
 * baseline to compare later runs against.
 *
 *   node scripts/qa-phase26-perf.mjs [http://localhost:3101] [--out file.json]
 */
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
if (!/^http:\/\/localhost[:/]/.test(B)) { console.error("Local only."); process.exit(1); }
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
const RUNS = 5;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// A published business and organization to measure, whatever the QA data holds.
const pg = new (require("pg").Client)({ connectionString: "postgresql://qa:qa@localhost:5450/maw3ed_qa" });
await pg.connect();
const biz = (await pg.query(`SELECT slug FROM "Business" WHERE "isPublished" ORDER BY slug LIMIT 1`)).rows[0]?.slug;
const combo = (await pg.query(`SELECT c.slug AS city, k.slug AS cat FROM "Business" b JOIN "City" c ON c.id = b."cityId" JOIN "Category" k ON k.id = b."categoryId" WHERE b."isPublished" LIMIT 1`)).rows[0];
await pg.end();

const pages = [
  ["home", "/"],
  ["listing", "/businesses"],
  ["search", `/businesses?q=${encodeURIComponent("عيادة")}`],
  ["search (folded)", `/businesses?q=${encodeURIComponent("عياده احمد")}`],
  ["landing", combo ? `/${combo.city}/${combo.cat}` : "/categories"],
  ["groups", "/groups"],
  ["business page", `/company/${biz}`],
  ["for business", "/for-business"],
  ["english home", "/en"],
];

const browser = await chromium.launch();
const results = [];
for (const [name, path] of pages) {
  const samples = [];
  for (let i = 0; i < RUNS + 1; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, locale: "ar-EG" });
    const page = await ctx.newPage();
    let js = 0;
    let requests = 0;
    page.on("response", async (r) => {
      requests++;
      if (r.request().resourceType() === "script") {
        const len = Number(r.headers()["content-length"] ?? 0);
        js += len || (await r.body().catch(() => Buffer.alloc(0))).length;
      }
    });
    await page.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(`${B}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, lcp: window.__lcp };
    });
    // The first load warms the server's code paths; it is not counted.
    if (i > 0) samples.push({ ...t, js, requests });
    await ctx.close();
  }
  const row = {
    page: name,
    path,
    ttfbMs: Math.round(median(samples.map((s) => s.ttfb))),
    domReadyMs: Math.round(median(samples.map((s) => s.dcl))),
    loadMs: Math.round(median(samples.map((s) => s.load))),
    lcpMs: Math.round(median(samples.map((s) => s.lcp))),
    jsKB: Math.round(median(samples.map((s) => s.js)) / 1024),
    requests: median(samples.map((s) => s.requests)),
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
await browser.close();

// Server only: the search API, 20 sequential requests each after one warm-up.
const api = [];
for (const [name, path] of [
  ["api listing", "/api/public/businesses"],
  ["api search", `/api/public/businesses?q=${encodeURIComponent("عيادة")}`],
  ["api search folded", `/api/public/businesses?q=${encodeURIComponent("عياده احمد")}`],
  ["api open now", "/api/public/businesses?available=open-now"],
  ["api groups search", `/api/public/groups?q=${encodeURIComponent("مول")}`],
]) {
  const ts = [];
  for (let i = 0; i < 21; i++) {
    const t0 = performance.now();
    const r = await fetch(`${B}${path}`);
    await r.arrayBuffer();
    if (i > 0) ts.push(performance.now() - t0);
  }
  const row = { endpoint: name, path, p50Ms: Math.round(median(ts)), p95Ms: Math.round([...ts].sort((a, b) => a - b)[Math.floor(ts.length * 0.95) - 1]) };
  api.push(row);
  console.log(JSON.stringify(row));
}
if (out) fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), base: B, pages: results, api }, null, 2));
