/**
 * Phase 23 screens in a real browser (Chromium), on a production build
 * against the QA database with ACCESS_SANDBOX=1:
 *
 *   the customer's booking page shows the check-in QR and, at a venue
 *   with passes, asks for a pass and shows it once the cron issues it,
 *   labelled as a sandbox → the owner's check-in desk verifies a pasted
 *   code and checks the customer in → the venue security desk lists the
 *   visitor and can hold the pass → nothing logs a console error and
 *   the pending-pass check stops polling on its own. Then the same
 *   screens again with English chosen (the maw3ed-lang cookie): English
 *   words, left-to-right, Western digits, the server's reasons and names
 *   in English, the guest pass page and /c/<code> too, and the rest of
 *   the booking page (status, details, changing the time, cancelling).
 *
 *   CRON_SECRET=p19-local-cron node scripts/qa-phase23-browser.mjs [baseUrl]
 */
import { createRequire } from "module";
import { randomBytes } from "crypto";
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const { chromium } = require("playwright");

const B = process.argv.slice(2).find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const DB = "postgresql://qa:qa@localhost:5450/maw3ed_qa";
const CRON = process.env.CRON_SECRET ?? "p19-local-cron";
if (!/^http:\/\/localhost[:/]/.test(B)) {
  console.error("Local only.");
  process.exit(1);
}
const pg = new Client({ connectionString: DB });
await pg.connect();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const tag = `qa23b-${Date.now()}`;
const cleanup = { bookings: [], venues: [], users: [] };
const cron = { Authorization: `Bearer ${CRON}`, "Content-Type": "application/json" };

function cairoWall() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
}
async function booking(offsetMin) {
  const { rows: [b] } = await pg.query(`SELECT b.id, s.id AS "serviceId" FROM "Business" b JOIN "Service" s ON s."businessId" = b.id WHERE b.slug = 'qa-salon' LIMIT 1`);
  const start = new Date(Math.floor((cairoWall().getTime() + offsetMin * 60_000) / 60_000) * 60_000);
  const end = new Date(start.getTime() + 30 * 60_000);
  const lit = (d) => d.toISOString().slice(0, 19).replace("T", " ");
  const token = randomBytes(24).toString("base64url");
  const id = `${tag}-${Math.random().toString(36).slice(2, 10)}`;
  await pg.query(
    `INSERT INTO "Booking" (id, "businessId", "serviceId", "customerName", "customerPhone", date, "startTime", "endTime", "startsAt", "endsAt", status, "totalPrice", "accessToken", "updatedAt")
     VALUES ($1,$2,$3,'سلمى متصفح','01012345678',$4,$5,$6,$7,$8,'CONFIRMED',100,$9,NOW())`,
    [id, b.id, b.serviceId, `${start.toISOString().slice(0, 10)} 00:00:00`, start.toISOString().slice(11, 16), end.toISOString().slice(11, 16), lit(start), lit(end), token],
  );
  cleanup.bookings.push(id);
  return { id, token };
}

