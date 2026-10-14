/**
 * Responsive check: every public page, on real device profiles, in both
 * languages. Fails when a page is wider than the screen.
 *
 * Phones and iPads run in WebKit (Safari's engine) with their real
 * viewport, pixel density, touch and mobile user agent; Android and
 * desktops in Chromium. Resizing a desktop window is not a substitute:
 * Chrome will not make a window narrower than about 500px, which is how
 * an earlier pass "tested" phone widths that were never applied. Each
 * page therefore reports its own innerWidth, and a mismatch fails.
 *
 *   npm run build && npm start            (or any running instance)
 *   node scripts/qa-responsive.mjs [baseUrl] [--shots dir]
 *
 * Run it against a LOCAL server: it only reads, but the account pages
 * need fixtures (scripts/qa-fixtures.mjs, scripts/qa-layout-fixtures.mjs)
 * and the public pages are only meaningful with content on them.
 */

import { chromium, webkit, devices } from "playwright";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const BASE = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3000";
const shotsDir = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;

const android = devices["Pixel 7"];
const DEVICES = [
  { key: "iphone-se", engine: webkit, ...devices["iPhone SE (3rd gen)"] },
  { key: "iphone-15-pro-max", engine: webkit, ...devices["iPhone 15 Pro Max"] },
  { key: "pixel-7", engine: chromium, ...android },
  { key: "narrow-344", engine: chromium, ...android, viewport: { width: 344, height: 882 }, screen: { width: 344, height: 882 } },
  { key: "narrow-320", engine: chromium, ...android, viewport: { width: 320, height: 568 }, screen: { width: 320, height: 568 } },
  { key: "ipad-mini", engine: webkit, ...devices["iPad Mini"] },
  { key: "ipad-pro-11-landscape", engine: webkit, ...devices["iPad Pro 11 landscape"] },
  { key: "laptop", engine: chromium, viewport: { width: 1366, height: 768 } },
  { key: "desktop", engine: chromium, viewport: { width: 1920, height: 1080 } },
  { key: "wide", engine: chromium, viewport: { width: 2560, height: 1440 } },
];

const PAGES = [
  "/", "/businesses", "/categories", "/categories/salons", "/cities", "/cities/cairo",
  "/cairo/salons", "/company/qa-salon", "/pricing", "/for-business", "/contact", "/faq",
  "/privacy", "/account-deletion", "/terms", "/login", "/signup", "/account-login", "/forgot-password",
];

/**
 * The production CSP says upgrade-insecure-requests and the server sends
 * HSTS. Chromium exempts localhost from both; WebKit does not, and over
 * plain http loads no CSS or JS at all — every page then "overflows".
 * Strip exactly those two from document responses when testing over http.
 */
async function allowPlainHttp(ctx) {
  if (!BASE.startsWith("http:")) return;
  await ctx.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const res = await route.fetch({ maxRedirects: 0 });
    if (res.status() >= 300 && res.status() < 400) return route.continue();
    const headers = { ...res.headers() };
    delete headers["strict-transport-security"];
    if (headers["content-security-policy"]) {
      headers["content-security-policy"] = headers["content-security-policy"].replace(/;\s*upgrade-insecure-requests/, "");
    }
    await route.fulfill({ response: res, headers });
  });
}

/** Runs in the page. */
function measure() {
  const doc = document.documentElement;
  // Things sticking out of the page that are not inside a scroll box.
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox !== "visible") return true;
      if (getComputedStyle(p).position === "fixed") return true;
    }
    return false;
  };
  const offenders = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).position === "fixed") continue;
    if ((r.right > doc.clientWidth + 1 || r.left < -1) && !clipped(el)) {
      offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
      if (offenders.length === 3) break;
    }
  }
  return { innerWidth, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, offenders };
}

const failures = [];
let checked = 0;
for (const { key, engine, defaultBrowserType, ...opts } of DEVICES) {
  const browser = await engine.launch();
  for (const lang of ["ar", "en"]) {
    const ctx = await browser.newContext(opts);
    await allowPlainHttp(ctx);
    await ctx.addCookies([{ name: "maw3ed-lang", value: lang, url: BASE }]);
    for (const p of PAGES) {
      const page = await ctx.newPage();
      await page.goto(BASE + p, { waitUntil: "networkidle" });
      const m = await page.evaluate(measure);
      checked++;
      const want = opts.viewport.width;
      if (m.innerWidth !== want) failures.push(`${key} ${lang} ${p}: viewport is ${m.innerWidth}px, expected ${want}px (content wider than the screen?)`);
      else if (m.scrollWidth > m.clientWidth + 1) failures.push(`${key} ${lang} ${p}: page is ${m.scrollWidth}px wide on a ${m.clientWidth}px screen — ${m.offenders.join(", ")}`);
      if (shotsDir) {
        fs.mkdirSync(shotsDir, { recursive: true });
        await page.screenshot({ path: path.join(shotsDir, `${key}_${lang}_${p.replace(/\W+/g, "_") || "home"}.png`), fullPage: true });
      }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}

console.log(`${checked} page loads across ${DEVICES.length} devices × 2 languages`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("No page is wider than its screen.");
