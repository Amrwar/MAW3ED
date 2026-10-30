/**
 * Phase 18 sweep: every key page, in Arabic and English, at phone,
 * tablet, laptop and desktop widths. For each: a screenshot (the visual
 * baseline), axe-core against WCAG 2.1 A/AA, horizontal overflow,
 * console errors, and on a few pages a keyboard pass that checks every
 * focused element shows a focus ring.
 *
 * Local only, against a production build and the QA database with its
 * fixtures (scripts/qa-fixtures.mjs). It books one appointment to get a
 * manage link and removes it afterwards.
 *
 *   npm run build && npx next start -p 3101
 *   node scripts/qa-phase18.mjs [baseUrl] [--shots dir] [--db url] [--only anon|owner|admin] [--compare baselineDir]
 *
 * --compare: each screenshot is also compared pixel by pixel with the
 * same file under the baseline directory (an earlier --shots run), and
 * any page that differs by more than 1% of its pixels, or changed
 * size, is listed. Dates and counts move between runs, so this is a
 * prompt to look, not a failure.
 *
 * Writes <shots>/report.json and prints a table. Exit code 1 when any
 * page overflows, has a serious or critical axe violation, or logs an
 * error.
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { Client } = require("pg");
const { PNG } = require("pngjs");

const args = process.argv.slice(2);
const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const SHOTS = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const DB = args.includes("--db") ? args[args.indexOf("--db") + 1] : "postgresql://qa:qa@localhost:5450/maw3ed_qa";
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const COMPARE = args.includes("--compare") ? args[args.indexOf("--compare") + 1] : null;

/** Share of pixels that differ, or "size" when the two images differ in size. */
function diffShare(aPath, bPath) {
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  if (a.width !== b.width || a.height !== b.height) return "size";
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > 24 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 24 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) diff++;
  }
  return diff / (a.width * a.height);
}
const visual = [];
if (!/^http:\/\/localhost[:/]/.test(B) || !/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) {
  console.error("Local only.");
  process.exit(1);
}
const PASSWORD = "QaPassword123!";
const WIDTHS = [375, 768, 1024, 1440];
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const pg = new Client({ connectionString: DB });
await pg.connect();
const admin = (await pg.query(`select email from "User" where "adminRole"='SUPER_ADMIN' and email like '%@qa.test' limit 1`)).rows[0]?.email;

// A manage link to look at: one PENDING booking at the no-deposit salon.
const rival = await (await fetch(`${B}/api/public/qa-rival-salon`)).json();
const rivalBiz = rival.data ?? rival;
const rivalService = (rivalBiz.services ?? rivalBiz.business?.services)?.[0];
const bookDate = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
let token = null;
if (rivalService) {
  const slots = await (await fetch(`${B}/api/public/qa-rival-salon/slots?serviceId=${rivalService.id}&date=${bookDate}`)).json();
  const t = (slots.data ?? slots).slots?.[0];
  if (t) {
    const r = await fetch(`${B}/api/public/qa-rival-salon/bookings`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: rivalService.id, date: bookDate, startTime: t, customerName: "P18 Sweep", customerPhone: "01000000181" }),
    });
    const j = await r.json().catch(() => ({}));
    token = (j.data ?? j).booking?.accessToken ?? null;
  }
}

const ANON = [
  "/", "/businesses", "/businesses?q=%D8%AD%D9%84%D8%A7%D9%82%D8%A9", "/businesses?q=zzzzqqq",
  "/categories", "/categories/salons", "/cities",
  "/company/qa-salon", "/company/qa-listing-2", "/company/qa-listing-0",
  "/pricing", "/faq", "/for-business", "/contact", "/privacy", "/terms",
  "/login", "/signup", "/account-login", "/forgot-password",
  // Phase 21
  "/demo", "/help", "/help/test-booking",
  // Phase 22
  "/venues",
  ...(token ? [`/booking/${token}`] : []),
  "/this-page-does-not-exist",
];
const OWNER = [
  "/dashboard", "/dashboard/bookings", "/dashboard/bookings/today", "/dashboard/calendar",
  "/dashboard/services", "/dashboard/staff", "/dashboard/customers", "/dashboard/reports",
  "/dashboard/settings", "/dashboard/billing", "/dashboard/offers", "/dashboard/reviews",
  // Phase 21
  "/dashboard/setup", "/dashboard/import",
  // Phase 22
  "/dashboard/venue",
];
const ADMIN = ["/admin", "/admin/businesses", "/admin/bookings", "/admin/payments", "/admin/reviews", "/admin/customers", "/admin/onboarding", "/admin/verification", "/admin/venues"];
const KEYBOARD = ["/", "/businesses", "/company/qa-salon", "/dashboard/bookings", "/login"];

const localize = (p, lang) => (lang === "en" ? (p === "/" ? "/en" : `/en${p}`) : p);
const results = [];
const browser = await chromium.launch();

async function login(ctx, email) {
  const p = await ctx.newPage();
  await p.goto(`${B}/login`, { waitUntil: "networkidle" });
  await p.fill("#login-email", email);
  await p.fill("#login-password", PASSWORD);
  await Promise.all([p.waitForURL(/\/(dashboard|admin)/, { timeout: 60000 }), p.click('button[type="submit"]')]);
  await p.close();
}