const browser = await chromium.launch();
async function signedIn(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${B}/login`, { waitUntil: "networkidle" });
  await p.fill("#login-email", email);
  await p.fill("#login-password", "QaPassword123!");
  await Promise.all([p.waitForURL(/\/(dashboard|admin|org-admin|account)/, { timeout: 60000 }), p.click('button[type="submit"]')]);
  await p.close();
  return ctx;
}
/** Arabic letters in `text` once the names that are Arabic data are taken out. */
const ARABIC = /[\u0600-\u06FF]/;
const ARABIC_DIGITS = /[\u0660-\u0669]/;
function arabicLeft(text, names = []) {
  let rest = text;
  for (const n of names) rest = rest.split(n).join("");
  const m = rest.match(new RegExp(`.{0,20}${ARABIC.source}.{0,20}`));
  return m ? m[0] : "";
}
async function english(ctx) {
  await ctx.addCookies([{ name: "maw3ed-lang", value: "en", url: B }]);
  return ctx;
}
function watchErrors(page) {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const prov = await (await fetch(`${B}/api/dev/access-sandbox`, { method: "POST", headers: cron, body: JSON.stringify({ action: "ensure-provider" }) })).json();
  await fetch(`${B}/api/dev/access-sandbox`, { method: "POST", headers: cron, body: JSON.stringify({ action: "mode", mode: "NORMAL" }) });
  const { rows: [{ id: cityId }] } = await pg.query(`SELECT id FROM "City" LIMIT 1`);
  const { rows: [salon] } = await pg.query(`SELECT id, "ownerId", "nameAr" FROM "Business" WHERE slug = 'qa-salon'`);
  const venueId = `${tag}-venue`;
  await pg.query(`INSERT INTO "Venue" (id, slug, "nameAr", "cityId", status, "isPublished", "accessEnabled", "accessProviderId", "accessSiteRef", "updatedAt") VALUES ($1,$1,'مول المتصفح',$2,'ACTIVE',true,true,$3,'SITE-QA23B',NOW())`, [venueId, cityId, prov.provider.id]);
  cleanup.venues.push(venueId);
  await pg.query(`UPDATE "Venue" SET "nameEn" = 'Browser Mall' WHERE id = $1`, [venueId]);
  await pg.query(`INSERT INTO "VenuePolicy" (id, "venueId", "visitorEligibility", "accessBeforeMinutes", "maxGuestsPerBooking", "accessInstructionsAr", "accessInstructionsEn", "updatedAt") VALUES ($1,$2,'BOOKING_REQUIRED',240,2,'ادخل من البوابة الشمالية','Use the north gate',NOW())`, [`${tag}-pol`, venueId]);
  await pg.query(`INSERT INTO "VenueMembership" (id, "venueId", "businessId", status, "requestedById", "updatedAt") VALUES ($1,$2,$3,'APPROVED',$4,NOW())`, [`${tag}-mem`, venueId, salon.id, salon.ownerId]);
  const secEmail = `${tag}-sec@qa.test`;
  const { rows: [sec] } = await pg.query(`INSERT INTO "User" (id, email, name, password, "emailVerified", "updatedAt") SELECT $1,$2,'أمن متصفح',password,NOW(),NOW() FROM "User" WHERE email='owner@qa.test' RETURNING id`, [`${tag}-sec`, secEmail]);
  cleanup.users.push(sec.id);
  await pg.query(`INSERT INTO "VenueRole" (id, "userId", kind, "venueId") VALUES ($1,$2,'VENUE_SECURITY',$3)`, [`${tag}-role`, sec.id, venueId]);

  // ── The customer's booking page ──────────────────────────────────────
  const b = await booking(-5);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  let accessCalls = 0;
  page.on("request", (r) => { if (r.url().includes(`/api/booking/${b.token}/access`) && r.method() === "GET") accessCalls++; });
  await page.goto(`${B}/booking/${b.token}`, { waitUntil: "networkidle" });
  await page.getByText("كود تسجيل الوصول").waitFor({ timeout: 15000 });
  check("customer page: the check-in QR renders as an accessible image", await page.locator('[role="img"][aria-label*="تسجيل وصولك"] svg').count() === 1);
  check("customer page: the check-in QR is labelled as the booking's code, not a venue pass", await page.getByText("ده كود الحجز بس").count() === 1);
  await page.getByText("تصريح دخول مول المتصفح").waitFor({ timeout: 15000 });
  check("customer page: the venue's pass section is separate and says it is a sandbox", await page.getByText("بيئة تجريبية").count() >= 1);
  check("customer page: the venue's instructions are shown", await page.getByText("ادخل من البوابة الشمالية").count() === 1);
  // The sandbox holds the pass unconfirmed, so "pending" is on screen
  // however fast the job runs; then it confirms, as a provider would.
  await fetch(`${B}/api/dev/access-sandbox`, { method: "POST", headers: cron, body: JSON.stringify({ action: "mode", mode: "NO_CONFIRM" }) });
  await page.getByRole("button", { name: "اطلب تصريح دخول" }).click();
  await page.getByText("مستني موافقة نظام الدخول").waitFor({ timeout: 15000 });
  check("customer page: asking shows the pass as pending (not active)", true);
  await fetch(`${B}/api/cron/access`, { headers: cron });
  await fetch(`${B}/api/dev/access-sandbox`, { method: "POST", headers: cron, body: JSON.stringify({ action: "mode", mode: "NORMAL" }) });
  await fetch(`${B}/api/dev/access-sandbox`, { method: "POST", headers: cron, body: JSON.stringify({ action: "confirm" }) });
  await page.getByText("فعّال", { exact: true }).waitFor({ timeout: 20000 });
  check("customer page: the pending pass becomes active on its own (bounded re-check)", await page.locator('[role="img"][aria-label*="كود تصريح الدخول"] svg').count() === 1);
  const callsAfterActive = accessCalls;
  await page.waitForTimeout(9000);
  check("customer page: once nothing is pending, it stops re-checking", accessCalls === callsAfterActive, `${accessCalls - callsAfterActive} extra request(s)`);
  await page.getByPlaceholder("الاسم زي ما في البطاقة").fill("ضيف المتصفح");
  await page.getByRole("button", { name: "ضيف مرافق" }).click();
  await page.getByText("ضيف المتصفح").first().waitFor({ timeout: 15000 });
  check("customer page: a guest is added from the page", await page.getByRole("button", { name: "انسخ رابط التصريح" }).count() === 1);
  check("customer page: no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  const codeUrl = (await (await fetch(`${B}/api/booking/${b.token}/access`)).json()).checkIn.url;
  await ctx.close();

  // ── The owner's check-in desk ────────────────────────────────────────
  const owner = await signedIn("owner@qa.test");
  const op = await owner.newPage();
  const oerr = watchErrors(op);
  await op.goto(`${B}/dashboard/check-in`, { waitUntil: "networkidle" });
  await op.fill("#checkin-code", codeUrl);
  await op.getByRole("button", { name: "اتحقق" }).click();
  await op.getByText("الكود سليم").waitFor({ timeout: 15000 });
  check("desk: a pasted code shows the booking", await op.getByText("سلمى متصفح").count() === 1);
  await op.getByRole("button", { name: "سجّل الوصول" }).click();
  await op.getByText("اتسجّل وصوله قبل كده").waitFor({ timeout: 15000 });
  const { rows: [st] } = await pg.query(`SELECT status FROM "Booking" WHERE id = $1`, [b.id]);
  check("desk: checking in moves the booking to ARRIVED", st.status === "ARRIVED");
  check("desk: the sidebar offers the check-in page", await op.locator('a[href="/dashboard/check-in"]').count() >= 1);
  check("desk: no console errors", oerr.length === 0, oerr.slice(0, 3).join(" | "));
  await owner.close();

  // ── The venue security desk ──────────────────────────────────────────
  const security = await signedIn(secEmail).catch(async () => {
    // Somebody with only a venue role lands on /org-admin; signedIn waits for that.
    throw new Error("security sign-in did not land");
  });
  const sp = await security.newPage();
  const serr = watchErrors(sp);
  await sp.goto(`${B}/venue-admin/${venueId}/access`, { waitUntil: "networkidle" });
  await sp.getByText("دخول الزوار — مول المتصفح").waitFor({ timeout: 15000 });
  check("security desk: lists the holder and the guest", await sp.getByText("سلمى متصفح").count() >= 1 && await sp.getByText("ضيف المتصفح").count() >= 1);
  check("security desk: no phone number is shown", !(await sp.content()).includes("01012345678"));
  check("security desk: no switch for passes and no provider form", await sp.getByRole("button", { name: /تصاريح الزوار/ }).count() === 0 && await sp.getByRole("combobox", { name: "مزوّد الدخول" }).count() === 0);
  const row = sp.locator("tr", { hasText: "ضيف المتصفح" });
  await row.getByPlaceholder("السبب").fill("فحص QA");
  await row.getByRole("button", { name: "وقّف" }).click();
  await sp.getByText("اتوقف.").waitFor({ timeout: 15000 });
  check("security desk: holding a pass with a reason works from the page", true);
  check("security desk: no console errors", serr.length === 0, serr.slice(0, 3).join(" | "));
  await security.close();

  // ── The same screens in English ──────────────────────────────────────
  const names = ["سلمى متصفح"];
  const b2 = await booking(40);
  const ectx = await english(await browser.newContext({ viewport: { width: 390, height: 844 } }));
  const ep = await ectx.newPage();
  const eerr = watchErrors(ep);
  await ep.goto(`${B}/booking/${b2.token}`, { waitUntil: "networkidle" });
  await ep.getByText("Check-in code", { exact: true }).waitFor({ timeout: 15000 });
  check("EN customer page: the check-in section reads left to right", (await ep.locator("#checkin-h").evaluate((e) => getComputedStyle(e).direction)) === "ltr");
  check("EN customer page: the QR's label is English", await ep.locator('[role="img"][aria-label*="check in for your booking"] svg').count() === 1);
  await ep.getByText("Browser Mall visitor pass").waitFor({ timeout: 15000 });
  check("EN customer page: the venue's English name, instructions and the sandbox notice", await ep.getByText("Use the north gate").count() === 1 && await ep.getByText(/^Test environment/).count() >= 1);
  await ep.getByRole("button", { name: "Request a visitor pass" }).click();
  await ep.getByText(/^(Waiting for the access system|Active)$/).first().waitFor({ timeout: 15000 });
  await fetch(`${B}/api/cron/access`, { headers: cron });
  await ep.getByText("Active", { exact: true }).waitFor({ timeout: 20000 });
  check("EN customer page: the pass's state and details are English", await ep.getByText("Leave and return").count() === 1 && await ep.getByText("Any gate").count() === 1);
  await ep.getByPlaceholder("Name as on your ID").fill("Guest Browser");
  await ep.getByRole("button", { name: "Add a guest" }).click();
  await ep.getByText("Added. Copy their link and send it to them.").waitFor({ timeout: 15000 });
  const panel = (await ep.locator("#checkin-h").locator("xpath=ancestor::section").innerText()) + (await ep.locator("#pass-h").locator("xpath=ancestor::section").innerText());
  check("EN customer page: no Arabic left in the panel (names aside)", !arabicLeft(panel, names), arabicLeft(panel, names));
  check("EN customer page: times use Western digits", !ARABIC_DIGITS.test(panel));
  check("EN customer page: no console errors", eerr.length === 0, eerr.slice(0, 3).join(" | "));

  // The rest of the booking page, in English.
  const { rows: [svc] } = await pg.query(`SELECT s."nameAr" FROM "Service" s JOIN "Booking" bk ON bk."serviceId" = s.id WHERE bk.id = $1`, [b2.id]);
  const pageData = [...names, salon.nameAr, svc.nameAr];
  check("EN booking page: left to right, with the status and details in English",
    (await ep.locator("main").evaluate((e) => getComputedStyle(e).direction)) === "ltr" &&
    await ep.getByText("Confirmed", { exact: true }).count() === 1 && await ep.getByText("Booking details").count() === 1);
  const pageText = await ep.locator("main").innerText();
  check("EN booking page: no Arabic left anywhere on it (Arabic data aside)", !arabicLeft(pageText, pageData), arabicLeft(pageText, pageData));
  check("EN booking page: no Arabic-Indic digits", !ARABIC_DIGITS.test(pageText));
  check("EN booking page: no console errors", eerr.length === 0, eerr.slice(0, 3).join(" | "));
  // Changing and cancelling: a booking outside the salon's 2-hour cut-off.
  const b3 = await booking(200);
  await ep.goto(`${B}/booking/${b3.token}`, { waitUntil: "networkidle" });
  const manageText = await ep.locator("main").innerText();
  check("EN booking page: the manage section and its cut-off rule are English", /Manage booking/.test(manageText) && /up to 2 hours before it/.test(manageText), manageText.slice(0, 300));
  await ep.getByRole("button", { name: "Change the time" }).click();
  await ep.getByText("Choose a new date").waitFor({ timeout: 10000 });
  const tomorrow = new Date(cairoWall().getTime() + 86_400_000).toISOString().slice(0, 10);
  await ep.fill("#reschedule-date", tomorrow);
  await ep.getByRole("button", { name: /Show free times/ }).click();
  await ep.locator("text=/^(Change date|No times are free that day\. Choose another date\.)$/").first().waitFor({ timeout: 15000 });
  const flowText = await ep.locator("main").innerText();
  check("EN booking page: the change-time flow is English", !arabicLeft(flowText, pageData), arabicLeft(flowText, pageData));
  await ep.getByRole("button", { name: "Cancel", exact: true }).click();
  await ep.getByRole("button", { name: "Cancel booking" }).click();
  await ep.getByText("Cancel this booking? This can't be undone.").waitFor({ timeout: 10000 });
  await ep.getByRole("button", { name: "Yes, cancel" }).click();
  await ep.getByText("This booking was cancelled.").waitFor({ timeout: 15000 });
  const { rows: [st3] } = await pg.query(`SELECT status FROM "Booking" WHERE id = $1`, [b3.id]);
  check("EN booking page: cancelling works and says so in English", st3.status === "CANCELLED" && await ep.getByText("Cancelled", { exact: true }).count() === 1 && await ep.getByRole("link", { name: "Book again" }).count() === 1);
  const { rows: [guest] } = await pg.query(`SELECT "inviteToken" FROM "BookingGuest" g JOIN "Visitor" v ON v.id = g."visitorId" WHERE g."bookingId" = $1 AND v."displayName" = 'Guest Browser'`, [b2.id]);
  await ep.goto(`${B}/pass/${guest.inviteToken}`, { waitUntil: "networkidle" });
  const passText = await ep.locator("main").innerText();
  check("EN guest pass page: English, left to right", /Browser Mall visitor pass/.test(passText) && (await ep.locator("main").evaluate((e) => getComputedStyle(e).direction)) === "ltr");
  check("EN guest pass page: no Arabic left", !arabicLeft(passText), arabicLeft(passText));
  const code2 = (await (await fetch(`${B}/api/booking/${b2.token}/access`)).json()).checkIn.url;
  await ep.goto(code2, { waitUntil: "networkidle" });
  check("EN /c/<code> signed out: explains the code in English", await ep.getByText("This is a booking check-in code").count() === 1 && await ep.getByText("Work there? Sign in to check the customer in").count() === 1);
  await ectx.close();

  const eowner = await english(await signedIn("owner@qa.test"));
  const eop = await eowner.newPage();
  const eoerr = watchErrors(eop);
  await eop.goto(`${B}/dashboard/check-in`, { waitUntil: "networkidle" });
  check("EN desk: heading and title are English", await eop.getByRole("heading", { name: "Check-in", exact: true }).count() === 1 && (await eop.title()).startsWith("Check-in"));
  await eop.fill("#checkin-code", code2);
  await eop.getByRole("button", { name: "Verify" }).click();
  await eop.getByText(/^(Valid code|Too early)/).waitFor({ timeout: 15000 });
  check("EN desk: the booking's details are labelled in English", await eop.getByText("Customer", { exact: true }).count() === 1 && await eop.getByText("Service", { exact: true }).count() === 1);
  const deskText = await eop.locator("main").innerText();
  check("EN desk: no Arabic-Indic digits", !ARABIC_DIGITS.test(deskText));
  await eop.goto(code2, { waitUntil: "networkidle" });
  await eop.getByText(/^(Valid code|Too early)/).waitFor({ timeout: 15000 });
  check("EN /c/<code> signed in: the desk opens in English", (await eop.locator("h1").first().innerText()).startsWith("Check-in"));
  check("EN desk: no console errors", eoerr.length === 0, eoerr.slice(0, 3).join(" | "));
  await eowner.close();

  const esec = await english(await signedIn(secEmail));
  const esp = await esec.newPage();
  const eserr = watchErrors(esp);
  await esp.goto(`${B}/venue-admin/${venueId}/access`, { waitUntil: "networkidle" });
  await esp.getByText("Visitor access — Browser Mall").waitFor({ timeout: 15000 });
  check("EN security desk: columns and states in English", await esp.getByRole("columnheader", { name: "Visiting" }).count() === 1 && await esp.getByText("Allowed", { exact: true }).count() >= 1);
  check("EN security desk: the server's reason comes in English", await esp.getByText("Suspended by the venue's security").count() >= 1);
  const erow = esp.locator("tr", { hasText: "Guest Browser" });
  await erow.getByPlaceholder("Reason").fill("QA check");
  await erow.getByRole("button", { name: "Suspend" }).click();
  await esp.getByText("Suspended.", { exact: true }).waitFor({ timeout: 15000 });
  check("EN security desk: holding a pass works and confirms in English", true);
  const secText = await esp.locator("main").innerText();
    // Data typed in Arabic stays Arabic: visitor names, the salon's name (it has no English one) and the Arabic run's note.
  const data = [...names, "ضيف المتصفح", salon.nameAr, "فحص QA"];
  check("EN security desk: no Arabic left (Arabic data aside)", !arabicLeft(secText, data), arabicLeft(secText, data));
  check("EN security desk: no console errors", eserr.length === 0, eserr.slice(0, 3).join(" | "));
  await esec.close();
} catch (e) {
  check("script ran to completion", false, e instanceof Error ? e.stack : String(e));
} finally {
  await fetch(`${B}/api/dev/access-sandbox`, { method: "POST", headers: cron, body: JSON.stringify({ action: "mode", mode: "NORMAL" }) }).catch(() => {});
  await browser.close();
  await pg.query(`DELETE FROM "AuditLog" WHERE "resourceId" = ANY($1) OR "resourceId" = ANY($2)`, [cleanup.bookings, cleanup.venues]).catch(() => {});
  await pg.query(`DELETE FROM "Venue" WHERE id = ANY($1)`, [cleanup.venues]).catch((e) => console.error(e.message));
  const { rows: vis } = await pg.query(`SELECT "visitorId" FROM "BookingGuest" WHERE "bookingId" = ANY($1)`, [cleanup.bookings]).catch(() => ({ rows: [] }));
  await pg.query(`DELETE FROM "Booking" WHERE id = ANY($1)`, [cleanup.bookings]).catch((e) => console.error(e.message));
  await pg.query(`DELETE FROM "Visitor" WHERE id = ANY($1)`, [vis.map((v) => v.visitorId)]).catch(() => {});
  await pg.query(`DELETE FROM "SandboxAccessPass" WHERE "siteRef" = 'SITE-QA23B'`).catch(() => {});
  await pg.query(`DELETE FROM "User" WHERE id = ANY($1)`, [cleanup.users]).catch((e) => console.error(e.message));
  await pg.query(`DELETE FROM "RateLimit"`).catch(() => {});
  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
