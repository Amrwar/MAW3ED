/**
 * Booking end to end, through the real widget, in Arabic and English,
 * across the business shapes the fixtures have:
 *
 *   qa-listing-0   staff ("any available" step)              Arabic
 *   qa-listing-2   restaurant: tables with a party size       English
 *   qa-rival-salon neither: service → day → time → details   Arabic, by keyboard
 *
 * Also: inline validation and recovery on the details step; Back
 * keeping what was typed; a dropped request retried without a second
 * booking; cancelling from the manage link; and that the addresses
 * people already have still answer.
 *
 * Local only, against a production build and the QA database with its
 * fixtures (scripts/qa-fixtures.mjs). Removes what it books.
 *
 *   npm run build && npx next start -p 3101
 *   node scripts/qa-booking-e2e.mjs [baseUrl] [--db url] [--shots dir]
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { Client } = require("pg");

const args = process.argv.slice(2);
const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const DB = args.includes("--db") ? args[args.indexOf("--db") + 1] : "postgresql://qa:qa@localhost:5450/maw3ed_qa";
const SHOTS = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
if (!/^http:\/\/localhost[:/]/.test(B) || !/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) {
  console.error("Local only: this books appointments.");
  process.exit(1);
}
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const pg = new Client({ connectionString: DB });
await pg.connect();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const TAG = "P18 E2E";
const phone = (n) => `0100000018${n}`;

const browser = await chromium.launch();

// The restaurant fixture has tables but no opening hours, so nothing
// can be booked there: give it a week of evenings for this run.
const restaurant = (await pg.query(`select id from "Business" where slug='qa-listing-2'`)).rows[0];
const addedHours = [];
if (restaurant) {
  const have = (await pg.query(`select "dayOfWeek" from "AvailabilityRule" where "businessId"=$1`, [restaurant.id])).rows.map((r) => r.dayOfWeek);
  for (let d = 0; d < 7; d++) {
    if (have.includes(d)) continue;
    const r = await pg.query(
      `insert into "AvailabilityRule" (id, "businessId", "dayOfWeek", "openTime", "closeTime") values ('p18e2e-hours-'||$2::text, $1, $2::int, '12:00', '23:00') returning id`,
      [restaurant.id, d],
    );
    addedHours.push(r.rows[0].id);
  }
}

/**
 * Opens the business page in `lang` and returns the page and the
 * widget. Everything is looked up inside the widget: the page around it
 * has its own pressable buttons (save, gallery filters, review votes).
 */
async function openWidget(ctx, slug, lang) {
  const page = await ctx.newPage();
  await page.goto(`${B}${lang === "en" ? "/en" : ""}/company/${slug}`, { waitUntil: "networkidle" });
  const w = page.getByTestId("booking-widget");
  await w.waitFor({ timeout: 30000 });
  return { page, w };
}
const t = (lang, ar, en) => (lang === "en" ? en : ar);
const stepOf = (w) => w.getAttribute("data-step");
// "Next" on most steps; the details step's button says what comes
// next instead ("review the booking").
const next = (w, lang) => w.getByRole("button", { name: new RegExp(`^(${t(lang, "التالي|راجع|مراجعة", "Next|Review")})`) }).last().click();
const back = (w, lang) => w.getByRole("button", { name: new RegExp(t(lang, "رجوع", "Back")) }).last().click();
const shot = (page, name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false }) : null);

/** Picks the first option the current step offers. */
async function pickFirst(w) {
  const btn = w.locator('button[aria-pressed]:not([disabled])').first();
  try {
    await btn.waitFor({ timeout: 15000 });
  } catch {
    const step = await stepOf(w);
    const text = (await w.textContent())?.replace(/\s+/g, " ").slice(0, 300);
    if (SHOTS) await w.page().screenshot({ path: path.join(SHOTS, `stuck-${step}.png`) });
    throw new Error(`no option to pick on step "${step}": ${text}`);
  }
  await btn.click();
}

async function fillDetails(w, lang, who, email) {
  await w.locator('input[autocomplete="name"]').fill(`${TAG} ${who}`);
  await w.locator('input[autocomplete="tel"]').fill(phone(who));
  if (email) await w.locator('input[autocomplete="email"]').fill(email);
}

async function confirm(w, lang) {
  await w.getByRole("button", { name: new RegExp(t(lang, "أكّد الحجز", "Confirm booking")) }).click();
}

async function doneState(w, lang) {
  const booked = w.getByText(t(lang, "حجزك اتأكد!", "You're booked!"));
  const requested = w.getByText(t(lang, "وصل طلب حجزك!", "Booking request sent!"));
  await Promise.race([booked.waitFor({ timeout: 30000 }), requested.waitFor({ timeout: 30000 })]);
  return (await booked.count()) ? "CONFIRMED" : "PENDING";
}

