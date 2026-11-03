/**
 * Phase 25 — the customer app, end to end, in a browser: the app's own
 * web build (mobile: `npx expo export --platform web`, served with
 * scripts/app-web-serve.mjs on :8090, forwarding /api to the QA server on
 * :3101 — never production). The same screens, routes and API calls the
 * phone runs; what only a phone can show (the share sheet, push, the
 * keychain) is covered on devices, not here.
 *
 *   discovery: home → malls & groups → an organization → its directory,
 *     filtered → a business → booking through the app's own flow → the
 *     booking is credited to the organization;
 *   the booking screen: check-in QR, a visitor pass from pending to
 *     active (the access sandbox), a guest with their own link;
 *   a guest opening their pass; venue and organization deep links;
 *   network: offline keeps the codes on screen and stops asking; a cold
 *     start without an answer keeps the sign-in; an ended session signs out;
 *   loops: polling a pending pass stops at its bound;
 *   support, data export; Arabic and English, no sideways scrolling.
 *
 *   CRON_SECRET=p19-local-cron node scripts/qa-phase25-app.mjs [--app http://localhost:8090]
 *
 * Local only; everything it creates is removed.
 */
import { createRequire } from "module";
import {
  B, pg, check, part, send, json, sandbox, runAccessCron, tag, made, account, customer, business, organization,
  associate, slotNear, book, teardown, summary, login, PASSWORD,
} from "./qa-phase24-lib.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const APP = process.argv.includes("--app") ? process.argv[process.argv.indexOf("--app") + 1] : "http://localhost:8090";
if (!/^http:\/\/localhost[:/]/.test(APP)) {
  console.error("Local only.");
  process.exit(1);
}
const browser = await chromium.launch();

