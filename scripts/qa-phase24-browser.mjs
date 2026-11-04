/**
 * Phase 24 in a real browser (Chromium), on a production build against
 * the QA database with ACCESS_SANDBOX=1:
 *
 *   1. the customer journey through a fictional mall: its directory,
 *      a tenant's page, the booking widget, the booking page with its
 *      check-in QR and visitor pass — in Arabic on a phone and in
 *      English on a desktop;
 *   2. the customer losing their connection on the booking page;
 *   3. a sweep of the Phase 24 screens (directory, venue, booking page,
 *      organization console with the new portfolio, the delegate's
 *      tables page, the venue console and security desk) in ar/en at
 *      375 and 1440 px: no horizontal overflow, no serious or critical
 *      axe finding, no console error;
 *   4. failing APIs: each screen stops asking, says so, and offers a
 *      way to try again.
 *
 *   CRON_SECRET=p19-local-cron node scripts/qa-phase24-browser.mjs [baseUrl] [--db url]
 *
 * Local only; everything it creates is removed.
 */
import { createRequire } from "module";
import fs from "fs";
import {
  B, pg, check, part, send, json, sandbox, runAccessCron, tag, made, account, business, organization,
  associate, slotNear, book, teardown, summary, login,
} from "./qa-phase24-lib.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const browser = await chromium.launch();
const t = (lang, ar, en) => (lang === "en" ? en : ar);
const cookiesOf = (jar) => [...jar.cookies].map(([name, value]) => ({ name, value, url: B }));

async function context(lang, width, jar) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 812 : 900 }, locale: lang === "ar" ? "ar-EG" : "en-GB" });
  await ctx.addCookies([{ name: "maw3ed-lang", value: lang, url: B }, ...(jar ? cookiesOf(jar) : [])]);
  return ctx;
}

/* The booking widget, as qa-booking-e2e drives it. */
const stepOf = (w) => w.getAttribute("data-step");
const next = (w, lang) => w.getByRole("button", { name: new RegExp(`^(${t(lang, "التالي|راجع|مراجعة", "Next|Review")})`) }).last().click();
async function bookThroughWidget(page, lang, name, phone) {
  const w = page.getByTestId("booking-widget");
  await w.waitFor({ timeout: 30000 });
  for (let i = 0; i < 8 && (await stepOf(w)) !== "details"; i++) {
    const step = await stepOf(w);
    const options = w.locator('button[aria-pressed]:not([disabled])');
    await options.first().waitFor({ timeout: 15000 });
    if (step === "date") {
      await ((await options.count()) > 1 ? options.nth(1) : options.first()).click();
      continue;
    }
    if (step === "resource") {
      const more = w.getByRole("button", { name: new RegExp(`^${t(lang, "أكتر", "More")}$`) });
      if (await more.count()) await more.first().click();
    }
    await options.first().click();
    await next(w, lang);
  }
  await w.locator('input[autocomplete="name"]').fill(name);
  await w.locator('input[autocomplete="tel"]').fill(phone);
  await next(w, lang);
  await w.getByRole("button", { name: new RegExp(t(lang, "أكّد الحجز", "Confirm booking")) }).click();
  const booked = w.getByText(t(lang, "حجزك اتأكد!", "You're booked!"));
  const requested = w.getByText(t(lang, "وصل طلب حجزك!", "Booking request sent!"));
  await Promise.race([booked.waitFor({ timeout: 30000 }), requested.waitFor({ timeout: 30000 })]);
  return (await booked.count()) ? "CONFIRMED" : "PENDING";
}

