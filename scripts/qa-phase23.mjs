/**
 * Phase 23 end to end over HTTP, on a production build against the QA
 * database (scripts/qa-fixtures.mjs), with ACCESS_SANDBOX=1:
 *
 *   the directory QR still works (A) → a confirmed qa-salon booking shows
 *   its check-in QR with nothing but an opaque code in it → the owner
 *   verifies and checks the customer in, twice (idempotent) → a rival
 *   business, a signed-out caller and a forged code learn nothing → a
 *   venue with the sandbox provider: the holder asks for a pass, the
 *   cron issues it, a guest gets their own link, the guest limit holds →
 *   the sandbox gate admits at the right site and its signed callback is
 *   recorded once → cancelling withdraws everything → the security desk
 *   sees names and states, never phones or prices, and cannot change
 *   settings → every unauthorised call is refused.
 *
 * Local only; everything it creates is removed.
 *
 *   CRON_SECRET=p19-local-cron node scripts/qa-phase23.mjs [baseUrl] [--db url]
 */
import { createRequire } from "module";
import { randomBytes } from "crypto";
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const args = process.argv.slice(2);
const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const DB = args.includes("--db") ? args[args.indexOf("--db") + 1] : "postgresql://qa:qa@localhost:5450/maw3ed_qa";
const CRON = process.env.CRON_SECRET ?? "p19-local-cron";
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
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (v === "" || /max-age=0/i.test(line)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
}
async function login(email, password = "QaPassword123!") {
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
  return jar;
}
async function call(jar, path, init = {}) {
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
const json = async (res) => res.json().catch(() => ({}));
const cron = { Authorization: `Bearer ${CRON}` };
const sandbox = (body) => call(null, "/api/dev/access-sandbox", { method: "POST", body: JSON.stringify(body), headers: cron });
const runCron = () => call(null, "/api/cron/access", { headers: cron });

const tag = `qa23-${Date.now()}`;
const cleanup = { bookings: [], venues: [], users: [] };

/** Cairo wall clock now, as the bookings' frame (wall time written as UTC). */
function cairoWall() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
}
async function booking(slug, offsetMin) {
  const { rows: [b] } = await pg.query(`SELECT b.id, s.id AS "serviceId" FROM "Business" b JOIN "Service" s ON s."businessId" = b.id WHERE b.slug = $1 LIMIT 1`, [slug]);
  const start = new Date(Math.floor((cairoWall().getTime() + offsetMin * 60_000) / 60_000) * 60_000);
  const end = new Date(start.getTime() + 60 * 60_000);
  const hhmm = (d) => d.toISOString().slice(11, 16);
  const token = randomBytes(24).toString("base64url");
  const id = `${tag}-${Math.random().toString(36).slice(2, 10)}`;
  await pg.query(
    `INSERT INTO "Booking" (id, "businessId", "serviceId", "customerName", "customerPhone", date, "startTime", "endTime", "startsAt", "endsAt", status, "totalPrice", "accessToken", "updatedAt")
     VALUES ($1,$2,$3,'منى QA','01012345678',$4,$5,$6,$7,$8,'CONFIRMED',100,$9,NOW())`,
    // Wall-clock frame: written as literal timestamps, not through the driver's local-time conversion.
    [id, b.id, b.serviceId, `${start.toISOString().slice(0, 10)} 00:00:00`, hhmm(start), hhmm(end), start.toISOString().slice(0, 19).replace("T", " "), end.toISOString().slice(0, 19).replace("T", " "), token],
  );
  cleanup.bookings.push(id);
  return { id, token };
}

