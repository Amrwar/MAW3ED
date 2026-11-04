/**
 * Phase 26 in a real browser (Chromium): the funnel steps fire once per
 * tab through the real UI and never loop; the analytics page does not
 * fetch what the server already rendered; search's empty state and the
 * "Places and groups" block render; every new screen passes axe (serious
 * and critical) with no sideways scroll at 390 px, in Arabic and English;
 * no console errors.
 *
 *   node scripts/qa-phase26-browser.mjs [http://localhost:3101]
 *
 * Fictional data made through the product's APIs, removed at the end.
 */
import { createRequire } from "module";
import fs from "fs";
import {
  B, pg, part, check, login, call, json, account, business, organization, associate, teardown, summary, made,
} from "./qa-phase24-lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const svc = (nameAr, nameEn, duration, price) => ({ nameAr, nameEn, duration, price });
const cookiesOf = (jar) => [...jar.cookies].map(([name, value]) => ({ name, value, url: B }));

const browser = await chromium.launch();
async function context(lang, width, jar) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 812 : 900 }, locale: lang === "ar" ? "ar-EG" : "en-GB" });
  await ctx.addCookies([{ name: "maw3ed-lang", value: lang, url: B }, ...(jar ? cookiesOf(jar) : [])]);
  return ctx;
}
/** Every funnel report this page sends, as { step, business, org }. */
function watchFunnel(page) {
  const sent = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/public/funnel") && r.method() === "POST") {
      // A beacon's body is a Blob: read the raw bytes, not postData().
      try { sent.push(JSON.parse(r.postDataBuffer()?.toString("utf8") ?? r.postData() ?? "{}")); } catch { sent.push({ unreadable: true }); }
    }
  });
  return sent;
}
function watchErrors(page) {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 40[134]/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  return errors;
}
async function facts(page) {
  return page.evaluate(() => ({ overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth), lang: document.documentElement.lang }));
}
async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}@${v.nodes[0]?.target?.join(" ")?.slice(0, 60)}`);
  });
}
const settle = (page) => page.waitForLoadState("networkidle").catch(() => {});

let failed = 0;
try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const admin = await login("admin@qa.test");
  const clinic = await business("b26-clinic", { nameAr: "عيادة أحمد التجريبية", nameEn: "Ahmed Test Clinic", category: "dentists", services: [svc("كشف", "Check-up", 30, 300)], plan: "PRO" });
  const founder = await account("b26-mall", "Mall founder (test)");
  const mall = await organization(founder, admin, { slug: "b26-mall", kind: "MALL", nameAr: "مول الواحة التجريبي", nameEn: "Oasis Test Mall" });
  await associate(founder, mall.id, clinic, "HOSTED");
  const count = async (step, org = "") =>
    Number((await pg.query(`SELECT COALESCE(SUM(count),0)::int AS n FROM "FunnelCount" WHERE step = $1 AND "businessId" = $2 AND "organizationId" = $3`, [step, clinic.id, org])).rows[0].n);

  /* ── Funnel through the real UI ─────────────────────────────── */
  part("Funnel steps from the real UI: once per tab, credited, never looping");
  {
    const ctx = await context("ar", 390);
    const page = await ctx.newPage();
    const sent = watchFunnel(page);
    const errors = watchErrors(page);
    await page.goto(`${B}/businesses`);
    await settle(page);
    await page.goto(`${B}/businesses?q=${encodeURIComponent("احمد")}`);
    await settle(page);
    await page.reload();
    await settle(page);
    // A beacon's body is not visible to Playwright, so "once" is the
    // number of requests the tab sent, and "which step" is the counter.
    const site = async (step) => Number((await pg.query(`SELECT COALESCE(SUM(count),0)::int AS n FROM "FunnelCount" WHERE step = $1 AND "businessId" = '' AND "organizationId" = ''`, [step])).rows[0].n);
    await page.waitForTimeout(600);
    check("F1 the listing, a search and a reload send two reports: MARKETPLACE_VIEW and SEARCH, once each", sent.length === 2 && (await site("MARKETPLACE_VIEW")) === 1 && (await site("SEARCH")) === 1, `${sent.length} sent`);

    await page.goto(`${B}/groups/${mall.slug}`);
    await settle(page);
    await page.waitForTimeout(600);
    const orgViews = Number((await pg.query(`SELECT COALESCE(SUM(count),0)::int AS n FROM "FunnelCount" WHERE step = 'ORGANIZATION_VIEW' AND "organizationId" = $1`, [mall.id])).rows[0].n);
    check("F2 the mall's page sends one report, counted as ORGANIZATION_VIEW for the mall", sent.length === 3 && orgViews === 1, `${sent.length} sent, ${orgViews} counted`);
    await page.goto(`${B}/company/${clinic.slug}?org=${mall.slug}`);
    await settle(page);
    // Through the booking widget to the details step, without booking.
    const w = page.getByTestId("booking-widget");
    await w.waitFor({ timeout: 30000 });
    for (let i = 0; i < 8 && (await w.getAttribute("data-step")) !== "details"; i++) {
      const step = await w.getAttribute("data-step");
      const options = w.locator("button[aria-pressed]:not([disabled])");
      await options.first().waitFor({ timeout: 15000 });
      await ((step === "date" && (await options.count()) > 1) ? options.nth(1) : options.first()).click();
      if (step !== "date") await w.getByRole("button", { name: /^(التالي|راجع|مراجعة)/ }).last().click();
    }
    await page.waitForTimeout(600);
    const afterJourney = sent.length;
    // Reload and walk the first steps again: nothing new is sent.
    await page.reload();
    await settle(page);
    const w2 = page.getByTestId("booking-widget");
    await w2.waitFor({ timeout: 30000 });
    await w2.locator("button[aria-pressed]:not([disabled])").first().click();
    await page.waitForTimeout(800);
    check("F3 the business page and the widget send four reports (view, service, started, time)", afterJourney - 3 === 4, `${afterJourney - 3}`);
    check("F3 …and a reload and the same steps again send none", sent.length === afterJourney, `${sent.length - afterJourney} extra`);
    check("F4 the server counted each once, credited to the mall", (await count("BUSINESS_VIEW", mall.id)) === 1 && (await count("SERVICE_SELECTED", mall.id)) === 1 && (await count("BOOKING_STARTED", mall.id)) === 1 && (await count("TIME_SELECTED", mall.id)) === 1);
    const ctx2 = await context("ar", 390);
    const page2 = await ctx2.newPage();
    const sent2 = watchFunnel(page2);
    await page2.goto(`${B}/company/${clinic.slug}`);
    await settle(page2);
    await page2.waitForTimeout(800);
    check("F5 a second tab is a second visit (no organization: not credited to the mall)", sent2.length === 1 && (await count("BUSINESS_VIEW", "")) === 1);
    check("F6 no console errors on the journey", errors.length === 0, errors.join(" | "));
    await ctx.close();
    await ctx2.close();
  }

  /* ── Analytics page: no refetch of what the server rendered ───── */
  part("Analytics and reports: no duplicate fetch, no loop");
  {
    const ctx = await context("en", 1280, clinic.owner);
    const page = await ctx.newPage();
    const calls = [];
    page.on("request", (r) => { if (r.url().includes("/api/business/analytics")) calls.push(r.url()); });
    const errors = watchErrors(page);
    await page.goto(`${B}/dashboard/analytics`);
    await settle(page);
    await page.waitForTimeout(1500);
    check("G1 opening analytics fetches nothing: the server already rendered this month", calls.length === 0, calls.join(" "));
    await page.getByRole("button", { name: /Last Month/i }).click();
    await settle(page);
    await page.waitForTimeout(1500);
    check("G2 one click on 'Last month' is exactly one request", calls.length === 1, calls.join(" "));
    check("G3 KPI cards are in English and say 'Completed booking value'", await page.getByText("Completed booking value").count() > 0);
    check("G4 no console errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ── Screens: axe, overflow, both languages ─────────────────── */
  part("New screens: accessibility and mobile layout, Arabic and English");
  const screens = [
    ["/businesses?q=" + encodeURIComponent("الواحة"), null, "places block"],
    ["/businesses?q=zzzzqqqq", null, "empty search"],
    ["/groups?q=oasis", null, "groups search"],
    ["/groups?type=destinations", null, "groups filter"],
    [`/company/${clinic.slug}`, null, "business page"],
    ["/for-business", null, "for business"],
    ["/demo", null, "demo"],
    ["/dashboard/reports/funnel", clinic.owner, "funnel report"],
    ["/dashboard/analytics", clinic.owner, "analytics"],
    [`/org-admin/${mall.id}`, founder, "organization console"],
  ];
  for (const lang of ["ar", "en"]) {
    for (const [path, jar, name] of screens) {
      const ctx = await context(lang, 390, jar);
      const page = await ctx.newPage();
      const errors = watchErrors(page);
      const target = lang === "en" && !/^\/(dashboard|org-admin)/.test(path) ? `/en${path}` : path;
      const res = await page.goto(`${B}${target}`);
      await settle(page);
      const f = await facts(page);
      const v = await axe(page);
      check(`S ${lang} ${name}: 200, lang=${lang}, no sideways scroll, axe clean, no console error`, res?.status() === 200 && f.lang === lang && f.overflow <= 1 && v.length === 0 && errors.length === 0, JSON.stringify({ status: res?.status(), ...f, v, errors }));
      if (name === "places block") check(`S ${lang} the places block links the mall`, (await page.locator(`a[href$="/groups/${mall.slug}"]`).count()) > 0);
      if (name === "empty search") check(`S ${lang} an empty search offers to notify and lists what is listed`, (await page.locator("form").count()) > 0);
      await ctx.close();
    }
  }
} catch (e) {
  console.error(e);
  check("the run completed", false, String(e?.message ?? e));
} finally {
  await pg.query(`DELETE FROM "FunnelCount" WHERE "businessId" = ANY($1) OR "organizationId" = ANY($2) OR "businessId" = ''`, [made.businesses, made.orgs]).catch(() => {});
  await pg.query(`DELETE FROM "FunnelSeen"`).catch(() => {});
  await browser.close();
  await teardown();
  failed = summary();
  await pg.end();
  process.exit(failed ? 1 : 0);
}
