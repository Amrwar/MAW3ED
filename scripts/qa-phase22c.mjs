/**
 * Phase 22 final end to end — relationship types and delegated
 * management — over HTTP and in a real browser, on a production build
 * against the QA database (scripts/qa-fixtures.mjs):
 *
 *   a founder registers a RESTAURANT_GROUP and a MALL → the platform
 *   approves both → rival@qa.test (who owns a business of their own) is
 *   made a manager of the group → the group invites qa-salon as OWNED,
 *   asking for reservations, services and finance → the salon's owner
 *   accepts granting reservations only → the manager starts operating
 *   qa-salon: bookings yes; services, customers, profile, settings,
 *   billing, sign-in access no; their own business's owner routes refuse
 *   while acting → the owner grants services → services open → the owner
 *   withdraws everything → access ends on the next request → exit → own
 *   business back. The mall hosts the salon and can never operate it;
 *   managed finance and a second owner are refused; a hierarchy cycle is
 *   refused; directories list owned and hosted; everything is audited.
 *
 * Local only; everything it creates is removed.
 *
 *   node scripts/qa-phase22c.mjs [baseUrl] [--db url]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const { chromium } = require("playwright");
const { SignJWT } = await import("jose");
// A staff member's mobile bearer token, minted with the server's secret
// (checks needing it report NOT RUN without AUTH_SECRET).
const SECRET = process.env.AUTH_SECRET ? new TextEncoder().encode(process.env.AUTH_SECRET) : null;
const bearer = (userId, businessId) =>
  new SignJWT({ businessId, adminRole: null }).setProtectedHeader({ alg: "HS256" }).setSubject(userId)
    .setIssuer("maw3ed").setAudience("maw3ed-mobile-access").setIssuedAt().setExpirationTime("30m").sign(SECRET);

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
const send = (jar, path, method, body) => call(jar, path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async (r) => r.json().catch(() => ({}));

const tag = `qa22c-${Date.now()}`;
const PASSWORD = "QaPassword123!";
const created = { users: [], orgs: [], services: [], staff: [] };

try {
  const admin = await login("admin@qa.test");
  const owner = await login("owner@qa.test");
  const rival = await login("rival@qa.test");
  const salon = (await pg.query(`SELECT id, slug FROM "Business" WHERE slug='qa-salon'`)).rows[0];
  const rivalSalon = (await pg.query(`SELECT id, slug, "nameAr" FROM "Business" WHERE slug='qa-rival-salon'`)).rows[0];

  /* ── A founder registers a restaurant group and a mall; the platform approves ── */
  const email = `${tag}-founder@example.test`;
  await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify({ name: "QA Founder", email, password: PASSWORD }) });
  const founderId = (await pg.query(`SELECT id FROM "User" WHERE email=$1`, [email])).rows[0]?.id;
  created.users.push(founderId);
  await pg.query(`UPDATE "User" SET "emailVerified"=now() WHERE id=$1`, [founderId]);
  const founder = await login(email);
  const groupRes = await send(founder, "/api/organizations", "POST", { slug: `${tag}-grp`, kind: "RESTAURANT_GROUP", nameAr: "مجموعة مطاعم (بيانات اختبار)", nameEn: "Restaurant group (QA)" });
  const group = (await json(groupRes)).organization;
  const mallRes = await send(founder, "/api/organizations", "POST", { slug: `${tag}-mall`, kind: "MALL", nameAr: "مول (بيانات اختبار)" });
  const mall = (await json(mallRes)).organization;
  created.orgs.push(group?.id, mall?.id);
  check("1: a RESTAURANT_GROUP and a MALL register", groupRes.status === 201 && mallRes.status === 201, `${groupRes.status}/${mallRes.status}`);
  for (const o of [group, mall]) await send(admin, `/api/admin/organizations/${o.id}`, "PATCH", { status: "APPROVED" });
  for (const o of [group, mall]) await send(founder, `/api/organizations/${o.id}`, "PATCH", { isPublished: true });
  check("the group appoints rival@qa.test as manager", (await send(founder, `/api/organizations/${group.id}/members`, "POST", { email: "rival@qa.test" })).status === 201);

  /* ── 2: owned, granted only what the owner chose ── */
  const inv = await send(founder, `/api/organizations/${group.id}/businesses`, "POST", { businessSlug: salon.slug, relation: "OWNED", requestedScopes: ["RESERVATIONS", "SERVICES", "FINANCE"] });
  const ownedId = (await json(inv)).association?.id;
  check("2: the group invites qa-salon as OWNED, asking for reservations, services and finance", inv.status === 201, `status ${inv.status}`);
  const seen = (await json(await call(owner, "/api/business/organizations"))).associations?.find((a) => a.id === ownedId);
  check("…the salon's owner sees what was asked", JSON.stringify(seen?.requestedScopes) === JSON.stringify(["RESERVATIONS", "SERVICES", "FINANCE"]) && seen?.relation === "OWNED");
  const accept = await send(owner, `/api/business/organizations/${ownedId}`, "PATCH", { action: "accept", scopes: ["RESERVATIONS"] });
  check("…and accepts granting reservations only", accept.status === 200 && (await pg.query(`SELECT scopes::text[] AS scopes FROM "OrganizationBusiness" WHERE id=$1`, [ownedId])).rows[0].scopes.join() === "RESERVATIONS", `status ${accept.status}`);

  /* ── 4: the manager operates within the grant ── */
  rival.cookies.delete("maw3ed-acting");
  const operable = (await json(await call(rival, "/api/organizations/operable"))).businesses ?? [];
  check("the manager's portfolio lists qa-salon with exactly the grant", operable.some((b) => b.business.slug === salon.slug && b.scopes.join() === "RESERVATIONS"), JSON.stringify(operable.map((b) => b.scopes)));
  const start = await send(rival, "/api/organizations/acting", "POST", { businessId: salon.id });
  check("starting to manage sets the acting context", start.status === 200 && rival.cookies.get("maw3ed-acting") === salon.id, `status ${start.status}`);

  const bookings = await json(await call(rival, "/api/business/bookings?limit=50"));
  const bookingIds = (bookings.bookings ?? bookings.data ?? []).map((b) => b.id);
  const owners = bookingIds.length ? (await pg.query(`SELECT DISTINCT "businessId" FROM "Booking" WHERE id = ANY($1)`, [bookingIds])).rows.map((r) => r.businessId) : [];
  check("RESERVATIONS: the delegate reads qa-salon's bookings — and only qa-salon's", owners.length === 1 && owners[0] === salon.id, JSON.stringify(owners));
  check("…sees services to book with", (await call(rival, "/api/business/services")).status === 200);
  check("10: …cannot edit services without SERVICES (403)", (await send(rival, "/api/business/services", "POST", { nameAr: "خدمة مفوّضة", duration: 30, price: 100 })).status === 403);
  check("…cannot read the customer book without CUSTOMERS (403)", (await call(rival, "/api/business/customers")).status === 403);
  check("…cannot touch the profile without PROFILE (403)", (await send(rival, "/api/business", "PUT", { nameAr: "اسم مزيف" })).status === 403);
  const anyStaff = (await pg.query(`SELECT id FROM "StaffMember" WHERE "businessId"=$1 LIMIT 1`, [salon.id])).rows[0]?.id;
  if (anyStaff) check("10: …never who may sign in (staff access is the owner's: 403)", (await send(rival, `/api/business/staff/${anyStaff}/access`, "PUT", { access: "MANAGER", loginPhone: "01099999999" })).status === 403);
  const ownRoute = await call(rival, "/api/business/settings/booking");
  check("11: while acting, the delegate's OWN business's owner routes refuse (409 acting-elsewhere)", ownRoute.status === 409 && (await json(ownRoute)).code === "acting-elsewhere", `status ${ownRoute.status}`);
  check("…billing and subscription likewise", (await send(rival, "/api/business/subscription/upgrade", "POST", { plan: "PRO" })).status === 409);

  /* ── Pages while acting ── */
  const home = await call(rival, "/dashboard");
  const homeHtml = await home.text();
  check("the dashboard says whose business, for whom", home.status === 200 && /بتدير|Managing/.test(homeHtml) && homeHtml.includes("مجموعة مطاعم") && !homeHtml.includes(rivalSalon.nameAr), `status ${home.status}`);
  check("…the bookings page opens", (await call(rival, "/dashboard/bookings")).status === 200);

  // Rescheduling (a journey nothing else exercised). qa-salon takes
  // deposits, so a public booking waits for payment and is rightly not
  // movable; the owner keys one in instead (confirmed, no deposit) — with
  // no acting cookie, so it lands on the owner's own business.
  const bookSvcId = (await pg.query(`SELECT id FROM "Service" WHERE "businessId"=$1 AND "isAvailable" ORDER BY "sortOrder" LIMIT 1`, [salon.id])).rows[0].id;
  const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const ownSlots = await json(await call(null, `/api/public/${salon.slug}/slots?serviceId=${bookSvcId}&date=${day(6)}`));
  const booked = await send(owner, "/api/business/bookings", "POST", { serviceId: bookSvcId, date: day(6), startTime: ownSlots.slots?.[0], customerName: `${tag} زبون`, customerPhone: "01019444001" });
  const bookedBody = await json(booked);
  const bookingRow = { id: bookedBody.id ?? bookedBody.booking?.id };
  created.bookings = [bookingRow.id].filter(Boolean);
  const moveSlots = await json(await call(rival, `/api/business/bookings/${bookingRow.id}/reschedule?date=${day(7)}`));
  const moved = await send(rival, `/api/business/bookings/${bookingRow.id}/reschedule`, "POST", { date: day(7), startTime: moveSlots.slots?.[0] });
  const afterMove = (await pg.query(`SELECT "businessId", to_char(date,'YYYY-MM-DD') AS d, "startTime" FROM "Booking" WHERE id=$1`, [bookingRow.id])).rows[0];
  check(
    "a delegate with RESERVATIONS reschedules a booking, which stays the business's",
    booked.status === 201 && moved.status === 200 && afterMove.d === day(7) && afterMove.startTime === moveSlots.slots?.[0] && afterMove.businessId === salon.id,
    `${booked.status}/${moved.status} ${JSON.stringify(afterMove)}`,
  );
  const billing = await call(rival, "/dashboard/billing");
  check("…owner pages are not reachable (billing → /dashboard)", billing.status === 307 && /\/dashboard$/.test(billing.headers.get("location") ?? ""), `${billing.status} ${billing.headers.get("location")}`);
  // The dashboard has a loading boundary, so a page's own redirect arrives
  // after streaming starts: a 200 carrying NEXT_REDIRECT (and a meta
  // refresh). What matters is that it redirects and shows nothing.
  const svcPage = await call(rival, "/dashboard/services");
  const svcHtml = await svcPage.text();
  const svcNames = (await pg.query(`SELECT "nameAr" FROM "Service" WHERE "businessId"=$1 LIMIT 5`, [salon.id])).rows.map((r) => r.nameAr);
  check(
    "…an ungranted area redirects home and renders none of its data (services)",
    (svcPage.status === 307 || /NEXT_REDIRECT;replace;\/dashboard;/.test(svcHtml)) && !svcNames.some((n) => svcHtml.includes(n)),
    `status ${svcPage.status}`,
  );

  /* ── The owner widens, then withdraws ── */
  await send(owner, `/api/business/organizations/${ownedId}`, "PATCH", { action: "grant", scopes: ["RESERVATIONS", "SERVICES"] });
  const svc = await send(rival, "/api/business/services", "POST", { nameAr: `${tag} خدمة مفوّضة`, duration: 30, price: 100 });
  const svcId = (await json(svc)).service?.id ?? (await pg.query(`SELECT id FROM "Service" WHERE "nameAr"=$1`, [`${tag} خدمة مفوّضة`])).rows[0]?.id;
  if (svcId) created.services.push(svcId);
  check("granting SERVICES opens it on the next request (201)", svc.status === 201, `status ${svc.status}`);
  check("…and the services page", (await call(rival, "/dashboard/services")).status === 200);
  const svcRow = (await pg.query(`SELECT "businessId" FROM "Service" WHERE id=$1`, [svcId])).rows[0];
  check("…the service lands on qa-salon, not on the delegate's own business", svcRow?.businessId === salon.id);

  // The owner moves it back (the owner's path through the same route).
  const backSlots = await json(await call(owner, `/api/business/bookings/${bookingRow.id}/reschedule?date=${day(6)}`));
  check("the owner reschedules it back", (await send(owner, `/api/business/bookings/${bookingRow.id}/reschedule`, "POST", { date: day(6), startTime: backSlots.slots?.[0] })).status === 200);

  await send(owner, `/api/business/organizations/${ownedId}`, "PATCH", { action: "grant", scopes: [] });
  const noMove = await send(rival, `/api/business/bookings/${bookingRow.id}/reschedule`, "POST", { date: day(7), startTime: moveSlots.slots?.[0] });
  check("…and once access is withdrawn the delegate can no longer reschedule it", noMove.status === 404 || noMove.status === 403, `status ${noMove.status}`);
  const after = await json(await call(rival, "/api/business/bookings?limit=50"));
  const afterIds = (after.bookings ?? after.data ?? []).map((b) => b.id);
  const afterOwners = afterIds.length ? (await pg.query(`SELECT DISTINCT "businessId" FROM "Booking" WHERE id = ANY($1)`, [afterIds])).rows.map((r) => r.businessId) : [];
  check("4: withdrawing everything ends access on the very next request", !afterOwners.includes(salon.id), JSON.stringify(afterOwners));
  check("…starting again is refused (404)", (await send(rival, "/api/organizations/acting", "POST", { businessId: salon.id })).status === 404);
  const endedHome = await (await call(rival, "/dashboard")).text();
  check("…the dashboard says the access ended", /انتهت|has ended/.test(endedHome));
  await send(rival, "/api/organizations/acting", "DELETE");
  check("leaving the acting context gives the delegate their own business back", (await call(rival, "/api/business/settings/booking")).status === 200 && !rival.cookies.has("maw3ed-acting"));

  /* ── 3/8/9: the mall hosts, and never operates ── */
  const hostAsk = await send(founder, `/api/organizations/${mall.id}/businesses`, "POST", { businessSlug: salon.slug, relation: "HOSTED", requestedScopes: ["RESERVATIONS"] });
  check("3/8: asking a hosted business for access is refused (422)", hostAsk.status === 422, `status ${hostAsk.status}`);
  const host = await send(founder, `/api/organizations/${mall.id}/businesses`, "POST", { businessSlug: salon.slug, relation: "HOSTED" });
  const hostedId = (await json(host)).association?.id;
  await send(owner, `/api/business/organizations/${hostedId}`, "PATCH", { action: "accept" });
  const forceGrant = await send(owner, `/api/business/organizations/${hostedId}`, "PATCH", { action: "grant", scopes: ["FINANCE"] });
  check("9: not even the owner can hand a hosting mall finance (422)", forceGrant.status === 422, `status ${forceGrant.status}`);
  check("8/9: the mall's owner cannot operate the hosted salon (404)", (await send(founder, "/api/organizations/acting", "POST", { businessId: salon.id })).status === 404);
  const twoOwners = await send(founder, `/api/organizations/${mall.id}/businesses`, "POST", { businessSlug: salon.slug, relation: "OWNED" });
  check("a second owning organization is refused while an ownership stands (409 already-owned)", twoOwners.status === 409 && (await json(twoOwners)).error, `status ${twoOwners.status}`);
  const managedFinance = await send(founder, `/api/organizations/${mall.id}/businesses`, "POST", { businessSlug: rivalSalon.slug, relation: "MANAGED", requestedScopes: ["FINANCE"] });
  check("10: a managing company cannot be given finance (422)", managedFinance.status === 422, `status ${managedFinance.status}`);

  /* ── 13: directories ── */
  const gHtml = await (await call(null, `/groups/${tag}-grp`)).text();
  const mHtml = await (await call(null, `/groups/${tag}-mall`)).text();
  check("13: the group's directory lists its owned brand, the mall's its hosted tenant", gHtml.includes(`/company/${salon.slug}?org=${tag}-grp`) && mHtml.includes(`/company/${salon.slug}?org=${tag}-mall`));

  /* ── 23: hierarchy through the API ── */
  check("the mall goes under the group (owner of both)", (await send(founder, `/api/organizations/${mall.id}/parent`, "PUT", { parentId: group.id })).status === 200);
  check("23: the reverse would be a cycle and is refused (409)", (await send(founder, `/api/organizations/${group.id}/parent`, "PUT", { parentId: mall.id })).status === 409);
  check("a manager cannot reorganize ownership (404)", (await send(rival, `/api/organizations/${group.id}/parent`, "PUT", { parentId: null })).status === 404);
  check("the mall's page says where it belongs", (await (await call(null, `/groups/${tag}-mall`)).text()).includes(`/groups/${tag}-grp`));

  /* ── 22: audit ── */
  const audit = (await pg.query(`SELECT DISTINCT action FROM "AuditLog" WHERE "resourceType"='Organization' AND "resourceId"=$1`, [group.id])).rows.map((r) => r.action);
  check("22: relationship changes and operating sessions are audited", ["org.business.invite", "org.business.accept", "org.business.grant", "org.operate.start", "org.parent.set"].every((a) => audit.includes(a)), audit.join(","));

  /* ── Code-review regressions (2026-10-31): each failed on the pre-fix code ── */
  // An operator with two organizations: one managing branch A's reservations
  // only, one holding the customer book and reports (no finance).
  const opEmail = `${tag}-operator@example.test`;
  await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify({ name: "QA Operator", email: opEmail, password: PASSWORD }) });
  const opId = (await pg.query(`SELECT id FROM "User" WHERE email=$1`, [opEmail])).rows[0]?.id;
  created.users.push(opId);
  const [brA, brB] = (await pg.query(`SELECT id FROM "Branch" WHERE "businessId"=$1 AND "isActive" ORDER BY "sortOrder" LIMIT 2`, [salon.id])).rows.map((r) => r.id);
  for (const [oid, branchId, scopes] of [[`${tag}-ops1`, brA, "{RESERVATIONS}"], [`${tag}-ops2`, null, "{CUSTOMERS,REPORTS}"]]) {
    await pg.query(`INSERT INTO "VenueOrganization"(id,slug,"nameAr",kind,status,"isPublished","updatedAt") VALUES ($1,$1,'مشغّل (بيانات اختبار)','BUSINESS_GROUP','APPROVED',false,now())`, [oid]);
    created.orgs.push(oid);
    await pg.query(`INSERT INTO "VenueRole"(id,"userId",kind,"organizationId","createdAt") VALUES ($1,$2,'ORGANIZATION_ADMIN',$3,now())`, [`${oid}-role`, opId, oid]);
    await pg.query(`INSERT INTO "OrganizationBusiness"(id,"organizationId","businessId","branchId",relation,status,"initiatedById",scopes,"updatedAt") VALUES ($1,$2,$3,$4,'MANAGED','APPROVED',$5,$6,now())`, [`${oid}-a`, oid, salon.id, branchId, opId, scopes]);
  }
  const op = await login(opEmail);
  await send(op, "/api/organizations/acting", "POST", { businessId: salon.id });
  const bkScope = async (q) => {
    const j = await json(await call(op, `/api/business/bookings?limit=100${q}`));
    const ids = (j.bookings ?? []).map((b) => b.id);
    return ids.length ? (await pg.query(`SELECT DISTINCT "branchId" FROM "Booking" WHERE id = ANY($1)`, [ids])).rows.map((r) => r.branchId) : [];
  };
  const own = await bkScope("");
  check("R1: a branch-limited delegate sees only its branch", own.every((b) => b === brA), JSON.stringify(own));
  check("R1: …and ?branchId= of another branch widens nothing", (await bkScope(`&branchId=${brB}`)).length === 0);
  const custs = await json(await call(op, "/api/business/customers?limit=50"));
  check("R3: CUSTOMERS+REPORTS without FINANCE sees no spend", (custs.customers ?? custs.items ?? []).length > 0 && (custs.customers ?? custs.items).every((c) => c.totalSpend === null), JSON.stringify((custs.customers ?? custs.items ?? []).slice(0, 2).map((c) => c.totalSpend)));
  const custHtml = await (await call(op, "/dashboard/customers?sort=spend")).text();
  check("R3: …the customers page sends no spend figures to the browser", !/"spend":[1-9]/.test(custHtml));
  check("R2: the full business record is not readable by a delegate", [404, 409].includes((await call(op, "/api/business")).status));
  await send(op, "/api/organizations/acting", "DELETE");

  // STAFF delegate: no login details, no sign-in control.
  await send(owner, `/api/business/organizations/${ownedId}`, "PATCH", { action: "grant", scopes: ["RESERVATIONS", "STAFF", "PROFILE"] });
  rival.cookies.delete("maw3ed-acting");
  await send(rival, "/api/organizations/acting", "POST", { businessId: salon.id });
  const tmp = (await pg.query(`INSERT INTO "StaffMember"(id,"businessId","nameAr",access,"loginPhone","isActive","updatedAt") VALUES ($1,$2,'موظف بدخول (اختبار)','PROVIDER','01000099991',true,now()) RETURNING id`, [`${tag}-staff`, salon.id])).rows[0].id;
  created.staff.push(tmp);
  const edited = await send(rival, `/api/business/staff/${tmp}`, "PUT", { role: "تجربة" });
  const editedBody = await json(edited);
  check("R4: a STAFF delegate's edit reply carries no login number or linked account", edited.status === 200 && !("loginPhone" in editedBody) && !("userId" in editedBody), JSON.stringify(Object.keys(editedBody)));
  check("R4: …cannot switch off someone who signs in (403)", (await send(rival, `/api/business/staff/${tmp}`, "PUT", { isActive: false })).status === 403);
  check("R4: …cannot delete someone who signs in (403)", (await send(rival, `/api/business/staff/${tmp}`, "DELETE")).status === 403);
  const prof = (await pg.query(`SELECT "nameAr" FROM "Business" WHERE id=$1`, [salon.id])).rows[0];
  const put = await send(rival, "/api/business", "PUT", { nameAr: prof.nameAr });
  const putBody = await json(put);
  check("R2: a PROFILE delegate's save reply carries only the profile", put.status === 200 && !["plan", "notificationEmail", "notificationPhone", "ownerId", "depositPercent", "subscriptionStatus"].some((k) => k in putBody), `${put.status} ${Object.keys(putBody).join(",").slice(0, 120)}`);
  check("R8: the live bookings stream serves a delegate (no endless 409 reconnects)", await (async () => {
    const ac = new AbortController();
    const r = await fetch(`${B}/api/realtime/bookings`, { headers: { Cookie: rival.header() }, signal: ac.signal });
    const ok = r.status === 200 && (r.headers.get("content-type") ?? "").includes("text/event-stream");
    ac.abort();
    return ok;
  })());
  await send(rival, "/api/organizations/acting", "DELETE");

  // R5: staff time off is not every staff member's to read.
  if (SECRET) {
    const mgr = (await pg.query(`SELECT "userId", "businessId" FROM "StaffMember" WHERE access='MANAGER' AND "userId" IS NOT NULL LIMIT 1`)).rows[0];
    if (mgr) {
      const r = await fetch(`${B}/api/business/time-blocks`, { headers: { Authorization: `Bearer ${await bearer(mgr.userId, mgr.businessId)}` } });
      check("R5: a staff manager's token cannot list colleagues' time off (403)", r.status === 403, `status ${r.status}`);
    } else check("R5: staff time-off check", false, "no MANAGER staff login in the fixtures");
  } else console.log("NOT RUN  R5 — set AUTH_SECRET to the server's");

  /* ── 20: the acting banner and exit, in a real browser ── */
  await send(owner, `/api/business/organizations/${ownedId}`, "PATCH", { action: "grant", scopes: ["RESERVATIONS"] });
  const browser = await chromium.launch();
  try {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      await ctx.addCookies([...rival.cookies].map(([name, value]) => ({ name, value, url: B })));
      const page = await ctx.newPage();
      await page.goto(`${B}/org-admin`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /ادخل أدير النشاط|Manage this business/ }).first().click();
      await page.waitForURL(/\/dashboard$/, { timeout: 30000 });
      await page.waitForLoadState("networkidle");
      const banner = page.getByRole("status").filter({ hasText: /بتدير|Managing/ });
      check(`20: at ${w}px the banner shows, with no billing in the nav`, (await banner.count()) > 0 && (await page.locator('a[href="/dashboard/billing"]').count()) === 0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`20: at ${w}px no horizontal overflow`, overflow <= 0, `${overflow}px`);
      await page.getByRole("button", { name: /اخرج من الإدارة|Stop managing/ }).click();
      await page.waitForURL(/\/org-admin/, { timeout: 30000 });
      const cookies = await ctx.cookies();
      check(`…at ${w}px "stop managing" ends it and returns to the console`, !cookies.some((c) => c.name === "maw3ed-acting" && c.value));
      await ctx.close();
    }
    // R6: a stale or forged acting cookie heals itself instead of locking
    // the owner out of their own pages.
    const octx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await octx.addCookies([...owner.cookies].map(([name, value]) => ({ name, value, url: B })));
    await octx.addCookies([{ name: "maw3ed-acting", value: "forgedcookievalue123", url: B }]);
    const op2 = await octx.newPage();
    await op2.goto(`${B}/dashboard/billing`, { waitUntil: "networkidle" });
    await op2.waitForFunction(() => !document.cookie.includes("maw3ed-acting=forged"), null, { timeout: 15000 }).catch(() => {});
    await op2.waitForTimeout(1500);
    const healed = !(await octx.cookies()).some((c) => c.name === "maw3ed-acting" && c.value);
    await op2.goto(`${B}/dashboard/billing`, { waitUntil: "networkidle" });
    check("R6: a forged acting cookie is cleared and the owner reaches their own billing page", healed && /\/dashboard\/billing$/.test(op2.url()), op2.url());
    await octx.close();
  } finally {
    await browser.close();
  }

  check("18: standalone businesses unaffected", (await call(null, "/company/qa-listing-0")).status === 200 && (await call(null, "/businesses")).status === 200);
} catch (e) {
  check("script ran to the end", false, String(e?.stack ?? e));
} finally {
  if (created.services.length) await pg.query(`DELETE FROM "Service" WHERE id = ANY($1)`, [created.services]);
  if (created.staff.length) await pg.query(`DELETE FROM "StaffMember" WHERE id = ANY($1)`, [created.staff]);
  if (created.bookings?.length) {
    await pg.query(`DELETE FROM "Payment" WHERE "bookingId" = ANY($1)`, [created.bookings]);
    await pg.query(`DELETE FROM "Booking" WHERE id = ANY($1)`, [created.bookings]);
  }
  const orgs = created.orgs.filter(Boolean);
  if (orgs.length) {
    await pg.query(`UPDATE "VenueOrganization" SET "parentId"=NULL WHERE id = ANY($1)`, [orgs]);
    await pg.query(`DELETE FROM "AuditLog" WHERE "resourceType"='Organization' AND "resourceId" = ANY($1)`, [orgs]);
    await pg.query(`DELETE FROM "VenueOrganization" WHERE id = ANY($1)`, [orgs]);
  }
  const users = created.users.filter(Boolean);
  if (users.length) {
    await pg.query(`DELETE FROM "LifecycleEvent" WHERE "userId" = ANY($1)`, [users]);
    await pg.query(`DELETE FROM "User" WHERE id = ANY($1)`, [users]).catch((e) => console.log("user cleanup:", e.message));
  }
  await pg.query(`DELETE FROM "RateLimit"`);
  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
