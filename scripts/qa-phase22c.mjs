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
const created = { users: [], orgs: [], services: [] };

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

  await send(owner, `/api/business/organizations/${ownedId}`, "PATCH", { action: "grant", scopes: [] });
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
  check("a second owning organization is refused (409 already-owned)", twoOwners.status === 409, `status ${twoOwners.status}`);
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
  } finally {
    await browser.close();
  }

  check("18: standalone businesses unaffected", (await call(null, "/company/qa-listing-0")).status === 200 && (await call(null, "/businesses")).status === 200);
} catch (e) {
  check("script ran to the end", false, String(e?.stack ?? e));
} finally {
  if (created.services.length) await pg.query(`DELETE FROM "Service" WHERE id = ANY($1)`, [created.services]);
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
