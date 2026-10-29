/**
 * Phase 20 security probes over HTTP, on a production build against the
 * QA database and its fixtures (scripts/qa-fixtures.mjs). Complements
 * scripts/qa-security.mjs (cross-tenant and role probes with bearer
 * tokens) with the things this phase added, exercised the way a browser
 * would reach them — a real NextAuth cookie session:
 *
 *   security headers on a page (CSP with a nonce, HSTS, nosniff, frame);
 *   a state-changing API call with the session cookie from another
 *   origin refused (403), the same call from the site allowed;
 *   an upload whose bytes are not the image it claims refused (415),
 *   an upload to a folder off the list refused (400);
 *   the account export: a JSON attachment of the caller's own data;
 *   "sign out everywhere" revokes the account's sessions (recorded on
 *   the row; web tokens expire on their next check);
 *   profile-view counting stops at its hourly cap;
 *   OTP guessing: a wrong code burns after five tries;
 *   a token-less GET of the admin API is 404, not 403.
 *
 * Local only.
 *
 *   node scripts/qa-phase20.mjs [baseUrl] [--db url]
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
const HOST = new URL(B).host;
const pg = new Client({ connectionString: DB });
await pg.connect();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

/** A cookie jar good enough for NextAuth's two cookies. */
class Jar {
  constructor() { this.cookies = new Map(); }
  take(res) {
    const set = res.headers.getSetCookie?.() ?? [];
    for (const line of set) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  has(name) { return [...this.cookies.keys()].some((k) => k === name || k === `__Secure-${name}`); }
}

/** Sign in through NextAuth's credentials provider, as the browser does. */
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

const cookieFetch = (jar, path, init = {}) =>
  fetch(`${B}${path}`, { ...init, headers: { Cookie: jar.header(), ...(init.headers ?? {}) } });

try {
  // Repeated runs within fifteen minutes would trip the per-email login
  // throttle (8 / 15 min), which is the limiter doing its job; the local
  // counters are cleared so the probes below measure what they target.
  await pg.query(`delete from "RateLimit" where key like 'login:%' or key like 'phoneOtp%' or key like 'accountExport:%'`);

  // ── Headers ─────────────────────────────────────────────────
  const home = await fetch(`${B}/`);
  const csp = home.headers.get("content-security-policy") ?? "";
  check("H1 page carries a nonce CSP, HSTS, nosniff, frame and referrer headers",
    /script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/.test(csp) && /object-src 'none'/.test(csp) && !/unsafe-eval/.test(csp)
      && !!home.headers.get("strict-transport-security") && home.headers.get("x-content-type-options") === "nosniff"
      && !!home.headers.get("x-frame-options") && !!home.headers.get("referrer-policy") && !home.headers.get("x-powered-by"),
    `csp ${csp.slice(0, 60)}…`);

  // ── A browser session ───────────────────────────────────────
  const jar = await webLogin("owner@qa.test", "QaPassword123!");
  check("S1 web sign-in with the fixture owner yields a session cookie", jar.has("authjs.session-token"), [...jar.cookies.keys()].join(","));
  const me = await cookieFetch(jar, "/api/business/overview");
  check("S2 the cookie authenticates an API read", me.status === 200, String(me.status));

  // ── CSRF ────────────────────────────────────────────────────
  const body = JSON.stringify({ sessionId: "does-not-exist" });
  const evil = await cookieFetch(jar, "/api/account/sessions", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body });
  const same = await cookieFetch(jar, "/api/account/sessions", { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body });
  const none = await cookieFetch(jar, "/api/account/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const nullO = await cookieFetch(jar, "/api/account/sessions", { method: "POST", headers: { "Content-Type": "application/json", Origin: "null" }, body });
  check("C1 a state-changing call with the session cookie from another origin is refused", evil.status === 403 && (await evil.json().catch(() => ({}))).code === "cross-site", String(evil.status));
  check("C2 the same call from the site itself, or with no Origin, goes through", same.status === 200 && none.status === 200, `${same.status}/${none.status}`);
  check("C3 an opaque 'null' origin is refused too", nullO.status === 403, String(nullO.status));
  const evilGet = await cookieFetch(jar, "/api/business/overview", { headers: { Origin: "https://evil.example" } });
  check("C4 reads are not affected (cookies are SameSite; the check is for mutations)", evilGet.status === 200, String(evilGet.status));
  const webhookEvil = await fetch(`${B}/api/webhooks/paymob`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example", Cookie: jar.header() }, body: "{}" });
  check("C5 the webhook (its own HMAC) is not behind the origin check", webhookEvil.status !== 403, String(webhookEvil.status));

  // ── Uploads ─────────────────────────────────────────────────
  const fakePng = new Blob([Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>")], { type: "image/png" });
  const fd1 = new FormData(); fd1.append("file", fakePng, "x.png"); fd1.append("folder", "maw3ed/businesses");
  const up1 = await cookieFetch(jar, "/api/upload/image", { method: "POST", body: fd1, headers: { Origin: B } });
  const up1b = await up1.json().catch(() => ({}));
  check("U1 an SVG labelled image/png is refused by its bytes", up1.status === 415 && up1b.code === "not-an-image", `${up1.status} ${up1b.code ?? ""}`);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const fd2 = new FormData(); fd2.append("file", new Blob([png], { type: "image/png" }), "x.png"); fd2.append("folder", "../../other-tenant");
  const up2 = await cookieFetch(jar, "/api/upload/image", { method: "POST", body: fd2, headers: { Origin: B } });
  check("U2 a folder off the list is refused", up2.status === 400, String(up2.status));
  const fd3 = new FormData(); fd3.append("file", new Blob([png], { type: "image/png" }), "x.png"); fd3.append("folder", "maw3ed/businesses");
  const up3 = await cookieFetch(jar, "/api/upload/image", { method: "POST", body: fd3, headers: { Origin: B } });
  check("U3 a real PNG header passes validation (the store itself is not configured locally)", up3.status !== 415 && up3.status !== 400, String(up3.status));
  const anon = await fetch(`${B}/api/upload/image`, { method: "POST", body: fd3 });
  check("U4 an upload without a session is 401", anon.status === 401, String(anon.status));

  // ── Export ──────────────────────────────────────────────────
  const cust = await webLogin("customer@qa.test", "QaPassword123!");
  const ex = await cookieFetch(cust, "/api/account/export");
  const exBody = await ex.json().catch(() => ({}));
  check("E1 the account export is a JSON attachment of the caller's own profile and bookings",
    ex.status === 200 && /attachment/.test(ex.headers.get("content-disposition") ?? "") && exBody.format === "maw3ed-account-export/1" && exBody.profile?.email === "customer@qa.test" && Array.isArray(exBody.bookings?.past),
    `${ex.status} ${exBody.format ?? ""} past ${exBody.bookings?.past?.length ?? "?"}`);
  const exAnon = await fetch(`${B}/api/account/export`);
  check("E2 the export needs a session", exAnon.status === 401, String(exAnon.status));

  // ── Sign out everywhere ─────────────────────────────────────
  const before = (await pg.query(`select "sessionsRevokedAt" from "User" where email='customer@qa.test'`)).rows[0]?.sessionsRevokedAt;
  const rev = await cookieFetch(cust, "/api/account/sessions", { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify({ everywhere: true }) });
  const revBody = await rev.json().catch(() => ({}));
  const after = (await pg.query(`select "sessionsRevokedAt" from "User" where email='customer@qa.test'`)).rows[0]?.sessionsRevokedAt;
  const audited = (await pg.query(`select count(*)::int as n from "AuditLog" where action='account.sessions_revoked' and "resourceId"=(select id from "User" where email='customer@qa.test') and at > now() - interval '1 minute'`)).rows[0].n;
  check("R1 'sign out everywhere' records the revocation and is audited", rev.status === 200 && after && (!before || after > before) && typeof revBody.webRevokedAt === "string" && audited === 1, `${rev.status} ended ${revBody.ended} audit ${audited}`);
  // A brand-new sign-in after the revocation is not caught by it.
  const cust2 = await webLogin("customer@qa.test", "QaPassword123!");
  const fresh = await cookieFetch(cust2, "/api/account/export");
  check("R2 a sign-in made after the revocation works", fresh.status === 200, String(fresh.status));

  // ── View counter cap ────────────────────────────────────────
  const ip = `10.20.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`; // fresh per run: the bucket lasts an hour
  const viewCount = async () => (await pg.query(`select coalesce(sum(count),0)::int as n from "ProfileView" where "businessId"=(select id from "Business" where slug='qa-listing-1') and day=current_date`)).rows[0].n;
  const v0 = await viewCount();
  for (let i = 0; i < 70; i++) {
    await fetch(`${B}/api/public/qa-listing-1/view`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ source: "DIRECT" }) });
  }
  const v1 = await viewCount();
  check("V1 profile views from one address stop counting at the hourly cap (60)", v1 - v0 <= 60 && v1 - v0 >= 50, `+${v1 - v0} of 70`);

  // ── OTP guessing ────────────────────────────────────────────
  const phone = "201000009999";
  await pg.query(`delete from "LoginCode" where phone=$1`, [phone]);
  await pg.query(`insert into "LoginCode" (id, phone, "codeHash", "expiresAt", attempts, "createdAt", "lastSentAt") values ('p20-otp', $1, 'ffff', now() + interval '10 minutes', 0, now(), now())`, [phone]);
  const codes = [];
  for (let i = 0; i < 7; i++) {
    const r = await fetch(`${B}/api/auth/mobile/otp`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `10.21.0.${i + 1}` }, body: JSON.stringify({ phone, code: String(100000 + i) }) });
    codes.push(r.status);
  }
  const left = (await pg.query(`select count(*)::int as n from "LoginCode" where phone=$1`, [phone])).rows[0].n;
  check("O1 seven wrong guesses are all refused and the code is burned after five", codes.every((s) => s === 401) && left === 0, `${codes.join(",")} rows left ${left}`);

  // ── Admin API discoverability ───────────────────────────────
  const adminAnon = await fetch(`${B}/api/admin/overview`);
  const adminOwner = await cookieFetch(jar, "/api/admin/overview");
  check("A1 the admin API answers 404 to anonymous and to a non-admin owner", adminAnon.status === 404 && adminOwner.status === 404, `${adminAnon.status}/${adminOwner.status}`);
} catch (e) {
  check("script ran to the end", false, e instanceof Error ? e.stack ?? e.message : String(e));
} finally {
  await pg.query(`delete from "LoginCode" where phone='201000009999'`).catch(() => {});
  await pg.query(`delete from "AuditLog" where action='account.sessions_revoked' and "resourceId"=(select id from "User" where email='customer@qa.test')`).catch(() => {});
  await pg.query(`update "User" set "sessionsRevokedAt"=null where email='customer@qa.test'`).catch(() => {});
  await pg.query(`delete from "ProfileView" where "businessId"=(select id from "Business" where slug='qa-listing-1') and day=current_date`).catch(() => {});
  await pg.end();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
