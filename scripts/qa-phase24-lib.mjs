/**
 * Shared by the Phase 24 QA scripts: HTTP sessions, and a fictional
 * world built the way real people would build it — accounts sign up,
 * businesses go through onboarding and publish, organizations register
 * and are approved, venues are created by the platform — all through the
 * product's own APIs against a production build on the QA database.
 *
 * Every name is clearly fictional test data. Nothing here represents a
 * real operator (docs/eterna/PILOT_PLAN.md).
 *
 * Local only. Everything created is tagged and removed by teardown().
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const args = process.argv.slice(2);
export const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
export const DB = args.includes("--db") ? args[args.indexOf("--db") + 1] : "postgresql://qa:qa@localhost:5450/maw3ed_qa";
export const CRON = process.env.CRON_SECRET ?? "p19-local-cron";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB) || !/^http:\/\/localhost[:/]/.test(B)) {
  console.error("Local only.");
  process.exit(1);
}
export const PASSWORD = "QaPassword123!";
export const pg = new Client({ connectionString: DB });
await pg.connect();

/** The server's AUTH_SECRET (next start reads .env.production.local), for minting app tokens. Never printed. */
export function authSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  try {
    const line = readFileSync(".env.production.local", "utf8").split(/\r?\n/).find((l) => l.startsWith("AUTH_SECRET="));
    return line ? line.slice("AUTH_SECRET=".length).replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

export const results = [];
let section = "";
export function part(name) {
  section = name;
  console.log(`\n── ${name}`);
}
export function check(name, ok, detail = "") {
  results.push({ section, name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? "  — " + detail : ""}`);
  return !!ok;
}
export function notRun(name, why) {
  results.push({ section, name, ok: true, skipped: why });
  console.log(`NOT RUN  ${name}  — ${why}`);
}

export class Jar {
  constructor() { this.cookies = new Map(); }
  take(res) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (v === "" || /max-age=0/i.test(line)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
}

export async function login(email, password = PASSWORD) {
  const jar = new Jar();
  const c = await fetch(`${B}/api/auth/csrf`);
  jar.take(c);
  const { csrfToken } = await c.json();
  const r = await fetch(`${B}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.header(), Origin: B },
    body: new URLSearchParams({ csrfToken, email, password, redirect: "false" }),
  });
  jar.take(r);
  jar.email = email;
  return jar;
}
export async function call(jar, path, init = {}) {
  const res = await fetch(`${B}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(jar ? { Cookie: jar.header() } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Origin: B,
      ...(init.headers ?? {}),
    },
  });
  if (jar) jar.take(res);
  return res;
}
export const send = (jar, path, method, body) => call(jar, path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
export const json = async (r) => r.json().catch(() => ({}));
export const cronHeaders = { Authorization: `Bearer ${CRON}` };
export const sandbox = (body) => call(null, "/api/dev/access-sandbox", { method: "POST", body: JSON.stringify(body), headers: cronHeaders });
export const runAccessCron = () => call(null, "/api/cron/access", { headers: cronHeaders });

/* ── The world's registry, for teardown ─────────────────────────── */

export const tag = `qa24-${Date.now()}`;
export const made = { users: [], businesses: [], orgs: [], venues: [], sites: [] };

const ids = {};
export async function idOf(table, slug) {
  const key = `${table}:${slug}`;
  if (!ids[key]) ids[key] = (await pg.query(`SELECT id FROM "${table}" WHERE slug = $1`, [slug])).rows[0]?.id;
  return ids[key];
}

/** A new verified account (email confirmation is the one step done in the database: there is no inbox). */
export async function account(n, name) {
  const email = `${tag}-${n}@example.test`;
  // One machine signs up dozens of people in a minute; the per-IP limit
  // is real and tested elsewhere (qa-security), so it is cleared here.
  await pg.query(`DELETE FROM "RateLimit"`);
  const r = await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify({ name, email, password: PASSWORD }) });
  const { rows: [u] } = await pg.query(`UPDATE "User" SET "emailVerified" = now() WHERE email = $1 RETURNING id`, [email]);
  if (!u) throw new Error(`signup failed for ${n}: ${r.status} ${await r.text()}`);
  made.users.push(u.id);
  const jar = await login(email);
  jar.userId = u.id;
  return jar;
}

/**
 * A customer with an account. Their phone is the one their bookings
 * carry, which is how a booking finds its customer's account; proving
 * the phone (an SMS code) is the one step done in the database.
 */
export async function customer(n, name) {
  const jar = await account(`cust-${n}`, name);
  const local = `010${String(Date.now()).slice(-8)}`;
  await pg.query(`UPDATE "User" SET phone = $2 WHERE id = $1`, [jar.userId, `20${local.slice(1)}`]);
  jar.phone = local;
  return jar;
}

const ALL_DAY = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "00:00", closeTime: "23:59", isClosed: false }));

/**
 * A business owner signs up, completes onboarding and publishes. Open
 * around the clock so a journey can book "now" at any hour of a test run.
 */
export async function business(n, { nameAr, nameEn, category, services, autoConfirm = true, orgInvite, plan } = {}) {
  const owner = await account(`owner-${n}`, `${nameEn} owner (test)`);
  const categoryId = await idOf("Category", category);
  const cityId = await idOf("City", "new-cairo");
  const slug = `${tag}-${n}`.slice(0, 50);
  const res = await send(owner, "/api/onboarding", "POST", {
    nameAr, nameEn, categoryId, cityId, phone: "0221234567", address: "عنوان تجريبي — بيانات اختبار",
    about: "نشاط وهمي لاختبار المنصة. Fictional business for platform testing.",
    services, availability: ALL_DAY, slug, ...(orgInvite ? { orgInvite } : {}),
  });
  const body = await json(res);
  if (res.status !== 200 && res.status !== 201) throw new Error(`onboarding ${n}: ${res.status} ${JSON.stringify(body)}`);
  const id = (await pg.query(`SELECT id FROM "Business" WHERE slug = $1`, [slug])).rows[0].id;
  made.businesses.push(id);
  // The session names the business it was signed in with; a new business
  // is picked up on the next sign-in, as after the onboarding wizard.
  const fresh = await login(owner.email);
  owner.cookies = fresh.cookies;
  const pol = await send(owner, "/api/business/settings/booking", "PATCH", { reviewed: true, autoConfirm, minNoticeMinutes: 0, maxAdvanceDays: 60 });
  if (pol.status !== 200) throw new Error(`booking settings ${n}: ${pol.status} ${JSON.stringify(await json(pol)).slice(0, 200)}`);
  const pub = await json(await send(owner, "/api/business/publish", "POST", { action: "publish" }));
  if (!pub.published && !pub.data?.published) throw new Error(`publish ${n}: ${JSON.stringify(pub)}`);
  // A paid plan where the test needs paid features (staff, branches).
  // Subscribing goes through Paymob, which is not what these tests are about.
  if (plan) await pg.query(`UPDATE "Business" SET plan = $2, "subscriptionStatus" = 'ACTIVE' WHERE id = $1`, [id, plan]);
  const svc = (await pg.query(`SELECT id, "nameAr", price FROM "Service" WHERE "businessId" = $1 ORDER BY "sortOrder"`, [id])).rows;
  return { owner, id, slug, nameAr, nameEn, services: svc };
}

/** An organization registered by its founder and approved by the platform, page published. */
export async function organization(founder, admin, { slug, kind, nameAr, nameEn, descriptionAr, descriptionEn }) {
  const res = await send(founder, "/api/organizations", "POST", { slug: `${tag}-${slug}`.slice(0, 50), kind, nameAr, nameEn });
  const org = (await json(res)).organization;
  if (res.status !== 201) throw new Error(`organization ${slug}: ${res.status}`);
  made.orgs.push(org.id);
  await send(admin, `/api/admin/organizations/${org.id}`, "PATCH", { status: "APPROVED" });
  if (descriptionAr) await send(founder, `/api/organizations/${org.id}`, "PATCH", { profile: { descriptionAr, descriptionEn, phone: "0221234567" } });
  await send(founder, `/api/organizations/${org.id}`, "PATCH", { isPublished: true });
  return org;
}

/** The organization invites; the business owner answers with what they grant. */
export async function associate(orgJar, orgId, biz, relation, { ask = [], grant = ask, section = null, branchId = null } = {}) {
  const inv = await send(orgJar, `/api/organizations/${orgId}/businesses`, "POST", { businessSlug: biz.slug, relation, requestedScopes: ask, ...(branchId ? { branchId } : {}) });
  const assoc = (await json(inv)).association;
  if (inv.status !== 201) throw new Error(`invite ${biz.slug} as ${relation}: ${inv.status}`);
  const acc = await send(biz.owner, `/api/business/organizations/${assoc.id}`, "PATCH", { action: "accept", scopes: grant });
  if (acc.status !== 200) throw new Error(`accept ${biz.slug}: ${acc.status} ${JSON.stringify(await json(acc))}`);
  if (section) await send(orgJar, `/api/organizations/${orgId}/businesses/${assoc.id}`, "PATCH", { action: "organize", section });
  return assoc.id;
}

/* ── Time and booking ───────────────────────────────────────────── */

/** Cairo's calendar date and wall time now. */
export function cairoNow(offsetMin = 0) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(Date.now() + offsetMin * 60_000)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** The first bookable slot at or after `fromMin` minutes from now (today or tomorrow). */
export async function slotNear(biz, serviceId, fromMin = 0) {
  for (const extraDay of [0, 1]) {
    const { date, time } = cairoNow(fromMin + extraDay * 1440);
    const r = await json(await call(null, `/api/public/${biz.slug}/slots?serviceId=${serviceId}&date=${date}`));
    const slots = (r.slots ?? []).map((s) => (typeof s === "string" ? s : s.time ?? s.startTime)).filter(Boolean);
    const pick = extraDay ? slots[0] : slots.find((s) => s >= time);
    if (pick) return { date, startTime: pick };
  }
  return null;
}

/**
 * Moves a booking `minutes` along the clock — date, wall times and
 * instants together — to stand in for time passing (an appointment that
 * has started, ended hours ago, or was yesterday).
 */
export async function shiftBooking(id, minutes) {
  await pg.query(
    `UPDATE "Booking" SET
       "startsAt" = "startsAt" + make_interval(mins => $2),
       "endsAt" = "endsAt" + make_interval(mins => $2),
       "startTime" = to_char("startsAt" + make_interval(mins => $2), 'HH24:MI'),
       "endTime" = to_char("endsAt" + make_interval(mins => $2), 'HH24:MI'),
       date = date_trunc('day', "startsAt" + make_interval(mins => $2))
     WHERE id = $1`,
    [id, minutes],
  );
}

/** Minutes from now (Cairo wall clock) to a booking's start. */
export async function minutesUntil(id) {
  const { rows: [r] } = await pg.query(`SELECT to_char("startsAt", 'YYYY-MM-DD"T"HH24:MI') AS s FROM "Booking" WHERE id = $1`, [id]);
  const now = cairoNow();
  return Math.round((Date.parse(`${r.s}:00Z`) - Date.parse(`${now.date}T${now.time}:00Z`)) / 60_000);
}

let phoneSeq = 0;
/** A customer books on the public page, as the booking page does. */
export async function book(biz, { serviceId, slot, name = "عميل تجريبي", org, partySize, idempotencyKey, as } = {}) {
  phoneSeq += 1;
  const phone = as?.phone ?? `0102${String(Date.now()).slice(-4)}${String(phoneSeq).padStart(3, "0")}`;
  const res = await send(as ?? null, `/api/public/${biz.slug}/bookings`, "POST", {
    serviceId: serviceId ?? biz.services[0].id, date: slot.date, startTime: slot.startTime,
    customerName: name, customerPhone: phone, ...(org ? { org } : {}), ...(partySize ? { partySize } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
  const body = await json(res);
  return { status: res.status, booking: body.booking, body, phone };
}

/* ── Teardown ───────────────────────────────────────────────────── */

export async function teardown() {
  const q = (sql, p) => pg.query(sql, p).catch((e) => console.error("teardown:", e.message.slice(0, 160)));
  const biz = made.businesses;
  await q(`DELETE FROM "AuditLog" WHERE "resourceId" = ANY($1) OR "resourceId" = ANY($2) OR "resourceId" = ANY($3) OR "resourceId" IN (SELECT id FROM "Booking" WHERE "businessId" = ANY($1))`, [biz, made.orgs, made.venues]);
  await q(`DELETE FROM "Venue" WHERE id = ANY($1)`, [made.venues]);
  await q(`UPDATE "VenueOrganization" SET "parentId" = NULL WHERE id = ANY($1)`, [made.orgs]);
  await q(`DELETE FROM "VenueOrganization" WHERE id = ANY($1)`, [made.orgs]);
  const { rows: vis } = await pg.query(`SELECT "visitorId" FROM "BookingGuest" g JOIN "Booking" b ON b.id = g."bookingId" WHERE b."businessId" = ANY($1)`, [biz]).catch(() => ({ rows: [] }));
  await q(`DELETE FROM "Payment" WHERE "bookingId" IN (SELECT id FROM "Booking" WHERE "businessId" = ANY($1))`, [biz]);
  await q(`DELETE FROM "Review" WHERE "businessId" = ANY($1)`, [biz]);
  await q(`DELETE FROM "Booking" WHERE "businessId" = ANY($1)`, [biz]);
  await q(`DELETE FROM "Visitor" WHERE id = ANY($1)`, [vis.map((v) => v.visitorId)]);
  await q(`DELETE FROM "Customer" WHERE "businessId" = ANY($1)`, [biz]);
  await q(`DELETE FROM "LifecycleEvent" WHERE "userId" = ANY($1)`, [made.users]);
  await q(`DELETE FROM "Business" WHERE id = ANY($1)`, [biz]);
  await q(`DELETE FROM "SandboxAccessPass" WHERE "siteRef" = ANY($1)`, [made.sites]);
  await q(`DELETE FROM "User" WHERE id = ANY($1)`, [made.users]);
  await q(`DELETE FROM "RateLimit"`);
}

export function summary(file) {
  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`\n${results.length - failed.length - skipped.length}/${results.length - skipped.length} passed${skipped.length ? `, ${skipped.length} not run` : ""}`);
  if (failed.length) for (const f of failed) console.log(`  FAILED [${f.section}] ${f.name}`);
  if (file) {
    const bySection = {};
    for (const r of results) {
      bySection[r.section] ??= { passed: 0, failed: 0, notRun: 0 };
      bySection[r.section][r.skipped ? "notRun" : r.ok ? "passed" : "failed"] += 1;
    }
    console.log(JSON.stringify(bySection));
  }
  return failed.length;
}
