/**
 * Phase 22 end to end over HTTP, on a production build against the QA
 * database (scripts/qa-fixtures.mjs), with real browser sessions:
 *
 *   platform admin creates an operator, a compound and two venues
 *   (one standing in for a compound mall, one outside it) → grants a
 *   venue manager → the manager sees only their venue, edits details,
 *   hours, a floor, a gate, the visitor policy and a notice; cannot
 *   publish; cannot open the other venue → the venue is not public until
 *   the admin activates and publishes it → an owner asks for their
 *   business to be listed and cannot approve it → the manager approves
 *   it onto a floor → the public page (ar/en) lists it with a booking
 *   link, and the business page says where it is → counts only in the
 *   metrics → removal takes it off → existing URLs unaffected.
 *
 * The venue data is a labelled QA fixture. Local only; everything it
 * creates is removed.
 *
 *   node scripts/qa-phase22.mjs [baseUrl] [--db url]
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
async function login(email, password) {
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
const call = (jar, path, init = {}) =>
  fetch(`${B}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(jar ? { Cookie: jar.header() } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Origin: B,
      ...(init.headers ?? {}),
    },
  });
const send = (jar, path, method, body) => call(jar, path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async (r) => r.json().catch(() => ({}));

const stamp = Date.now();
const tag = `qa22-${stamp}`;
const PASSWORD = "QaPassword123!";
const created = { users: [], orgs: [], compounds: [], venues: [] };

try {
  const admin = await login("admin@qa.test", PASSWORD);
  const owner = await login("owner@qa.test", PASSWORD);

  // A manager account, signed up like anybody.
  const mgrEmail = `${tag}-mgr@example.test`;
  const su = await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify({ name: "QA Venue Manager", email: mgrEmail, password: PASSWORD }) });
  check("a manager account signs up normally", su.status === 201 || su.status === 200, `status ${su.status}`);
  const mgrId = (await pg.query(`SELECT id FROM "User" WHERE email=$1`, [mgrEmail])).rows[0]?.id;
  if (mgrId) created.users.push(mgrId);

  /* ── Platform admin builds the hierarchy ─────────────── */
  const { rows: [city] } = await pg.query(`SELECT id FROM "City" ORDER BY "nameAr" LIMIT 1`);
  const org = await json(await send(admin, "/api/admin/venue-organizations", "POST", { slug: `${tag}-org`, nameAr: "جهة تشغيل (بيانات اختبار)", nameEn: "Operator (QA fixture)" }));
  if (org.organization) created.orgs.push(org.organization.id);
  const cmp = await json(await send(admin, "/api/admin/compounds", "POST", { slug: `${tag}-cmp`, nameAr: "كمبوند (بيانات اختبار)", cityId: city.id, organizationId: org.organization?.id }));
  if (cmp.compound) created.compounds.push(cmp.compound.id);
  const vRes = await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-mall`, nameAr: "مول داخل كمبوند (بيانات اختبار)", nameEn: "Compound mall (QA fixture)", kind: "MALL", compoundId: cmp.compound?.id });
  const v1 = (await json(vRes)).venue;
  if (v1) created.venues.push(v1.id);
  const v2 = (await json(await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-park`, nameAr: "بيزنس بارك (بيانات اختبار)", kind: "BUSINESS_PARK", cityId: city.id, organizationId: org.organization?.id }))).venue;
  if (v2) created.venues.push(v2.id);
  check("admin creates an operator, a compound and two venues", !!org.organization && !!cmp.compound && !!v1 && !!v2);
  check("a new venue is a private draft that took the compound's city and operator", v1?.status === "DRAFT" && v1?.isPublished === false && v1?.cityId === city.id && v1?.organizationId === org.organization?.id);
  const dup = await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-mall`, nameAr: "مكرر", cityId: city.id });
  check("a taken venue slug is refused", dup.status === 409, `status ${dup.status}`);
  check("anybody else gets 404 from the admin venue API", (await send(owner, "/api/admin/venues", "POST", { slug: `${tag}-x`, nameAr: "x", cityId: city.id })).status === 404);

  const grant = await send(admin, "/api/admin/venue-roles", "POST", { email: mgrEmail, kind: "VENUE_MANAGER", venueId: v1.id });
  check("admin makes the account manager of the first venue", grant.status === 201, `status ${grant.status}`);
  const noAcct = await send(admin, "/api/admin/venue-roles", "POST", { email: `${tag}-nobody@example.test`, kind: "VENUE_MANAGER", venueId: v1.id });
  check("a role cannot be given to an account that does not exist", noAcct.status === 404);

  /* ── The manager's console ───────────────────────────── */
  const mgr = await login(mgrEmail, PASSWORD);
  const mine = await json(await call(mgr, "/api/venues"));
  check("the manager sees exactly their venue", mine.venues?.length === 1 && mine.venues[0].id === v1.id, JSON.stringify(mine.venues?.map((v) => v.slug)));
  check("the manager cannot open the other venue (404)", (await call(mgr, `/api/venues/${v2.id}`)).status === 404);
  check("the owner cannot open the venue console API (404)", (await call(owner, `/api/venues/${v1.id}`)).status === 404);
  check("anonymous gets 401", (await call(null, `/api/venues/${v1.id}`)).status === 401);

  const info = await send(mgr, `/api/venues/${v1.id}`, "PATCH", {
    info: { descriptionAr: "وصف تجريبي", descriptionEn: "Test description", latitude: 30.02, longitude: 31.49 },
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "10:00", closeTime: "23:00", isClosed: false })),
  });
  check("the manager edits details and opening hours", info.status === 200, `status ${info.status}`);
  const zone = (await json(await send(mgr, `/api/venues/${v1.id}/zones`, "POST", { kind: "FLOOR", nameAr: "الدور الأرضي", nameEn: "Ground floor", level: 0 }))).zone;
  const gate = (await json(await send(mgr, `/api/venues/${v1.id}/gates`, "POST", { nameAr: "البوابة الرئيسية", nameEn: "Main gate", kind: "PEDESTRIAN", code: "QA-GATE-CODE" }))).gate;
  check("the manager adds a floor and a gate", !!zone?.id && !!gate?.id);
  const cgate = await send(mgr, `/api/venues/${v1.id}/gates`, "POST", { nameAr: "بوابة الكمبوند", scope: "compound" });
  check("a venue manager cannot add a compound gate (404)", cgate.status === 404, `status ${cgate.status}`);
  const pol = await send(mgr, `/api/venues/${v1.id}/policy`, "PUT", {
    visitorEligibility: "BOOKING_REQUIRED", accessBeforeMinutes: 30, accessAfterMinutes: 15, maxGuestsPerBooking: 2,
    reentryAllowed: false, allowedGateIds: [gate.id], accessInstructionsAr: "ادخل من البوابة الرئيسية ومعاك رسالة الحجز.", accessInstructionsEn: "Enter by the main gate with your booking message.",
  });
  check("the manager sets the visitor policy", pol.status === 200, `status ${pol.status}`);
  const otherGatePol = await send(mgr, `/api/venues/${v1.id}/policy`, "PUT", {
    visitorEligibility: "OPEN", accessBeforeMinutes: 0, accessAfterMinutes: 0, maxGuestsPerBooking: 0, reentryAllowed: true, allowedGateIds: ["not-a-gate"], accessInstructionsAr: null, accessInstructionsEn: null,
  });
  check("a policy naming a gate from elsewhere is refused", otherGatePol.status === 422);
  const later = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const exc = await send(mgr, `/api/venues/${v1.id}/exceptions`, "POST", { kind: "SPECIAL_HOURS", startsOn: later, endsOn: later, openTime: "12:00", closeTime: "18:00", noteAr: "مواعيد عيد" });
  check("the manager publishes a dated notice", exc.status === 201, `status ${exc.status}`);
  const selfPublish = await send(mgr, `/api/admin/venues/${v1.id}`, "PATCH", { status: "ACTIVE", isPublished: true });
  check("the manager cannot publish their own venue (404)", selfPublish.status === 404);
  const selfGrant = await send(mgr, "/api/admin/venue-roles", "POST", { email: "owner@qa.test", kind: "VENUE_MANAGER", venueId: v1.id });
  check("the manager cannot appoint anybody (404)", selfGrant.status === 404);

  /* ── Public only once published ──────────────────────── */
  check("a draft venue has no public page", (await call(null, `/venues/${tag}-mall`)).status === 404);
  const pubBad = await send(admin, `/api/admin/venues/${v1.id}`, "PATCH", { isPublished: true });
  check("a draft cannot be published before it is activated", pubBad.status === 409);
  await send(admin, `/api/admin/venues/${v1.id}`, "PATCH", { status: "ACTIVE" });
  await send(admin, `/api/admin/venues/${v1.id}`, "PATCH", { isPublished: true });
  await send(admin, `/api/admin/venues/${v2.id}`, "PATCH", { status: "ACTIVE" });
  await send(admin, `/api/admin/venues/${v2.id}`, "PATCH", { isPublished: true });
  const emptyPage = await call(null, `/venues/${tag}-mall`);
  const emptyHtml = await emptyPage.text();
  check("the published venue renders, empty, and is not indexed yet", emptyPage.status === 200 && /noindex/.test(emptyHtml) && /لسه مفيش أماكن معروضة هنا/.test(emptyHtml));
  check("gate codes never reach the public page", !/QA-GATE-CODE/.test(emptyHtml));
  check("the access instructions and the no-pass notice show", /ادخل من البوابة الرئيسية/.test(emptyHtml) && /مش بيصدر تصاريح دخول/.test(emptyHtml));

  /* ── Tenancy ─────────────────────────────────────────── */
  const ownBiz = (await pg.query(`SELECT id, slug FROM "Business" WHERE slug='qa-salon'`)).rows[0];
  const reqRes = await send(owner, "/api/business/venues/memberships", "POST", { venueId: v1.id, unit: "G-07" });
  const membership = (await json(reqRes)).membership;
  check("the owner asks for their business to be listed", reqRes.status === 201 && membership?.status === "REQUESTED", `status ${reqRes.status}`);
  check("asking twice is refused", (await send(owner, "/api/business/venues/memberships", "POST", { venueId: v1.id })).status === 409);
  check("a pending request is not public", !/qa-salon/.test(await (await call(null, `/venues/${tag}-mall`)).text()));
  check("the owner cannot approve their own request (404)", (await send(owner, `/api/venues/${v1.id}/memberships/${membership.id}`, "PATCH", { decision: "approve" })).status === 404);

  // A second manager, of the other venue, cannot decide on this one.
  await send(admin, "/api/admin/venue-roles", "POST", { email: "rival@qa.test", kind: "VENUE_MANAGER", venueId: v2.id });
  const rival = await login("rival@qa.test", PASSWORD);
  check("the other venue's manager cannot decide on it (404)", (await send(rival, `/api/venues/${v1.id}/memberships/${membership.id}`, "PATCH", { decision: "approve" })).status === 404);
  check("…nor decide it through their own venue (404)", (await send(rival, `/api/venues/${v2.id}/memberships/${membership.id}`, "PATCH", { decision: "approve" })).status === 404);

  const ok = await send(mgr, `/api/venues/${v1.id}/memberships/${membership.id}`, "PATCH", { decision: "approve", zoneId: zone.id });
  check("the manager approves it onto a floor", ok.status === 200, `status ${ok.status}`);

  const arRes = await call(null, `/venues/${tag}-mall`);
  const ar = await arRes.text();
  check("the Arabic page lists the business with a booking link and its floor", arRes.status === 200 && ar.includes(`/company/${ownBiz.slug}`) && /الدور الأرضي/.test(ar));
  check("Arabic metadata: title, canonical, indexable now", /<title>[^<]*مول داخل كمبوند/.test(ar) && /rel="canonical"[^>]*\/venues\//.test(ar) && !/noindex/.test(ar));
  const en = await (await call(null, `/en/venues/${tag}-mall`)).text();
  check("English metadata and page", /<title>[^<]*Compound mall \(QA fixture\)/.test(en) && /Visitor and access information/.test(en) && /hreflang="ar"/i.test(en));
  check("the FAQ answers from the policy (booking needed, 2 guests)", /Up to 2 guest/.test(en) && /not an entry pass/.test(en));
  check("no claim of official authorisation anywhere on the page", !/Emaar|official partner|authori[sz]ed by/i.test(en + ar));
  const filtered = await (await call(null, `/venues/${tag}-mall?q=zzzz-nothing`)).text();
  check("the directory search filters", /مفيش نتايج للاختيار ده/.test(filtered));
  const company = await (await call(null, `/company/${ownBiz.slug}`)).text();
  check("the business page still works and says where it is", /موجود في/.test(company) && company.includes(`/venues/${tag}-mall`));
  check("the venues index lists it", (await (await call(null, "/venues")).text()).includes(`/venues/${tag}-mall`));
  const api = await json(await call(null, `/api/public/venues/${tag}-mall`));
  check("the public API returns the approved directory and no gate codes", api.venue?.directory?.length === 1 && !JSON.stringify(api).includes("QA-GATE-CODE"));
  check("the other venue lists nothing", (await json(await call(null, `/api/public/venues/${tag}-park`))).venue?.directory?.length === 0);

  const metrics = await json(await call(mgr, `/api/venues/${v1.id}/metrics`));
  check("venue metrics are counts only", typeof metrics.bookings?.total === "number" && metrics.tenants?.approved === 1 && !/customer|phone|price|name/i.test(JSON.stringify(metrics)), JSON.stringify(metrics));
  const memberList = await json(await call(mgr, `/api/venues/${v1.id}/memberships`));
  check("the manager's tenant list carries no customer data", memberList.memberships?.length === 1 && !/customer|phone|email|payment/i.test(JSON.stringify(memberList)));

  /* ── Pages ───────────────────────────────────────────── */
  check("the manager's console renders", [200, 307].includes((await call(mgr, "/venue-admin")).status) && (await call(mgr, `/venue-admin/${v1.id}`)).status === 200);
  check("the owner gets 404 from the venue console", (await call(owner, "/venue-admin")).status === 404);
  check("the admin venues page renders", (await call(admin, "/admin/venues")).status === 200);
  check("the owner's venue page renders", (await call(owner, "/dashboard/venue")).status === 200);

  /* ── Removal ─────────────────────────────────────────── */
  const rm = await send(mgr, `/api/venues/${v1.id}/memberships/${membership.id}`, "PATCH", { decision: "remove" });
  check("the manager removes the business", rm.status === 200);
  check("…and it leaves the public page", !(await (await call(null, `/venues/${tag}-mall`)).text()).includes(`/company/${ownBiz.slug}`));
  check("…and the business page no longer claims it", !(await (await call(null, `/company/${ownBiz.slug}`)).text()).includes(`/venues/${tag}-mall`));
  check("existing URLs unaffected", (await call(null, "/company/qa-rival-salon")).status === 200 && (await call(null, "/businesses")).status === 200);

  // Suspending takes it down.
  await send(admin, `/api/admin/venues/${v1.id}`, "PATCH", { status: "SUSPENDED" });
  check("a suspended venue disappears", (await call(null, `/venues/${tag}-mall`)).status === 404);
} catch (e) {
  check("script ran to the end", false, String(e?.stack ?? e));
} finally {
  if (created.venues.length) {
    await pg.query(`DELETE FROM "VenueRole" WHERE "venueId" = ANY($1)`, [created.venues]);
    await pg.query(`DELETE FROM "AuditLog" WHERE "resourceType"='Venue' AND "resourceId" = ANY($1)`, [created.venues]);
    await pg.query(`DELETE FROM "Venue" WHERE id = ANY($1)`, [created.venues]);
  }
  if (created.compounds.length) await pg.query(`DELETE FROM "Compound" WHERE id = ANY($1)`, [created.compounds]);
  if (created.orgs.length) await pg.query(`DELETE FROM "VenueOrganization" WHERE id = ANY($1)`, [created.orgs]);
  if (created.users.length) {
    await pg.query(`DELETE FROM "LifecycleEvent" WHERE "userId" = ANY($1)`, [created.users]);
    await pg.query(`DELETE FROM "User" WHERE id = ANY($1)`, [created.users]).catch((e) => console.log("user cleanup:", e.message));
  }
  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