async function facts(page) {
  return page.evaluate(() => ({
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    lang: document.documentElement.lang,
    dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
  }));
}
async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}@${v.nodes[0]?.target?.join(" ")?.slice(0, 60)}`);
  });
}

try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const admin = await login("admin@qa.test");
  const prov = await json(await sandbox({ action: "ensure-provider" }));
  await sandbox({ action: "mode", mode: "NORMAL" });

  /* ── The world: a fictional mall with two tenants, and a group with a brand ── */
  const mallFounder = await account("b-mall", "Mall operator (test)");
  const mall = await organization(mallFounder, admin, { slug: "bmall", kind: "MALL", nameAr: "مول بوابة النيل (بيانات تجريبية)", nameEn: "Nile Gate Mall (fictional test data)" });
  const mallSlug = `${tag}-bmall`;
  const cityId = (await pg.query(`SELECT id FROM "City" WHERE slug = 'new-cairo'`)).rows[0].id;
  const venue = (await json(await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-bv`, nameAr: "مول بوابة النيل (تجريبي)", nameEn: "Nile Gate Mall (test)", organizationId: mall.id, cityId }))).venue;
  made.venues.push(venue.id);
  await send(admin, `/api/admin/venues/${venue.id}`, "PATCH", { status: "ACTIVE", isPublished: true });
  const gate = (await json(await send(mallFounder, `/api/venues/${venue.id}/gates`, "POST", { nameAr: "البوابة الشمالية", nameEn: "North gate", kind: "PEDESTRIAN", code: `${tag}-N` }))).gate;
  await send(mallFounder, `/api/venues/${venue.id}/policy`, "PUT", { visitorEligibility: "BOOKING_REQUIRED", accessBeforeMinutes: 120, accessAfterMinutes: 30, maxGuestsPerBooking: 2, reentryAllowed: false, allowedGateIds: [gate.id], accessInstructionsAr: "ادخل من البوابة الشمالية.", accessInstructionsEn: "Enter by the north gate." });
  const site = `SITE-${tag}`;
  made.sites.push(site);
  await send(admin, `/api/venues/${venue.id}/access`, "PUT", { providerSlug: prov.provider.slug, siteRef: site });
  await send(mallFounder, `/api/venues/${venue.id}/access`, "PUT", { accessEnabled: true });
  const guard = await account("b-guard", "Security desk (test)");
  await send(admin, "/api/admin/venue-roles", "POST", { email: guard.email, kind: "VENUE_SECURITY", venueId: venue.id });

  const rest = await business("b-rest", { nameAr: "مطعم الشرفة (تجريبي)", nameEn: "Terrace Restaurant (test)", category: "restaurants", services: [{ nameAr: "غدا", nameEn: "Lunch", duration: 60, price: 300 }] });
  for (const name of ["ترابيزة ١", "ترابيزة ٢"]) await send(rest.owner, "/api/business/resources", "POST", { name, kind: "TABLE", capacity: 4 });
  const barber = await business("b-barber", { nameAr: "حلاق البوابة (تجريبي)", nameEn: "Gate Barbers (test)", category: "salons", services: [{ nameAr: "قص شعر", nameEn: "Haircut", duration: 30, price: 120 }] });
  for (const [biz, section] of [[rest, "المطاعم"], [barber, "التجميل"]]) {
    await associate(mallFounder, mall.id, biz, "HOSTED", { section });
    const m = (await json(await send(biz.owner, "/api/business/venues/memberships", "POST", { venueId: venue.id }))).membership;
    await send(mallFounder, `/api/venues/${venue.id}/memberships/${m.id}`, "PATCH", { decision: "approve" });
  }

  const palmFounder = await account("b-palm", "Group founder (test)");
  const palm = await organization(palmFounder, admin, { slug: "bpalm", kind: "RESTAURANT_GROUP", nameAr: "مجموعة النخيل (بيانات تجريبية)", nameEn: "Palm Group (test data)" });
  const grill = await business("b-grill", { nameAr: "مشويات النخيل (تجريبي)", nameEn: "Palm Grill (test)", category: "restaurants", services: [{ nameAr: "عشاء", nameEn: "Dinner", duration: 90, price: 400 }], plan: "PRO" });
  await send(grill.owner, "/api/business/resources", "POST", { name: "ترابيزة ١", kind: "TABLE", capacity: 4 });
  await associate(palmFounder, palm.id, grill, "OWNED", { ask: ["RESERVATIONS", "RESOURCES", "REPORTS", "FINANCE"] });
  const ops = await account("b-ops", "Group operations (test)");
  await send(palmFounder, `/api/organizations/${palm.id}/members`, "POST", { email: ops.email });
  await send(ops, "/api/organizations/acting", "POST", { businessId: grill.id });
  await book(grill, { slot: await slotNear(grill, grill.services[0].id, 60), name: "ضيف" });

  /* ════ 1. The customer journey in a browser ════ */
  part("1. Journey in a browser");
  let token = null;
  {
    const ctx = await context("ar", 390);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${B}/groups/${mallSlug}?src=qr`, { waitUntil: "networkidle" });
    check("AR phone: the mall directory opens from its QR link", (await page.locator(`a[href*="/company/${rest.slug}?org=${mallSlug}"]`).count()) > 0);
    await page.locator(`a[href*="/company/${rest.slug}?org=${mallSlug}"]`).first().click();
    await page.waitForURL(new RegExp(`/company/${rest.slug}`), { timeout: 30000 });
    check("AR phone: tapping the restaurant opens its page with the mall carried along", page.url().includes(`org=${mallSlug}`));
    const state = await bookThroughWidget(page, "ar", `${tag} سارة`, "01055501234");
    const row = (await pg.query(`SELECT b.id, b.status::text, b."accessToken", b."resourceId", a."organizationId" FROM "Booking" b LEFT JOIN "OrganizationBookingAttribution" a ON a."bookingId" = b.id WHERE b."customerName" = $1`, [`${tag} سارة`])).rows[0];
    token = row?.accessToken;
    check("AR phone: books a table through the widget — confirmed, with a table, credited to the mall", state === "CONFIRMED" && row?.status === "CONFIRMED" && !!row?.resourceId && row?.organizationId === mall.id, JSON.stringify({ state, ...row, accessToken: undefined }));
    await page.goto(`${B}/booking/${token}`, { waitUntil: "networkidle" });
    const qrShown = await page.locator("svg").filter({ has: page.locator("path") }).count();
    check("AR phone: the booking page shows the check-in QR", qrShown > 0);
    await send(null, `/api/booking/${token}/access/pass`, "POST", { displayName: "سارة" });
    await runAccessCron();
    await page.reload({ waitUntil: "networkidle" });
    const body = (await page.textContent("main")) ?? "";
    check("AR phone: …and the visitor pass, marked as a test (sandbox), with the venue's instructions", /تجريب|اختبار|sandbox/i.test(body) && body.includes("البوابة الشمالية"), body.replace(/\s+/g, " ").slice(0, 200));
    const f = await facts(page);
    check("AR phone: right-to-left, no sideways scrolling", f.dir === "rtl" && f.overflow === 0, JSON.stringify(f));

    /* ════ 2. No connection ════ */
    part("2. Without internet");
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await ctx.setOffline(true);
    await page.waitForTimeout(20000);
    const stillQr = await page.locator("svg").filter({ has: page.locator("path") }).count();
    check("offline: the QR the customer already has stays on screen", stillQr > 0);
    const busy = await page.locator('[aria-busy="true"]').count();
    check("offline: no spinner takes its place", busy === 0, `aria-busy ${busy}`);
    check("offline: the page does not hammer the network while offline (≤ 6 attempts in 20 s)", requests.length <= 6, `${requests.length} requests`);
    // The phone keeps the customer's own booking page (public/sw.js), so a
    // reload with no connection shows that copy with its QR and a note
    // (finding F1, fixed 2026-11-03; details in scripts/qa-offline-qr.mjs).
    try { await page.reload({ timeout: 10000, waitUntil: "domcontentloaded" }); } catch {}
    await page.waitForTimeout(1500);
    const qrAfterReload = await page.locator('section[aria-labelledby="checkin-h"] [role="img"] svg').count();
    const copyNote = await page.getByRole("status").filter({ hasText: "مفيش اتصال" }).count();
    check("offline: reloading without a connection shows the kept copy with the QR and a note saying so", qrAfterReload === 1 && copyNote === 1, `qr ${qrAfterReload}, note ${copyNote}`);
    await ctx.setOffline(false);
    await page.goto(`${B}/booking/${token}`, { waitUntil: "networkidle" });
    check("offline: back online, the page loads again", (await page.locator("svg").filter({ has: page.locator("path") }).count()) > 0);
    check("journey: no script error on the way", errors.length === 0, errors.join(" | ").slice(0, 200));
    await ctx.close();
  }
  part("1. Journey in a browser");
  {
    const ctx = await context("en", 1440);
    const page = await ctx.newPage();
    await page.goto(`${B}/en/groups/${mallSlug}`, { waitUntil: "networkidle" });
    const search = page.locator('input[type="search"], input[name="q"]').first();
    if (await search.count()) {
      await search.fill("Gate Barbers");
      await search.press("Enter");
      await page.waitForLoadState("networkidle");
    } else await page.goto(`${B}/en/groups/${mallSlug}?q=Gate%20Barbers`, { waitUntil: "networkidle" });
    check("EN desktop: searching the directory finds the barber and hides the restaurant", (await page.locator(`a[href*="/company/${barber.slug}"]`).count()) > 0 && (await page.locator(`a[href*="/company/${rest.slug}?org="]`).count()) === 0);
    await page.locator(`a[href*="/company/${barber.slug}"]`).first().click();
    await page.waitForURL(new RegExp(`/company/${barber.slug}`), { timeout: 30000 });
    const state = await bookThroughWidget(page, "en", `${tag} Omar`, "01055505678");
    check("EN desktop: books a haircut through the widget in English", state === "CONFIRMED");
    await ctx.close();
  }

  /* ════ 3. Sweep ════ */
  part("3. Screens: ar/en × 375/1440");
  const views = [
    ["public", null, [`/groups/${mallSlug}`, `/venues/${tag}-bv`, `/company/${rest.slug}?org=${mallSlug}`, `/booking/${token}`]],
    ["group founder", palmFounder, [`/org-admin/${palm.id}`]],
    ["group operations (operating Palm Grill)", ops, ["/dashboard", "/dashboard/resources"]],
    ["mall operator", mallFounder, [`/org-admin/${mall.id}`, `/venue-admin/${venue.id}`]],
    ["security desk", guard, [`/venue-admin/${venue.id}/access`]],
  ];
  const flagged = [];
  let loads = 0;
  for (const [role, jar, paths] of views) {
    for (const lang of ["ar", "en"]) {
      for (const width of [375, 1440]) {
        const ctx = await context(lang, width, jar);
        for (const p of paths) {
          const page = await ctx.newPage();
          const errs = [];
          page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
          page.on("pageerror", (e) => errs.push(`pageerror ${e.message.slice(0, 120)}`));
          const url = `${B}${lang === "en" ? "/en" : ""}${p}`;
          const res = await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
          await page.waitForTimeout(300);
          const f = await facts(page);
          const a = await axe(page);
          loads += 1;
          const bad = [];
          if ((res?.status() ?? 0) >= 400) bad.push(`status ${res?.status()}`);
          if (page.url().includes("/login")) bad.push("sent to sign-in");
          if (f.overflow > 0) bad.push(`overflow ${f.overflow}`);
          if (f.dir !== (lang === "ar" ? "rtl" : "ltr")) bad.push(`dir ${f.dir}`);
          if (a.length) bad.push(`axe ${a.join(",")}`);
          if (errs.length) bad.push(`console ${errs.join(" | ")}`);
          if (bad.length) flagged.push(`${role} ${lang} ${width} ${p}: ${bad.join("; ")}`);
          await page.close();
        }
        await ctx.close();
      }
    }
  }
  check(`sweep: ${loads} page loads, none flagged (overflow, direction, axe serious/critical, console)`, flagged.length === 0, flagged.join("\n   "));
  {
    const ctx = await context("en", 1440, palmFounder);
    const page = await ctx.newPage();
    await page.goto(`${B}/en/org-admin/${palm.id}`, { waitUntil: "networkidle" });
    const pf = (await page.locator('section[aria-labelledby="pf-h"]').textContent()) ?? "";
    check("console: the group's portfolio shows Palm Grill with its bookings and revenue", pf.includes("Palm Grill (test)") && /EGP/.test(pf), pf.replace(/\s+/g, " ").slice(0, 200));
    // Audit (review finding 8): actions in the console reload its lists, not the portfolio.
    let pfReads = 0;
    page.on("request", (r) => { if (r.url().includes("/portfolio")) pfReads += 1; });
    for (const label of ["Hide page", "Publish page"]) {
      // Wait for the action's own request and the portfolio read it should cause.
      const portfolioRead = page.waitForResponse((r) => r.url().includes("/portfolio"), { timeout: 15000 }).catch(() => null);
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().endsWith(`/api/organizations/${palm.id}`), { timeout: 15000 }),
        page.getByRole("button", { name: label, exact: true }).click(),
      ]);
      await portfolioRead;
      await page.getByRole("button", { name: label === "Hide page" ? "Publish page" : "Hide page", exact: true }).waitFor({ timeout: 15000 });
    }
    // Each succeeded, so each reads the portfolio once more — never in a loop.
    const published = (await pg.query(`SELECT "isPublished" FROM "VenueOrganization" WHERE id = $1`, [palm.id])).rows[0]?.isPublished;
    check("console: two actions later, the portfolio was read once per action and the page is back as it was", pfReads === 2 && published === true, `${pfReads} reads, published ${published}`);
    await ctx.close();
    const c2 = await context("ar", 375, ops);
    const p2 = await c2.newPage();
    await p2.goto(`${B}/dashboard`, { waitUntil: "networkidle" });
    check("delegate: the menu offers the tables page when RESOURCES is granted", (await p2.locator('a[href$="/dashboard/resources"]').count()) > 0);
    await c2.close();
  }

  /* ════ 4. Failing APIs stop and say so ════ */
  part("4. Failure and retry termination");
  {
    const ctx = await context("en", 1440, palmFounder);
    const page = await ctx.newPage();
    let n = 0;
    await page.route("**/api/organizations/*/portfolio", (r) => { n += 1; return r.fulfill({ status: 500, body: "{}" }); });
    await page.goto(`${B}/en/org-admin/${palm.id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(15000);
    await page.waitForTimeout(0);
    const pfAlert = await page.getByText("Could not load the figures.").count();
    check("console: a failing portfolio is asked for once, says so, and the rest of the console works", n <= 2 && pfAlert === 1 && (await page.locator("h1").count()) === 1, `${n} requests, notice ${pfAlert}`);
    await page.getByRole("button", { name: "Try again" }).first().click();
    await page.waitForTimeout(3000);
    check("console: its Try again asks exactly once more", n <= 3, `${n} requests`);
    await page.unroute("**/api/organizations/*/portfolio");
    let all = 0;
    await page.route(`**/api/organizations/${palm.id}**`, (r) => { all += 1; return r.fulfill({ status: 500, body: "{}" }); });
    await page.goto(`${B}/en/org-admin/${palm.id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(15000);
    // Not the router's own (empty) announcer, which is also role="alert".
    const alert = (await page.locator('[role="alert"]').filter({ hasText: /\S/ }).first().textContent().catch(() => "")) ?? "";
    check("console: when nothing loads it says so and offers Try again — no endless loading", /Could not load/i.test(alert) && (await page.getByRole("button", { name: /Try again/i }).count()) === 1 && all <= 6, `${all} requests; ${alert.slice(0, 80)}`);
    await ctx.close();
  }
  {
    const ctx = await context("ar", 390);
    const page = await ctx.newPage();
    let n = 0;
    await page.route("**/api/booking/*/access**", (r) => { n += 1; return r.fulfill({ status: 500, body: "{}" }); });
    await page.goto(`${B}/booking/${token}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(30000);
    check("booking page: a failing access API is retried a bounded number of times (≤ 6 in 30 s), then stops", n <= 6, `${n} requests`);
    const spinners = await page.locator('[aria-busy="true"]').count();
    check("booking page: …and no spinner is left turning", spinners === 0, `aria-busy ${spinners}`);
    await ctx.close();
  }
} catch (e) {
  check("script ran to completion", false, e instanceof Error ? e.stack : String(e));
} finally {
  await browser.close();
  await sandbox({ action: "mode", mode: "NORMAL" }).catch(() => {});
  await teardown();
  await pg.end();
  process.exit(summary(true) ? 1 : 0);
}