/** Walks the steps up to the details form, whatever steps this business has. */
async function stepsUntilDetails(w, lang) {
  for (let i = 0; i < 8; i++) {
    const step = await stepOf(w);
    if (step === "details") return;
    if (step === "date") {
      // Tomorrow rather than today: late in the evening today has few
      // times left, all inside the cancellation window, which made the
      // journey depend on the hour it ran at.
      const days = w.locator('button[aria-pressed]:not([disabled])');
      await days.first().waitFor({ timeout: 15000 });
      await ((await days.count()) > 1 ? days.nth(1) : days.first()).click(); // the strip advances by itself
      continue;
    }
    if (step === "resource") {
      // A table with seats shows a party-size control; ask for three
      // first, as a customer would, so only tables that fit are offered.
      const more = w.getByRole("button", { name: new RegExp(`^${t(lang, "أكتر", "More")}$`) });
      if (await more.count()) await more.first().click();
    }
    await pickFirst(w); // service, provider, resource, branch or time
    await next(w, lang);
  }
  throw new Error(`never reached details; stuck on ${await stepOf(w)}`);
}

async function bookingRow(who) {
  return (await pg.query(`select id, status, "staffMemberId", "resourceId", "partySize", "customerEmail", "accessToken" from "Booking" where "customerName"=$1 order by "createdAt" desc`, [`${TAG} ${who}`])).rows;
}