/** A browser context for the app, optionally signed in (the app's own login call) and in a language. */
async function appContext({ lang = "ar", signIn = null, width = 390 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true });
  let tokens = null;
  if (signIn) {
    const r = await fetch(`${APP}/api/auth/mobile/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: signIn.email, password: PASSWORD }) });
    tokens = await r.json();
    if (!tokens.accessToken) throw new Error(`app login failed: ${r.status} ${JSON.stringify(tokens).slice(0, 120)}`);
  }
  await ctx.addInitScript(([l, t]) => {
    try {
      localStorage.setItem("maw3ed.lang", l);
      if (t && !sessionStorage.getItem("maw3ed.access")) {
        sessionStorage.setItem("maw3ed.access", t.accessToken);
        sessionStorage.setItem("maw3ed.refresh", t.refreshToken);
        sessionStorage.setItem("maw3ed.expiresAt", String(Date.now() + t.expiresIn * 1000));
      }
    } catch {}
  }, [lang, tokens]);
  return ctx;
}
async function open(ctx, path) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.errors = errors;
  await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  return page;
}
/** Only what is on screen: the router keeps earlier screens mounted, hidden. */
const overflow = (page) => page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
// innerText: what is rendered, not the hidden screens the router keeps mounted.
const text = async (page) => ((await page.locator("body").innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");

/** The app's booking flow, step by step, as the Maestro flows walk it. */
async function walkBooking(page) {
  for (let i = 0; i < 10; i++) {
    if (await page.locator('[data-testid="booking-submit"]').isVisible().catch(() => false)) break;
    if (await page.locator('[data-testid="booking-sign-in"]').isVisible().catch(() => false)) throw new Error("asked to sign in");
    const service = page.locator('[data-testid="service-option"]').first();
    if (await service.isVisible().catch(() => false)) await service.click();
    const choice = page.locator('[data-testid="choice-option"]').first();
    if (await choice.isVisible().catch(() => false)) await choice.click();
    if (await page.locator('[data-testid="day-option"]').first().isVisible().catch(() => false)) {
      for (let d = 0; d < 4 && !(await page.locator('[data-testid="time-slot"]').first().isVisible().catch(() => false)); d++) {
        await page.locator('[data-testid="day-option"]').nth(d).click();
        await page.waitForTimeout(1200);
      }
      await page.locator('[data-testid="time-slot"]').first().click();
    }
    const next = page.locator('[data-testid="booking-next"]');
    if (await next.isVisible().catch(() => false)) await next.click();
    await page.waitForTimeout(700);
  }
  await page.locator('[data-testid="booking-submit"]').click();
  await page.waitForURL(/\/booking\/[A-Za-z0-9]+/, { timeout: 30000 });
  return page.url().match(/\/booking\/([A-Za-z0-9]+)/)?.[1];
}

try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const admin = await login("admin@qa.test");
  const prov = await json(await sandbox({ action: "ensure-provider" }));
  await sandbox({ action: "mode", mode: "NORMAL" });

  /* ── A fictional mall with a venue and the sandbox gate, two tenants ── */
  const mallOwner = await account("a-mall", "Mall operator (test)");
  const mall = await organization(mallOwner, admin, { slug: "amall", kind: "MALL", nameAr: "مول بوابة النيل (بيانات تجريبية)", nameEn: "Nile Gate Mall (fictional test data)" });
  const mallSlug = `${tag}-amall`;
  const cityId = (await pg.query(`SELECT id FROM "City" WHERE slug = 'new-cairo'`)).rows[0].id;
  const venue = (await json(await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-av`, nameAr: "مول بوابة النيل (تجريبي)", nameEn: "Nile Gate Mall (test)", organizationId: mall.id, cityId }))).venue;
  made.venues.push(venue.id);
  await send(admin, `/api/admin/venues/${venue.id}`, "PATCH", { status: "ACTIVE", isPublished: true });
  const gate = (await json(await send(mallOwner, `/api/venues/${venue.id}/gates`, "POST", { nameAr: "البوابة الشمالية", nameEn: "North gate", kind: "PEDESTRIAN", code: `${tag}-N` }))).gate;
  await send(mallOwner, `/api/venues/${venue.id}/policy`, "PUT", { visitorEligibility: "BOOKING_REQUIRED", accessBeforeMinutes: 240, accessAfterMinutes: 60, maxGuestsPerBooking: 2, reentryAllowed: false, allowedGateIds: [gate.id], accessInstructionsAr: "ادخل من البوابة الشمالية.", accessInstructionsEn: "Enter by the north gate." });
  const site = `SITE-${tag}`;
  made.sites.push(site);
  await send(admin, `/api/venues/${venue.id}/access`, "PUT", { providerSlug: prov.provider.slug, siteRef: site });
  await send(mallOwner, `/api/venues/${venue.id}/access`, "PUT", { accessEnabled: true });
  const salon = await business("a-salon", { nameAr: "صالون البوابة (تجريبي)", nameEn: "Gate Salon (test)", category: "salons", services: [{ nameAr: "قص شعر", nameEn: "Haircut", duration: 30, price: 120 }] });
  const clinic = await business("a-clinic", { nameAr: "عيادة النيل (تجريبي)", nameEn: "Nile Clinic (test)", category: "clinics", services: [{ nameAr: "كشف", nameEn: "Visit", duration: 30, price: 300 }] });
  for (const [biz, section] of [[salon, "التجميل"], [clinic, "العيادات"]]) {
    await associate(mallOwner, mall.id, biz, "HOSTED", { section });
    const m = (await json(await send(biz.owner, "/api/business/venues/memberships", "POST", { venueId: venue.id }))).membership;
    await send(mallOwner, `/api/venues/${venue.id}/memberships/${m.id}`, "PATCH", { decision: "approve" });
  }
  const sara = await customer("a-sara", "سارة (عميلة تجريبية)");
  await pg.query(`UPDATE "User" SET "phoneVerifiedAt" = now() WHERE id = $1`, [sara.userId]);

  /* ════ Discovery and booking through an organization ════ */
  part("Discovery and booking (Arabic, phone width)");
  let token;
  {
    const ctx = await appContext({ lang: "ar", signIn: sara });
    const page = await open(ctx, "/");
    await page.locator('[data-testid="home-places"]').waitFor({ timeout: 30000 });
    check("home offers malls and groups once there is one", true);
    await page.locator('[data-testid="home-places"]').click();
    await page.locator(`[data-testid="place-${mallSlug}"]`).waitFor({ timeout: 20000 });
    check("the list shows the mall", true);
    await page.locator(`[data-testid="place-${mallSlug}"]`).click();
    await page.waitForURL(new RegExp(`/org/${mallSlug}`), { timeout: 20000 });
    await page.getByText("صالون البوابة (تجريبي)").locator("visible=true").first().waitFor({ timeout: 20000 });
    const orgText = await text(page);
    check("the organization page shows its directory and its sections", orgText.includes("عيادة النيل (تجريبي)") && orgText.includes("التجميل") && orgText.includes("العيادات"));
    await page.getByRole("checkbox", { name: "التجميل" }).locator("visible=true").first().click();
    await page.waitForTimeout(500);
    const filtered = await text(page);
    check("a section narrows the directory", filtered.includes("صالون البوابة (تجريبي)") && !filtered.includes("عيادة النيل (تجريبي)"));
    check("no sideways scrolling on the organization page", (await overflow(page)) === 0);
    await page.getByText("صالون البوابة (تجريبي)").locator("visible=true").first().click();
    await page.waitForURL(/\/business\//, { timeout: 20000 });
    check("the business opens with the organization carried along", page.url().includes(`org=${mallSlug}`), page.url());
    await page.locator('[data-testid="book-button"]').click();
    const sheet = page.locator('[data-testid="service-sheet-book"]');
    if (await sheet.isVisible({ timeout: 3000 }).catch(() => false)) await sheet.click();
    token = await walkBooking(page);
    const row = (await pg.query(`SELECT b.status::text, a."organizationId" FROM "Booking" b LEFT JOIN "OrganizationBookingAttribution" a ON a."bookingId" = b.id WHERE b."accessToken" = $1`, [token])).rows[0];
    check("booked through the app's own flow, credited to the mall", row?.status === "CONFIRMED" && row?.organizationId === mall.id, JSON.stringify(row));
    check("no script error on the way", page.errors.length === 0, page.errors.join(" | ").slice(0, 200));

    /* ════ The booking screen: check-in QR, passes, guests ════ */
    part("Booking QR and visitor passes");
    await page.getByRole("img", { name: /كود QR لتسجيل وصولك/ }).waitFor({ timeout: 20000 });
    check("the booking shows its check-in QR (from the server)", (await page.getByRole("img", { name: /كود QR لتسجيل وصولك/ }).locator("svg").count()) === 1);
    check("the visitor pass is marked as a test that opens no real gate", (await text(page)).includes("تجريبي — مش شغّال على أي بوابة حقيقية"));
    let accessCalls = 0;
    page.on("request", (r) => { if (r.url().includes("/access")) accessCalls += 1; });
    await page.getByRole("button", { name: "اطلب تصريح زيارة" }).click();
    await page.getByText("مستني موافقة نظام الدخول").locator("visible=true").first().waitFor({ timeout: 15000 });
    check("asking for a pass: pending, with no code yet (never a fake pass)", (await page.getByRole("img", { name: /تصريح .* اعرضه على البوابة/ }).count()) === 0);
    await runAccessCron();
    await page.getByText("فعّال", { exact: true }).locator("visible=true").first().waitFor({ timeout: 20000 });
    check("the access system confirms: the pass is active, with its own code", (await page.getByRole("img", { name: /تصريح .* اعرضه على البوابة/ }).count()) === 1);
    const settled = accessCalls;
    await page.waitForTimeout(12000);
    check("once nothing waits, the screen stops asking", accessCalls - settled === 0, `${accessCalls - settled} requests`);
    await page.getByLabel("الاسم زي ما في البطاقة").last().fill("علي (ضيف تجريبي)");
    await page.getByRole("button", { name: "ضيف مرافق" }).click();
    await page.getByText("علي (ضيف تجريبي)").locator("visible=true").first().waitFor({ timeout: 15000 });
    check("a guest is added, with a link to send them", (await page.getByRole("button", { name: "ابعت رابط التصريح" }).count()) === 1);
    check("no sideways scrolling on the booking screen", (await overflow(page)) === 0);
    await ctx.close();
  }

  /* ════ A guest's pass, and deep links ════ */
  part("Guest pass and deep links");
  {
    await runAccessCron();
    const acc = await json(await fetch(`${B}/api/booking/${token}/access`));
    const invite = acc.visitorAccess?.guests?.[0]?.inviteToken;
    const ctx = await appContext({ lang: "ar" });
    const page = await open(ctx, `/pass/${invite}`);
    await page.getByText("علي (ضيف تجريبي)").locator("visible=true").first().waitFor({ timeout: 20000 });
    const t = await text(page);
    check("the guest's link opens only their own pass", t.includes("علي (ضيف تجريبي)") && !t.includes("سارة") && !t.includes("صالون البوابة"));
    const bad = await open(ctx, "/pass/not-a-real-link-at-all-xx");
    await bad.getByText("الرابط ده مش شغّال").locator("visible=true").first().waitFor({ timeout: 15000 });
    check("a dead pass link says so, with a way home", true);
    const before = (await pg.query(`SELECT coalesce(sum(count),0)::int AS n FROM "OrganizationView" WHERE "organizationId" = $1 AND source = 'QR'`, [mall.id])).rows[0].n;
    const qr = await open(ctx, `/org/${mallSlug}?src=qr`);
    await qr.getByText("صالون البوابة (تجريبي)").locator("visible=true").first().waitFor({ timeout: 20000 });
    await qr.waitForTimeout(800);
    const after = (await pg.query(`SELECT coalesce(sum(count),0)::int AS n FROM "OrganizationView" WHERE "organizationId" = $1 AND source = 'QR'`, [mall.id])).rows[0].n;
    check("the mall's QR link opens its page and counts one QR visit", after === before + 1, `${before} → ${after}`);
    const v = await open(ctx, `/venue/${tag}-av`);
    await v.getByText("صالون البوابة (تجريبي)").locator("visible=true").first().waitFor({ timeout: 20000 });
    check("a venue link opens the venue with its businesses", (await text(v)).includes("عيادة النيل (تجريبي)"));
    const gone = await open(ctx, "/org/no-such-organization");
    await gone.getByText("الصفحة دي مش موجودة").locator("visible=true").first().waitFor({ timeout: 15000 });
    check("an unknown organization ends on a clear 'not found', not a loop", true);
    await ctx.close();
  }

  /* ════ Network: offline, cold start, ended session ════ */
  part("Network resilience and sessions");
  {
    const ctx = await appContext({ lang: "ar", signIn: sara });
    const page = await open(ctx, `/booking/${token}`);
    await page.getByRole("img", { name: /كود QR لتسجيل وصولك/ }).waitFor({ timeout: 20000 });
    let calls = 0;
    page.on("request", () => { calls += 1; });
    await ctx.setOffline(true);
    await page.waitForTimeout(15000);
    check("offline: the codes stay on screen", (await page.getByRole("img", { name: /كود QR لتسجيل وصولك/ }).count()) === 1);
    check("offline: the app does not keep asking (≤ 3 attempts in 15 s)", calls <= 3, `${calls} requests`);
    await ctx.setOffline(false);
    await ctx.close();

    // Cold start where "who am I" gets no answer: still signed in.
    const c2 = await appContext({ lang: "ar", signIn: sara });
    const p0 = await open(c2, "/");
    await p0.getByText("أهلًا، سارة").locator("visible=true").first().waitFor({ timeout: 20000 });
    await c2.route("**/api/auth/mobile/me", (r) => r.abort("internetdisconnected"));
    await p0.reload({ waitUntil: "networkidle" });
    await p0.waitForTimeout(2000);
    const kept = await p0.evaluate(() => !!sessionStorage.getItem("maw3ed.access"));
    // Home greets a signed-in person by name; a signed-out one is offered "Sign in".
    const shown = (await text(p0)).includes("أهلًا، سارة");
    check("a cold start with no answer keeps the sign-in (and the tokens)", kept && shown, `tokens ${kept}, name shown ${shown}; ${(await text(p0)).slice(0, 160)}`);
    await c2.unroute("**/api/auth/mobile/me");
    // The session ended on the server: signed out on the next check.
    await c2.route("**/api/auth/mobile/**", (r) => r.fulfill({ status: 401, contentType: "application/json", body: '{"error":"x"}' }));
    await p0.reload({ waitUntil: "networkidle" });
    await p0.waitForTimeout(2000);
    const cleared = await p0.evaluate(() => !sessionStorage.getItem("maw3ed.access"));
    check("a session the server ended signs out and clears the tokens", cleared);
    await c2.close();
  }

  /* ════ Loops: a pass that never gets confirmed ════ */
  part("Polling bound");
  {
    await sandbox({ action: "mode", mode: "NO_CONFIRM" });
    const slot = await slotNear(salon, salon.services[0].id, 60);
    const b2 = (await book(salon, { slot, name: "انتظار طويل" })).booking;
    await send(null, `/api/booking/${b2.accessToken}/access/pass`, "POST", { displayName: "انتظار طويل" });
    const ctx = await appContext({ lang: "ar" });
    const page = await ctx.newPage();
    let n = 0;
    page.on("request", (r) => { if (r.url().includes("/access")) n += 1; });
    await page.goto(`${APP}/booking/${b2.accessToken}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(55000);
    const stopped = n;
    await page.waitForTimeout(10000);
    check("a pass left pending is asked about at most 11 times, then never again", stopped <= 12 && n === stopped, `${stopped} then ${n}`);
    check("…and the screen offers 'check status again' instead", (await page.getByRole("button", { name: "شوف الحالة تاني" }).count()) === 1);
    await sandbox({ action: "mode", mode: "NORMAL" });
    await ctx.close();
  }

  /* ════ Support, data export, English ════ */
  part("Support, privacy and English");
  {
    const ctx = await appContext({ lang: "en", signIn: sara });
    const s = await open(ctx, "/support");
    await s.getByText("Talk to the Maw3ed team").locator("visible=true").first().waitFor({ timeout: 20000 });
    check("support opens in English, left to right", (await s.evaluate(() => getComputedStyle(document.querySelector("#root") ?? document.body).direction)) !== "rtl" || (await text(s)).includes("Help centre"));
    const a = await open(ctx, "/");
    await a.getByRole("tab", { name: /Account/ }).or(a.getByText("Account", { exact: true })).locator("visible=true").first().click();
    await a.getByText("Download a copy of your data").locator("visible=true").first().waitFor({ timeout: 20000 });
    const [dl] = await Promise.all([a.waitForEvent("download", { timeout: 20000 }), a.getByText("Download a copy of your data").click()]);
    const body = JSON.parse((await import("fs")).readFileSync(await dl.path(), "utf8"));
    check("'download my data' saves the account's own export", /^maw3ed-my-data-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()) && !!body && JSON.stringify(body).includes("سارة"));
    const o = await open(ctx, `/org/${mallSlug}`);
    await o.getByText("Gate Salon (test)").locator("visible=true").first().waitFor({ timeout: 20000 });
    check("the organization page in English shows English names", (await text(o)).includes("Nile Gate Mall (fictional test data)"));
    const b = await open(ctx, `/booking/${token}`);
    await b.getByText("Check-in code").locator("visible=true").first().waitFor({ timeout: 20000 });
    check("the booking's codes in English", (await text(b)).includes("Test pass — not valid at any real gate"));
    for (const [label, pg2] of [["support", s], ["account", a], ["organization", o], ["booking", b]]) {
      check(`no sideways scrolling in English: ${label}`, (await overflow(pg2)) === 0);
    }
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