async function sweep(role, pages, email) {
  if (ONLY && ONLY !== role) return;
  for (const lang of ["ar", "en"]) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 812 : 900 }, locale: lang === "ar" ? "ar-EG" : "en-GB" });
      await ctx.addCookies([{ name: "maw3ed-lang", value: lang, url: B }]);
      if (email) {
        try { await login(ctx, email); }
        catch (e) {
          console.log(`!! ${role} ${lang} ${width} LOGIN FAILED: ${String(e?.message ?? e).slice(0, 160)}`);
          results.push({ role, lang, width, route: "(login)", status: 0, overflow: 0, axe: [], consoleErrors: [], focus: null, error: "login failed" });
          await ctx.close();
          continue;
        }
      }
      for (const route of pages) {
        const page = await ctx.newPage();
        const consoleErrors = [];
        page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
        page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`));
        const url = localize(route, lang);
        const row = { role, lang, width, route: url, status: 0, overflow: 0, axe: [], consoleErrors, focus: null, htmlLang: null, dir: null };
        try {
          const res = await page.goto(B + url, { waitUntil: "networkidle", timeout: 90000 });
          row.status = res?.status() ?? 0;
          row.finalUrl = page.url().replace(B, "");
          await page.waitForTimeout(250);
          const facts = await page.evaluate(() => ({
            overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
            lang: document.documentElement.lang,
            dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
          }));
          row.overflow = facts.overflow; row.htmlLang = facts.lang; row.dir = facts.dir;
          await page.addScriptTag({ content: AXE });
          const axe = await page.evaluate(async () => {
            const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
            return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(" ")?.slice(0, 90), help: v.help }));
          });
          row.axe = axe;
          if (KEYBOARD.includes(route) && width === 1440) {
            const noRing = [];
            await page.keyboard.press("Tab");
            for (let i = 0; i < 25; i++) {
              const f = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || el === document.body) return null;
                // A ring on the control, or on the box around it (a
                // search field whose wrapper carries focus-within).
                const ringOn = (n) => { const s = getComputedStyle(n); return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none"); };
                const ring = ringOn(el) || (el.parentElement && ringOn(el.parentElement)) || (el.parentElement?.parentElement && ringOn(el.parentElement.parentElement));
                return { tag: el.tagName.toLowerCase(), text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40), ring };
              });
              if (f && !f.ring) noRing.push(`${f.tag}:${f.text}`);
              await page.keyboard.press("Tab");
            }
            row.focus = noRing;
          }
          if (SHOTS) {
            const dir = path.join(SHOTS, role, lang, String(width));
            fs.mkdirSync(dir, { recursive: true });
            const name = (url.replace(/^\/en/, "") || "/").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
            const file = path.join(dir, `${name}.png`);
            await page.screenshot({ path: file, fullPage: true });
            if (COMPARE) {
              const base = path.join(COMPARE, role, lang, String(width), `${name}.png`);
              if (fs.existsSync(base)) {
                const d = diffShare(base, file);
                row.visualDiff = d;
                if (d === "size" || d > 0.01) visual.push(`${role} ${lang} ${width} ${url}: ${d === "size" ? "size changed" : (d * 100).toFixed(1) + "% of pixels"}`);
              } else {
                visual.push(`${role} ${lang} ${width} ${url}: new page (no baseline)`);
              }
            }
          }
        } catch (e) {
          row.error = String(e?.message ?? e).slice(0, 200);
        }
        results.push(row);
        const bad = row.axe.filter((a) => a.impact === "serious" || a.impact === "critical");
        const flag = row.error || row.overflow > 0 || bad.length || consoleErrors.length || (row.focus && row.focus.length) ? "!!" : "ok";
        console.log(`${flag} ${role.padEnd(5)} ${lang} ${String(width).padStart(4)} ${url.padEnd(44)} ${row.status} ovf=${row.overflow} axe=${bad.map((a) => `${a.id}×${a.nodes}`).join(",") || "-"} con=${consoleErrors.length}${row.focus ? ` noring=${row.focus.length}` : ""}${row.error ? ` ERR ${row.error}` : ""}`);
        await page.close();
      }
      await ctx.close();
    }
  }
}

try {
  await sweep("anon", ANON, null);
  await sweep("owner", OWNER, "owner@qa.test");
  if (admin) await sweep("admin", ADMIN, admin);
} finally {
  await browser.close();
  if (token) {
    const ids = (await pg.query(`select id from "Booking" where "customerName"='P18 Sweep'`)).rows.map((r) => r.id);
    if (ids.length) {
      await pg.query(`delete from "NotificationDelivery" where "notificationId" in (select id from "Notification" where "bookingId" = any($1))`, [ids]).catch(() => {});
      await pg.query(`delete from "Notification" where "bookingId" = any($1)`, [ids]).catch(() => {});
      await pg.query(`delete from "Booking" where id = any($1)`, [ids]);
    }
    await pg.query(`delete from "Customer" where name='P18 Sweep'`).catch(() => {});
  }
  await pg.end();
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(path.join(SHOTS, "report.json"), JSON.stringify(results, null, 1));
  }
  const failing = results.filter((r) => r.error || r.overflow > 0 || r.axe.some((a) => a.impact === "serious" || a.impact === "critical") || r.consoleErrors.length || (r.focus && r.focus.length));
  const byRule = {};
  for (const r of results) for (const a of r.axe) if (a.impact === "serious" || a.impact === "critical") byRule[a.id] = (byRule[a.id] ?? 0) + 1;
  console.log(`\n${results.length} page loads, ${failing.length} flagged. Axe serious/critical by rule (page loads affected):`, byRule);
  if (COMPARE) console.log(`Visual differences from ${COMPARE} (${visual.length}):\n  ${visual.join("\n  ") || "none over 1%"}`);
  process.exit(failing.length ? 1 : 0);
}