try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const owner = await login("owner@qa.test");
  const rival = await login("rival@qa.test");

  // ── A: the public directory QR is unchanged ──────────────────────────
  const dirQr = await call(owner, "/api/business/qr");
  const dirSvg = await dirQr.text();
  check("1/A: the public directory QR is served as SVG for the business page", dirQr.status === 200 && dirSvg.startsWith("<svg"));

  // ── B: the booking's check-in QR ─────────────────────────────────────
  const b1 = await booking("qa-salon", -5);
  const access = await json(await call(null, `/api/booking/${b1.token}/access`));
  const url = access.checkIn?.url ?? "";
  const code = url.split("/c/")[1] ?? "";
  check("2: a confirmed booking shows a check-in QR, ready now", access.checkIn?.display === "ready" && /<svg/.test(access.checkIn?.qrSvg ?? ""), JSON.stringify({ ...access.checkIn, qrSvg: !!access.checkIn?.qrSvg, error: access.error }));
  check("2: the QR holds our /c/ URL with an opaque 43-character code — no booking id, name or phone",
    /^http:\/\/localhost:3101\/c\/[A-Za-z0-9_-]{43}$/.test(url) && !url.includes(b1.id) && !url.includes("0101"));
  check("C≠B: visitor access is not offered at a business in no venue", access.visitorAccess?.offered === false);

  const anon = await call(null, "/api/business/check-in", { method: "POST", body: JSON.stringify({ code }) });
  check("4/20: signed out, the check-in API refuses", anon.status === 401 || anon.status === 404, `status ${anon.status}`);
  const rivalSees = await json(await call(rival, "/api/business/check-in", { method: "POST", body: JSON.stringify({ code: url }) }));
  check("4/12: another business scanning the code learns nothing", rivalSees.state === "not-found" && !rivalSees.booking);
  const rivalIn = await json(await call(rival, "/api/business/check-in", { method: "POST", body: JSON.stringify({ code, action: "check-in" }) }));
  check("4: …and cannot check it in", rivalIn.state === "not-found");
  const forged = await json(await call(owner, "/api/business/check-in", { method: "POST", body: JSON.stringify({ code: "Z".repeat(43) }) }));
  check("14: a forged code is unknown", forged.state === "not-found");

  const verify = await json(await call(owner, "/api/business/check-in", { method: "POST", body: JSON.stringify({ code: url }) }));
  check("3: the owner's scan shows the booking and allows check-in", verify.state === "valid" && verify.canCheckIn === true && verify.booking?.customerName === "منى QA");
  check("3: the scan shows no phone, price or link", !JSON.stringify(verify).includes("0101") && !("totalPrice" in (verify.booking ?? {})) && !JSON.stringify(verify).includes(b1.token));
  const ci = await json(await call(owner, "/api/business/check-in", { method: "POST", body: JSON.stringify({ code: url, action: "check-in" }) }));
  const { rows: [st] } = await pg.query(`SELECT status FROM "Booking" WHERE id = $1`, [b1.id]);
  check("3: checked in → the booking is ARRIVED", ci.state === "checked-in" && st.status === "ARRIVED");
  const again = await json(await call(owner, "/api/business/check-in", { method: "POST", body: JSON.stringify({ code: url, action: "check-in" }) }));
  const { rows: [audits] } = await pg.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "resourceId" = $1 AND action = 'booking.check_in'`, [b1.id]);
  check("15/25: a second check-in is reported as already done, audited once", again.state === "checked-in" && audits.n === 1);
  const after = await json(await call(null, `/api/booking/${b1.token}/access`));
  check("2: the customer's screen now says checked in", after.checkIn?.display === "checked-in" && !!after.checkIn?.checkedInAt);

  const landingAnon = await call(null, `/c/${code}`);
  const landingHtml = await landingAnon.text();
  check("2: the scanned URL, opened by anyone, shows no booking details", landingAnon.status === 200 && !landingHtml.includes("منى QA"));
  const landingOwner = await (await call(owner, `/c/${code}`)).text();
  check("3: the same URL opened by the business's own staff offers the check-in desk", landingOwner.includes("تسجيل وصول"));
  const desk = await call(owner, "/dashboard/check-in");
  check("B: the dashboard check-in page opens for the owner", desk.status === 200);

  // ── C/D: visitor passes through the sandbox provider ─────────────────
  const prov = await json(await sandbox({ action: "ensure-provider" }));
  await sandbox({ action: "mode", mode: "NORMAL" });
  check("D: the sandbox provider is available on this QA build", prov.provider?.kind === "SANDBOX");
  const { rows: [{ id: cityId }] } = await pg.query(`SELECT id FROM "City" LIMIT 1`);
  const { rows: [salon] } = await pg.query(`SELECT b.id, b."ownerId" FROM "Business" b WHERE b.slug = 'qa-salon'`);
  const venueId = `${tag}-venue`;
  const gateId = `${tag}-gate`;
  await pg.query(`INSERT INTO "Venue" (id, slug, "nameAr", "cityId", status, "isPublished", "accessEnabled", "accessProviderId", "accessSiteRef", "updatedAt")
    VALUES ($1, $1, 'مول QA', $2, 'ACTIVE', true, true, $3, 'SITE-QA23', NOW())`, [venueId, cityId, prov.provider.id]);
  cleanup.venues.push(venueId);
  await pg.query(`INSERT INTO "VenueGate" (id, "venueId", "nameAr", code) VALUES ($1, $2, 'بوابة 1', 'G1-QA23')`, [gateId, venueId]);
  await pg.query(`INSERT INTO "VenuePolicy" (id, "venueId", "visitorEligibility", "accessBeforeMinutes", "maxGuestsPerBooking", "allowedGateIds", "updatedAt") VALUES ($1, $2, 'BOOKING_REQUIRED', 120, 1, ARRAY[$3], NOW())`, [`${tag}-pol`, venueId, gateId]);
  await pg.query(`INSERT INTO "VenueMembership" (id, "venueId", "businessId", status, "requestedById", "updatedAt") VALUES ($1, $2, $3, 'APPROVED', $4, NOW())`, [`${tag}-mem`, venueId, salon.id, salon.ownerId]);
  // A security desk account (same QA password as the owner).
  const securityEmail = `${tag}-security@qa.test`;
  const { rows: [sec] } = await pg.query(`INSERT INTO "User" (id, email, name, password, "emailVerified", "updatedAt") SELECT $1, $2, 'أمن QA', password, NOW(), NOW() FROM "User" WHERE email = 'owner@qa.test' RETURNING id`, [`${tag}-sec`, securityEmail]);
  cleanup.users.push(sec.id);
  await pg.query(`INSERT INTO "VenueRole" (id, "userId", kind, "venueId") VALUES ($1, $2, 'VENUE_SECURITY', $3)`, [`${tag}-role`, sec.id, venueId]);

  const b2 = await booking("qa-salon", 90);
  const v0 = await json(await call(null, `/api/booking/${b2.token}/access`));
  check("5: a confirmed booking at a participating venue is eligible — but no pass exists until asked", v0.visitorAccess?.offered === true && v0.visitorAccess?.eligibility?.eligible === true && v0.visitorAccess?.holder === null);
  check("C: the customer screen says it is a sandbox, valid at no real gate", v0.visitorAccess?.sandbox === true);
  const req1 = await call(null, `/api/booking/${b2.token}/access/pass`, { method: "POST", body: JSON.stringify({ displayName: "منى QA" }) });
  const v1 = await json(await call(null, `/api/booking/${b2.token}/access`));
  check("C: asking for a pass leaves it pending until the provider confirms", req1.status === 200 && v1.visitorAccess?.holder?.state === "pending" && v1.visitorAccess?.holder?.pass === null);
  const cronRun = await runCron();
  const v2 = await json(await call(null, `/api/booking/${b2.token}/access`));
  const holderToken = v2.visitorAccess?.holder?.pass?.token;
  check("C/D: the cron runs the provider call; the pass is active with its own QR", cronRun.status === 200 && v2.visitorAccess?.holder?.state === "active" && /^SANDBOX-/.test(holderToken ?? "") && /<svg/.test(v2.visitorAccess?.holder?.qrSvg ?? ""));

  const g = await call(null, `/api/booking/${b2.token}/access/guests`, { method: "POST", body: JSON.stringify({ displayName: "علي QA" }) });
  const gj = await json(g);
  const g2 = await call(null, `/api/booking/${b2.token}/access/guests`, { method: "POST", body: JSON.stringify({ displayName: "زيادة" }) });
  check("10/11: a guest is added with their own link; the venue's limit (1) holds", g.status === 201 && /^[A-Za-z0-9_-]{20,}$/.test(gj.inviteToken ?? "") && g2.status === 409);
  await runCron();
  const gv = await json(await call(null, `/api/pass/${gj.inviteToken}`));
  check("10: the guest's link shows only the guest's own active pass", gv.pass?.displayName === "علي QA" && gv.pass?.state === "active" && gv.pass?.pass?.token !== holderToken && !JSON.stringify(gv).includes("منى"));
  const gp = await call(null, `/pass/${gj.inviteToken}`);
  check("10: the guest pass page renders", gp.status === 200 && (await gp.text()).includes("علي QA"));

  const wrongSite = await json(await sandbox({ action: "gate", token: holderToken, gate: "G1-QA23", site: "SITE-ELSEWHERE" }));
  check("12: the pass is refused at another venue's gate", wrongSite.granted === false && wrongSite.reason === "wrong-site");
  const gate = await json(await sandbox({ action: "gate", token: holderToken, gate: "G1-QA23", site: "SITE-QA23", deliver: false }));
  check("D: the sandbox gate admits the pass at its own site", gate.granted === true && !!gate.event, gate.reason);
  const hook = (h, raw) => call(null, "/api/access/providers/sandbox/events", { method: "POST", body: raw, headers: h });
  const first = await hook(gate.event.headers, gate.event.raw);
  const second = await hook(gate.event.headers, gate.event.raw);
  const fj = await json(first), sj = await json(second);
  check("16: the signed callback is accepted once; the retried delivery is a duplicate", first.status === 200 && fj.outcome === "accepted" && second.status === 200 && sj.outcome === "duplicate");
  const tampered = await hook(gate.event.headers, gate.event.raw.replace('"id":"', '"id":"x'));
  check("14/20: a tampered callback is refused", tampered.status === 401);
  const unsigned = await hook({ "content-type": "application/json" }, gate.event.raw);
  check("20: an unsigned callback is refused", unsigned.status === 401);

  // ── The venue's security desk ────────────────────────────────────────
  const security = await login(securityEmail);
  const deskRes = await call(security, `/api/venues/${venueId}/access`);
  const dj = await json(deskRes);
  const deskText = JSON.stringify(dj);
  check("25: the desk lists the visitors, their state and the gate entry", deskRes.status === 200 && dj.rows?.length === 2 && dj.events?.some((e) => e.kind === "ENTRY_GRANTED"));
  check("data minimisation: the desk sees no phone, price, reference or booking link", !deskText.includes("0101") && !deskText.includes("totalPrice") && !deskText.includes(b2.token) && !deskText.includes("serviceName"));
  check("least privilege: security may override, not switch passes on or pick a provider", dj.can?.override === true && dj.can?.enable === false && dj.can?.provider === false);
  const secPut = await call(security, `/api/venues/${venueId}/access`, { method: "PUT", body: JSON.stringify({ accessEnabled: false }) });
  check("20: security cannot change the venue's access settings", secPut.status === 404);
  const consoleRedirect = await call(security, `/venue-admin/${venueId}`);
  check("security opening the venue console is sent to the access desk", [302, 303, 307, 308].includes(consoleRedirect.status) || (await consoleRedirect.text()).includes("NEXT_REDIRECT"));
  const ownerDesk = await call(owner, `/api/venues/${venueId}/access`);
  check("20: a business owner has no venue authority — the desk is not found", ownerDesk.status === 404);
  const ownerOverride = await call(owner, `/api/venues/${venueId}/access/entitlements/${dj.rows?.[0]?.entitlementId}`, { method: "POST", body: JSON.stringify({ action: "suspend", note: "try" }) });
  check("20: …and cannot override the venue's security", ownerOverride.status === 404);
  const hold = await call(security, `/api/venues/${venueId}/access/entitlements/${dj.rows?.find((r) => r.role === "GUEST")?.entitlementId}`, { method: "POST", body: JSON.stringify({ action: "suspend", note: "QA hold" }) });
  check("25: security holds a guest's pass with a reason", hold.status === 200);

  // ── Cancelling withdraws everything ──────────────────────────────────
  const cancel = await call(owner, `/api/business/bookings/${b2.id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) });
  const vc = await json(await call(null, `/api/booking/${b2.token}/access`));
  check("7: cancelling withdraws the pass at once (no provider round-trip needed to stop showing it)",
    cancel.status === 200 && vc.visitorAccess?.holder?.pass === null && ["withdrawing", "revoked"].includes(vc.visitorAccess?.holder?.state));
  await runCron();
  const { rows: creds } = await pg.query(`SELECT c.status::text FROM "AccessCredential" c JOIN "AccessEntitlement" e ON e.id = c."entitlementId" WHERE e."bookingId" = $1`, [b2.id]);
  check("8: the provider acknowledges; every credential ends REVOKED", creds.length >= 2 && creds.every((c) => c.status === "REVOKED"), creds.map((c) => c.status).join(","));
  const gateAfter = await json(await sandbox({ action: "gate", token: holderToken, gate: "G1-QA23", site: "SITE-QA23" }));
  check("8: the gate refuses the withdrawn pass", gateAfter.granted === false);

  // ── Unauthorised and malformed requests ──────────────────────────────
  check("20: an unknown booking link is not found", (await call(null, "/api/booking/not-a-token/access")).status === 404);
  check("20: an unknown guest link is not found", (await call(null, "/api/pass/not-a-real-invite-token-xx")).status === 404);
  check("20: the sandbox controls need the secret", (await call(null, "/api/dev/access-sandbox", { method: "POST", body: JSON.stringify({ action: "confirm" }) })).status === 401);
  check("20: the access cron needs the secret", (await call(null, "/api/cron/access")).status === 401);
  check("20: an unknown provider's callback is not found", (await hook({ "content-type": "application/json" }, "{}").then(() => call(null, "/api/access/providers/nobody/events", { method: "POST", body: "{}" }))).status === 404);
  const rivalAccess = await call(rival, `/api/venues/${venueId}/access`);
  check("20: another business's owner cannot open the desk", rivalAccess.status === 404);

  // ── Regression: an ordinary booking with no venue is untouched ──────
  const b3 = await booking("qa-rival-salon", 200);
  const patch = await call(rival, `/api/business/bookings/${b3.id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) });
  const { rows: [{ n: noRows }] } = await pg.query(`SELECT count(*)::int AS n FROM "AccessEntitlement" WHERE "bookingId" = $1`, [b3.id]);
  check("26: a booking outside any venue moves exactly as before, with no access rows", patch.status === 200 && noRows === 0);
} catch (e) {
  check("script ran to completion", false, e instanceof Error ? e.stack : String(e));
} finally {
  await pg.query(`DELETE FROM "AuditLog" WHERE "resourceId" = ANY($1) OR "resourceId" = ANY($2)`, [cleanup.bookings, cleanup.venues]).catch(() => {});
  await pg.query(`DELETE FROM "Venue" WHERE id = ANY($1)`, [cleanup.venues]).catch((e) => console.error(e.message));
  const { rows: vis } = await pg.query(`SELECT "visitorId" FROM "BookingGuest" WHERE "bookingId" = ANY($1)`, [cleanup.bookings]).catch(() => ({ rows: [] }));
  await pg.query(`DELETE FROM "Booking" WHERE id = ANY($1)`, [cleanup.bookings]).catch((e) => console.error(e.message));
  await pg.query(`DELETE FROM "Visitor" WHERE id = ANY($1)`, [vis.map((v) => v.visitorId)]).catch(() => {});
  await pg.query(`DELETE FROM "SandboxAccessPass" WHERE "siteRef" = 'SITE-QA23'`).catch(() => {});
  await pg.query(`DELETE FROM "User" WHERE id = ANY($1)`, [cleanup.users]).catch((e) => console.error(e.message));
  await pg.query(`DELETE FROM "RateLimit"`).catch(() => {});
  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