try {
  // ── 1. Arabic, staff business ──────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "maw3ed-lang", value: "ar", url: B }]);
    const { page, w } = await openWidget(ctx, "qa-listing-0", "ar");
    await stepsUntilDetails(w, "ar");
    await fillDetails(w, "ar", 1, "p18-e2e@example.test");
    await next(w, "ar");
    await shot(page, "ar-summary");
    await confirm(w, "ar");
    const state = await doneState(w, "ar");
    await shot(page, "ar-done");
    const rows = await bookingRow(1);
    check("AR staff business: booked through the widget on a phone", rows.length === 1, `state ${state}`);
    check("AR: 'any available' was given to a real staff member", !!rows[0]?.staffMemberId);
    check("AR: the typed email is on the booking", rows[0]?.customerEmail === "p18-e2e@example.test");
    check("AR: the screen's state matches the database", rows[0]?.status === state, `${rows[0]?.status} vs ${state}`);
    await ctx.close();
  }

  // ── 2. English, restaurant with tables and party size ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([{ name: "maw3ed-lang", value: "en", url: B }]);
    const { page, w } = await openWidget(ctx, "qa-listing-2", "en");
    await stepsUntilDetails(w, "en");
    await fillDetails(w, "en", 2);
    await next(w, "en");
    await shot(page, "en-summary");
    await confirm(w, "en");
    const state = await doneState(w, "en");
    const rows = await bookingRow(2);
    check("EN restaurant: booked with a table", rows.length === 1 && !!rows[0].resourceId, `state ${state}`);
    check("EN restaurant: party size of 3 stored", rows[0]?.partySize === 3, `partySize ${rows[0]?.partySize}`);
    await ctx.close();
  }

  // ── 3. Arabic, plain business, by keyboard; validation; Back; retry ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([{ name: "maw3ed-lang", value: "ar", url: B }]);
    const { page, w } = await openWidget(ctx, "qa-rival-salon", "ar");

    // Keyboard: focus the first service, choose it with Enter, reach Next with Tab.
    await w.locator('button[aria-pressed]').first().focus();
    await page.keyboard.press("Enter");
    const pressed = await w.locator('button[aria-pressed="true"]').count();
    check("Keyboard: Enter selects a service", pressed === 1);
    let reachedNext = false;
    for (let i = 0; i < 12 && !reachedNext; i++) {
      await page.keyboard.press("Tab");
      reachedNext = await page.evaluate(() => /التالي|Next/.test(document.activeElement?.textContent ?? ""));
    }
    check("Keyboard: Tab reaches Next", reachedNext);
    await page.keyboard.press("Enter");
    // Focus should land on the new step's container (tabIndex -1), not
    // stay on the Next button that was just pressed.
    const focusMoved = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      if (!el.closest('[data-testid="booking-widget"]')) return false;
      return !(el.tagName === "BUTTON" && /^(التالي|Next)/.test((el.textContent ?? "").trim()));
    });
    check("Keyboard: focus moves into the new step", focusMoved, await page.evaluate(() => document.activeElement?.tagName + " " + (document.activeElement?.textContent ?? "").trim().slice(0, 30)));
    const liveStep = await w.locator('[aria-live]').allTextContents();
    check("Step change is announced in a live region", liveStep.some((x) => /خطوة|Step/.test(x)), liveStep.join(" | ").slice(0, 80));

    // The remaining steps, by click (the day strip advances by itself).
    await stepsUntilDetails(w, "ar");

    // Validation: nothing typed.
    await next(w, "ar");
    const invalid = await w.locator('[aria-invalid="true"]').count();
    const described = await w.locator('[aria-invalid="true"][aria-describedby]').count();
    check("Validation: empty details are refused with aria-invalid + described errors", invalid >= 2 && described === invalid, `${invalid} invalid, ${described} described`);
    await w.locator('input[autocomplete="name"]').fill(`${TAG} 3`);
    await w.locator('input[autocomplete="tel"]').fill("123");
    await next(w, "ar");
    check("Validation: a bad phone is refused", (await w.locator('input[autocomplete="tel"][aria-invalid="true"]').count()) === 1);
    await w.locator('input[autocomplete="tel"]').fill(phone(3));
    await next(w, "ar");
    check("Validation: fixing it lets you through", (await stepOf(w)) === "summary");

    // Back keeps the data.
    await back(w, "ar");
    const kept = await w.locator('input[autocomplete="name"]').inputValue();
    await back(w, "ar");
    const timeStillPressed = (await stepOf(w)) === "time" && (await w.locator('button[aria-pressed="true"]').count()) >= 1;
    check("Back keeps the typed name and the chosen time", kept === `${TAG} 3` && timeStillPressed);
    await next(w, "ar");
    await next(w, "ar");

    // Retry: the first POST is dropped.
    let dropped = 0;
    await page.route("**/api/public/qa-rival-salon/bookings", (route) => {
      if (dropped === 0) { dropped++; return route.abort("failed"); }
      return route.continue();
    });
    await confirm(w, "ar");
    await w.getByText(/معرفناش نوصل للسيرفر/).first().waitFor({ timeout: 15000 });
    check("Retry: a dropped request shows an error and keeps the form", (await stepOf(w)) === "summary");
    await shot(page, "ar-error");
    await confirm(w, "ar");
    await doneState(w, "ar");
    const rows = await bookingRow(3);
    check("Retry: the second try books once, not twice", rows.length === 1, `${rows.length} row(s)`);

    // Cancel from the manage link.
    const token = rows[0]?.accessToken;
    if (token) {
      await page.goto(`${B}/booking/${token}`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /إلغاء الحجز/ }).click();
      await page.getByRole("button", { name: /تأكيد الإلغاء/ }).click();
      await page.waitForTimeout(1500);
      const after = (await bookingRow(3))[0];
      check("Cancel from the manage link cancels the booking", after?.status === "CANCELLED", after?.status);
      await shot(page, "ar-cancelled");
      check("Manage page no longer offers to cancel", (await page.getByRole("button", { name: /^إلغاء الحجز$/ }).count()) === 0);
    }
    await ctx.close();
  }

  // ── 4. Addresses people already have ───────────────────────────
  {
    const token = (await bookingRow(1))[0]?.accessToken;
    const urls = [
      ["/", 200], ["/en", 200], ["/businesses", 200], ["/businesses?city=cairo", 200], ["/en/businesses?q=salon", 200],
      ["/company/qa-salon", 200], ["/en/company/qa-salon", 200], ["/categories/salons", 200], ["/cities", 200],
      ["/pricing", 200], ["/faq", 200], ["/for-business", 200], ["/login", 200], ["/signup", 200],
      ["/privacy?lang=en", 200], ["/api/public/qa-salon", 200], ["/api/public/businesses?limit=1", 200],
      ...(token ? [[`/booking/${token}`, 200], [`/en/booking/${token}`, 200], [`/api/public/booking/${token}/calendar`, 200]] : []),
      ["/company/does-not-exist", 404], ["/api/public/does-not-exist", 404],
    ];
    const bad = [];
    for (const [u, want] of urls) {
      const r = await fetch(B + u, { redirect: "follow" });
      if (r.status !== want) bad.push(`${u} → ${r.status} (want ${want})`);
    }
    check(`URL compatibility: ${urls.length} addresses answer as before`, bad.length === 0, bad.join("; "));
  }
} catch (e) {
  check("script ran to the end", false, String(e?.stack ?? e).slice(0, 500));
} finally {
  await browser.close();
  const ids = (await pg.query(`select id from "Booking" where "customerName" like $1`, [`${TAG}%`])).rows.map((r) => r.id);
  if (ids.length) {
    await pg.query(`delete from "NotificationDelivery" where "notificationId" in (select id from "Notification" where "bookingId" = any($1))`, [ids]).catch(() => {});
    await pg.query(`delete from "Notification" where "bookingId" = any($1)`, [ids]).catch(() => {});
    await pg.query(`delete from "Payment" where "bookingId" = any($1)`, [ids]).catch(() => {});
    await pg.query(`delete from "Booking" where id = any($1)`, [ids]);
  }
  await pg.query(`delete from "Customer" where name like $1`, [`${TAG}%`]).catch(() => {});
  if (addedHours.length) await pg.query(`delete from "AvailabilityRule" where id = any($1)`, [addedHours]);
  await pg.end();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} passed; removed ${ids.length} booking(s)`);
  process.exit(passed === results.length ? 0 : 1);
}
