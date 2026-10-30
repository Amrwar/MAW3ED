/**
 * Phase 21 end to end over HTTP, on a production build against the QA
 * database (scripts/qa-fixtures.mjs), the way a new owner would go:
 *
 *   sign up → save an onboarding draft → read it back (another device)
 *   → create the business (private, draft gone) → readiness checklist
 *   → publish refused with what is missing → review policies
 *   → preview the private page (owner 200, anonymous 404)
 *   → a test booking through the real booking route → labelled, not counted
 *   → publish waits for the email → email confirmed → publish succeeds,
 *     test bookings gone → page public → unpublish → hidden again
 *   → CSV import preview, commit, cross-tenant rollback refused, rollback
 *   → entitlements; free plan refused analytics data and deposits
 *   → demo, help (ar/en), setup and import pages render.
 *
 * Local only. Everything it creates is tagged qa21- and removed.
 *
 *   node scripts/qa-phase21.mjs [baseUrl] [--db url]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const args = process.argv.slice(2);
const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const DB = args.includes("--db") ? args[args.indexOf("--db") + 1] : "postgresql://qa:qa@localhost:5450/maw3ed_qa";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB) || !/^http:\/\/localhost[:/]/.test(B)) {
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

class Jar {
  constructor() { this.cookies = new Map(); }
  take(res) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function webLogin(email, password) {
  const jar = new Jar();
  const csrfRes = await fetch(`${B}/api/auth/csrf`);
  jar.take(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${B}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.header(), Origin: B },
    body: new URLSearchParams({ csrfToken, email, password, redirect: "false" }),
  });
  jar.take(res);
  return jar;
}

const call = (jar, path, init = {}) =>
  fetch(`${B}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(jar ? { Cookie: jar.header() } : {}),
      ...(init.body ? { "Content-Type": "application/json", Origin: B } : {}),
      ...(init.method && init.method !== "GET" ? { Origin: B } : {}),
      ...(init.headers ?? {}),
    },
  });
const json = async (res) => res.json().catch(() => ({}));

const stamp = Date.now();
const email = `qa21-${stamp}@example.test`;
const password = "QaPassword123!";
const slug = `qa21-${stamp}`;
let userId = null;
let businessId = null;

try {
  /* ── Sign-up and the draft ─────────────────────────────── */
  const signup = await fetch(`${B}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: B },
    body: JSON.stringify({ name: "QA Phase21", email, password }),
  });
  check("sign up a new owner", signup.status === 201 || signup.status === 200, `status ${signup.status}`);
  userId = (await pg.query(`SELECT id FROM "User" WHERE email=$1`, [email])).rows[0]?.id ?? null;

  let jar = await webLogin(email, password);
  const draftData = { nameAr: "صالون الفحص", phone: "01012345678", services: [{ nameAr: "قص", duration: 30, price: 120 }] };
  const put = await call(jar, "/api/onboarding/draft", { method: "PUT", body: JSON.stringify({ step: 3, data: draftData }) });
  check("save an onboarding draft on the server", put.status === 200, `status ${put.status}`);

  const otherDevice = await webLogin(email, password);
  const got = await json(await call(otherDevice, "/api/onboarding/draft"));
  check("resume the draft from another session", got.draft?.step === 3 && got.draft?.data?.nameAr === "صالون الفحص");

  const big = await call(jar, "/api/onboarding/draft", {
    method: "PUT",
    body: JSON.stringify({ step: 1, data: { x: "a".repeat(70 * 1024) } }),
  });
  check("refuse an oversized draft", big.status === 413, `status ${big.status}`);

  const anonDraft = await call(null, "/api/onboarding/draft");
  check("draft needs a session", anonDraft.status === 401, `status ${anonDraft.status}`);

  /* ── Create the business ───────────────────────────────── */
  const { rows: [cat] } = await pg.query(`SELECT id FROM "Category" LIMIT 1`);
  const { rows: [city] } = await pg.query(`SELECT id FROM "City" LIMIT 1`);
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "21:00", isClosed: false }));
  const create = await call(jar, "/api/onboarding", {
    method: "POST",
    body: JSON.stringify({
      nameAr: "صالون الفحص", categoryId: cat.id, cityId: city.id, phone: "01012345678",
      address: "شارع الفحص", services: [{ nameAr: "قص شعر", duration: 30, price: 120 }],
      availability: days, slug,
    }),
  });
  const created = await json(create);
  businessId = created.business?.id ?? null;
  check("create the business, private", create.status === 201 && created.business?.isPublished === false, `status ${create.status}`);
  const draftLeft = (await pg.query(`SELECT count(*)::int n FROM "OnboardingDraft" WHERE "userId"=$1`, [userId])).rows[0].n;
  check("the draft is gone once the business exists", draftLeft === 0);
  const events = (await pg.query(`SELECT kind FROM "LifecycleEvent" WHERE "userId"=$1`, [userId])).rows.map((r) => r.kind);
  check("lifecycle: onboarding started and business registered", events.includes("ONBOARDING_STARTED") && events.includes("BUSINESS_REGISTERED"), events.join(","));

  // A fresh session carries the new business id, as the wizard's update() does.
  jar = await webLogin(email, password);

  /* ── Readiness and publishing ──────────────────────────── */
  const ready = await json(await call(jar, "/api/business/readiness"));
  check(
    "readiness lists email and policies as missing",
    ready.readiness?.canPublish === false && ready.readiness.missing.includes("email") && ready.readiness.missing.includes("policies"),
    JSON.stringify(ready.readiness?.missing),
  );
  check("verification states are separate, identity not verified", ready.verification?.email === false && ready.verification?.identity?.verified === false);

  const early = await call(jar, "/api/business/publish", { method: "POST", body: JSON.stringify({ action: "publish" }) });
  const earlyBody = await json(early);
  check("publish refused with what is missing", early.status === 409 && earlyBody.code === "not-ready", `${early.status} ${earlyBody.code}`);

  const policies = await call(jar, "/api/business/settings/booking", {
    method: "PATCH",
    body: JSON.stringify({ autoConfirm: true, minNoticeMinutes: 0, maxAdvanceDays: 60, bufferMinutes: 0, sameDayCutoff: null, cancellationCutoffHours: 6, reviewed: true }),
  });
  check("review booking policies", policies.status === 200, `status ${policies.status}`);
  const badPolicy = await call(jar, "/api/business/settings/booking", { method: "PATCH", body: JSON.stringify({ cancellationCutoffHours: 500 }) });
  check("an out-of-range policy is refused", badPolicy.status === 422, `status ${badPolicy.status}`);

  /* ── Preview and a test booking ────────────────────────── */
  const ownerPage = await call(jar, `/company/${slug}`);
  const ownerHtml = await ownerPage.text();
  check("owner previews the private page", ownerPage.status === 200 && /Preview|معاينة/.test(ownerHtml), `status ${ownerPage.status}`);
  const anonPage = await call(null, `/company/${slug}`);
  check("anyone else gets 404 for the private page", anonPage.status === 404, `status ${anonPage.status}`);

  const svc = (await pg.query(`SELECT id FROM "Service" WHERE "businessId"=$1 LIMIT 1`, [businessId])).rows[0];
  const day = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const slots = await json(await call(jar, `/api/public/${slug}/slots?serviceId=${svc.id}&date=${day}`));
  const anonSlots = await call(null, `/api/public/${slug}/slots?serviceId=${svc.id}&date=${day}`);
  check("owner sees slots, anonymous does not", Array.isArray(slots.slots) && slots.slots.length > 0 && anonSlots.status === 404, `${slots.slots?.length} / ${anonSlots.status}`);

  const testBook = await call(jar, `/api/public/${slug}/bookings`, {
    method: "POST",
    body: JSON.stringify({ serviceId: svc.id, date: day, startTime: slots.slots?.[0], customerName: "تجربة المالك", customerPhone: "01012345678" }),
  });
  const testBody = await json(testBook);
  check("owner makes a test booking through the real route", testBook.status === 201 && testBody.testBooking === true, `status ${testBook.status}`);
  const anonBook = await call(null, `/api/public/${slug}/bookings`, {
    method: "POST",
    body: JSON.stringify({ serviceId: svc.id, date: day, startTime: slots.slots?.[1], customerName: "غريب", customerPhone: "01012345679" }),
  });
  check("anonymous cannot book the private page", anonBook.status === 404, `status ${anonBook.status}`);

  const tb = (await pg.query(`SELECT count(*)::int n FROM "Booking" WHERE "businessId"=$1 AND "isTest"`, [businessId])).rows[0].n;
  const cust = (await pg.query(`SELECT count(*)::int n FROM "Customer" WHERE "businessId"=$1`, [businessId])).rows[0].n;
  check("the test booking is stored as a test, with no customer record", tb === 1 && cust === 0, `tests ${tb}, customers ${cust}`);
  const list = await json(await call(jar, `/api/business/bookings?limit=10`));
  check("the bookings list labels it", (list.bookings ?? []).some((b) => b.isTest === true));
  const ent0 = await json(await call(jar, "/api/business/entitlements"));
  check("it does not count toward the plan", ent0.usage?.bookingsThisMonth === 0, JSON.stringify(ent0.usage));
  const queued = (await pg.query(
    `SELECT count(*)::int n FROM "Notification" WHERE "bookingId" IN (SELECT id FROM "Booking" WHERE "businessId"=$1)`, [businessId],
  ).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n;
  check("nothing was queued to notify anyone", queued === 0, `outbox ${queued}`);

  /* ── Email, then publish ───────────────────────────────── */
  const waiting = await call(jar, "/api/business/publish", { method: "POST", body: JSON.stringify({ action: "publish" }) });
  const waitingBody = await json(waiting);
  check("publish waits only for the email", waiting.status === 409 && waitingBody.code === "waiting-for-email", `${waiting.status} ${waitingBody.code}`);

  await pg.query(`UPDATE "User" SET "emailVerified"=now() WHERE id=$1`, [userId]);
  const go = await call(jar, "/api/business/publish", { method: "POST", body: JSON.stringify({ action: "publish" }) });
  const goBody = await json(go);
  check("publish succeeds once the email is confirmed", go.status === 200 && goBody.published === true && goBody.removedTestBookings === 1, JSON.stringify(goBody));
  const leftTests = (await pg.query(`SELECT count(*)::int n FROM "Booking" WHERE "businessId"=$1`, [businessId])).rows[0].n;
  check("test bookings were deleted on publish", leftTests === 0);
  check("the page is public now", (await call(null, `/company/${slug}`)).status === 200);

  const un = await call(jar, "/api/business/publish", { method: "POST", body: JSON.stringify({ action: "unpublish" }) });
  check("unpublish hides it again", un.status === 200 && (await call(null, `/company/${slug}`)).status === 404);
  await call(jar, "/api/business/publish", { method: "POST", body: JSON.stringify({ action: "publish" }) });

  /* ── Import ────────────────────────────────────────────── */
  const csv = "الاسم,الموبايل,الإيميل\nأول,01011112221,\nتاني,01011112222,bad\nأول تاني,+20 10 1111 2221,\nتالت,٠١٠١١١١٢٢٢٣,\n";
  const pre = await json(await call(jar, "/api/business/import", { method: "POST", body: JSON.stringify({ kind: "CUSTOMERS", csv, mode: "preview" }) }));
  check("import preview: 2 ready, 1 error, 1 duplicate", pre.valid === 2 && pre.errors?.length === 1 && pre.duplicates?.length === 1, JSON.stringify({ v: pre.valid, e: pre.errors?.length, d: pre.duplicates?.length }));
  const before = (await pg.query(`SELECT count(*)::int n FROM "Customer" WHERE "businessId"=$1`, [businessId])).rows[0].n;
  check("the preview wrote nothing", before === 0);
  const commit = await call(jar, "/api/business/import", { method: "POST", body: JSON.stringify({ kind: "CUSTOMERS", csv, fileName: "qa.csv", mode: "commit" }) });
  const commitBody = await json(commit);
  check("commit writes the valid rows", commit.status === 201 && commitBody.batch?.rowCount === 2, `status ${commit.status}`);

  const rival = await webLogin("rival@qa.test", password);
  const steal = await call(rival, `/api/business/import/${commitBody.batch?.id}/rollback`, { method: "POST" });
  check("another business cannot roll it back (404)", steal.status === 404, `status ${steal.status}`);
  const anonRb = await call(null, `/api/business/import/${commitBody.batch?.id}/rollback`, { method: "POST" });
  check("anonymous rollback refused", anonRb.status === 401 || anonRb.status === 403, `status ${anonRb.status}`);
  const rb = await json(await call(jar, `/api/business/import/${commitBody.batch?.id}/rollback`, { method: "POST" }));
  const after = (await pg.query(`SELECT count(*)::int n FROM "Customer" WHERE "businessId"=$1`, [businessId])).rows[0].n;
  check("the owner rolls it back", rb.removed === 2 && after === 0, JSON.stringify(rb));

  /* ── Entitlements on the free plan ─────────────────────── */
  const ent = await json(await call(jar, "/api/business/entitlements"));
  check("entitlements: free plan, limits and upgrades", ent.effectivePlan === "FREE" && ent.limits?.monthlyBookings === 30 && ent.upgrades?.deposits === "PRO", JSON.stringify(ent.limits));
  const analytics = await call(jar, `/api/business/analytics?from=${day}&to=${day}`);
  check("free plan cannot read analytics data", analytics.status === 403, `status ${analytics.status}`);
  const deposit = await call(jar, "/api/business/settings/deposit", { method: "PATCH", body: JSON.stringify({ depositEnabled: true, depositPercent: 20 }) });
  check("free plan cannot switch deposits on", deposit.status === 403, `status ${deposit.status}`);
  const depositOff = await call(jar, "/api/business/settings/deposit", { method: "PATCH", body: JSON.stringify({ depositEnabled: false }) });
  check("switching deposits off is always allowed", depositOff.status === 200, `status ${depositOff.status}`);

  /* ── Pages ─────────────────────────────────────────────── */
  const demo = await call(null, "/demo");
  const demoHtml = await demo.text();
  check("demo renders, labelled, without signing in", demo.status === 200 && /نسخة تجريبية|Demo workspace/.test(demoHtml));
  const helpAr = await call(null, "/help/test-booking");
  const helpEn = await call(null, "/en/help/test-booking");
  check("help article in Arabic and English", helpAr.status === 200 && helpEn.status === 200 && /Test bookings/.test(await helpEn.text()), `${helpAr.status} ${helpEn.status}`);
  check("unknown help article is 404", (await call(null, "/help/nope")).status === 404);
  for (const p of ["/dashboard/setup", "/dashboard/import", "/dashboard"]) {
    const r = await call(jar, p);
    check(`${p} renders for the owner`, r.status === 200, `status ${r.status}`);
  }
  const anonSetup = await call(null, "/dashboard/setup");
  check("setup page needs a session", anonSetup.status >= 300 && anonSetup.status < 400, `status ${anonSetup.status}`);
} catch (e) {
  check("script ran to the end", false, String(e?.stack ?? e));
} finally {
  if (businessId) {
    await pg.query(`DELETE FROM "ImportBatch" WHERE "businessId"=$1`, [businessId]);
    await pg.query(`DELETE FROM "Booking" WHERE "businessId"=$1`, [businessId]);
    await pg.query(`DELETE FROM "Business" WHERE id=$1`, [businessId]);
  }
  if (userId) {
    await pg.query(`DELETE FROM "LifecycleEvent" WHERE "userId"=$1`, [userId]);
    await pg.query(`DELETE FROM "OnboardingDraft" WHERE "userId"=$1`, [userId]);
    await pg.query(`DELETE FROM "User" WHERE id=$1`, [userId]).catch((e) => console.log("user cleanup:", e.message));
  }
  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
