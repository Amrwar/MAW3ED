/**
 * Phase 22b end to end over HTTP, on a production build against the QA
 * database (scripts/qa-fixtures.mjs), with real browser sessions:
 *
 *   somebody signs up and registers an organization (a business group)
 *   → it is PENDING: no public page, no publishing, no recruiting →
 *   the platform admin approves it → the owner publishes, invites an
 *   existing business by slug and appoints a manager → the business's
 *   owner accepts from their dashboard API → the public directory
 *   (ar/en, searchable, SEO) lists it with a booking link carrying
 *   ?org= → a booking through that link is attributed; a forged org is
 *   not → the marketing QR encodes exactly /groups/<slug>?src=qr →
 *   views are counted; metrics are counts only → an email invite link
 *   reads publicly and can be cancelled → removal unlists without
 *   touching the business → suspension takes the page down.
 *
 * Local only; everything it creates is removed.
 *
 *   node scripts/qa-phase22b.mjs [baseUrl] [--db url]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const QRCode = require("qrcode");
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
const tag = `qa22b-${stamp}`;
const PASSWORD = "QaPassword123!";
const created = { users: [], orgs: [], bookings: [] };

try {
  const admin = await login("admin@qa.test", PASSWORD);
  const owner = await login("owner@qa.test", PASSWORD);

  /* ── Registration and review ─────────────────────────── */
  const regEmail = `${tag}-founder@example.test`;
  const su = await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify({ name: "QA Org Founder", email: regEmail, password: PASSWORD }) });
  check("the founder signs up like anybody", su.status === 201 || su.status === 200, `status ${su.status}`);
  const founderId = (await pg.query(`SELECT id FROM "User" WHERE email=$1`, [regEmail])).rows[0]?.id;
  if (founderId) created.users.push(founderId);
  let founder = await login(regEmail, PASSWORD);

  const unconfirmed = await send(founder, "/api/organizations", "POST", { slug: `${tag}-grp`, kind: "BUSINESS_GROUP", nameAr: "مجموعة (بيانات اختبار)" });
  check("an unconfirmed email cannot register an organization", unconfirmed.status === 403 && (await json(unconfirmed)).code === "email-not-verified", `status ${unconfirmed.status}`);
  await pg.query(`UPDATE "User" SET "emailVerified"=now() WHERE id=$1`, [founderId]);
  founder = await login(regEmail, PASSWORD);

  const reg = await send(founder, "/api/organizations", "POST", { slug: `${tag}-grp`, kind: "BUSINESS_GROUP", nameAr: "مجموعة مطاعم (بيانات اختبار)", nameEn: "Restaurant group (QA fixture)" });
  const org = (await json(reg)).organization;
  if (org) created.orgs.push(org.id);
  check("a confirmed account registers an organization, created PENDING", reg.status === 201 && org?.status === "PENDING", `status ${reg.status}`);
  check("a reserved slug is refused", (await send(founder, "/api/organizations", "POST", { slug: "groups", kind: "MALL", nameAr: "x" })).status === 422);
  const myOrgs = await json(await call(founder, "/api/organizations"));
  check("the founder sees their organization in the console list", myOrgs.organizations?.some((o) => o.id === org.id));

  check("a pending organization has no public page", (await call(null, `/groups/${tag}-grp`)).status === 404);
  const earlyPub = await send(founder, `/api/organizations/${org.id}`, "PATCH", { isPublished: true });
  check("it cannot publish before review", earlyPub.status === 409 && (await json(earlyPub)).code === "not-approved", `status ${earlyPub.status}`);
  const earlyInvite = await send(founder, `/api/organizations/${org.id}/businesses`, "POST", { businessSlug: "qa-salon", relation: "TENANT" });
  check("…nor invite businesses before review", earlyInvite.status === 409, `status ${earlyInvite.status}`);
  check("…nor email-invite before review", (await send(founder, `/api/organizations/${org.id}/invites`, "POST", { email: "x@example.test", relation: "OWNED" })).status === 409);
  check("a business owner cannot open somebody's organization console (404)", (await call(owner, `/api/organizations/${org.id}`)).status === 404);
  check("anonymous gets 401", (await call(null, `/api/organizations/${org.id}`)).status === 401);
  check("the founder cannot approve their own organization (404)", (await send(founder, `/api/admin/organizations/${org.id}`, "PATCH", { status: "APPROVED" })).status === 404);

  const noReason = await send(admin, `/api/admin/organizations/${org.id}`, "PATCH", { status: "REJECTED" });
  check("a rejection without a reason is refused", noReason.status === 422);
  const approve = await send(admin, `/api/admin/organizations/${org.id}`, "PATCH", { status: "APPROVED" });
  check("the platform admin approves it", approve.status === 200, `status ${approve.status}`);

  /* ── Publishing, members ─────────────────────────────── */
  const prof = await send(founder, `/api/organizations/${org.id}`, "PATCH", { profile: { descriptionAr: "مجموعة مطاعم تجريبية", phone: "0221234567", instagram: "qa_group", website: "https://example.test" } });
  check("the owner fills the profile", prof.status === 200, `status ${prof.status}`);
  const addMember = await send(founder, `/api/organizations/${org.id}/members`, "POST", { email: "rival@qa.test" });
  check("the owner appoints a manager by email", addMember.status === 201, `status ${addMember.status}`);
  check("the owner cannot appoint themselves as manager (409)", (await send(founder, `/api/organizations/${org.id}/members`, "POST", { email: regEmail })).status === 409);
  check("appointing the same manager twice is a 409, not a duplicate row", (await send(founder, `/api/organizations/${org.id}/members`, "POST", { email: "rival@qa.test" })).status === 409);
  const ownerGrant = await send(admin, "/api/admin/venue-roles", "POST", { email: regEmail, kind: "ORGANIZATION_OWNER", organizationId: org.id });
  check("the platform admin can grant ORGANIZATION_OWNER (409 duplicate for the existing owner, never 500)", ownerGrant.status === 409, `status ${ownerGrant.status}`);
  const manager = await login("rival@qa.test", PASSWORD);
  check("the manager opens the console", (await call(manager, `/api/organizations/${org.id}`)).status === 200);
  check("the manager cannot publish (404)", (await send(manager, `/api/organizations/${org.id}`, "PATCH", { isPublished: true })).status === 404);
  check("the manager cannot appoint members (404)", (await send(manager, `/api/organizations/${org.id}/members`, "POST", { email: "owner@qa.test" })).status === 404);
  check("approved but unpublished: still no public page", (await call(null, `/groups/${tag}-grp`)).status === 404);
  const pub = await send(founder, `/api/organizations/${org.id}`, "PATCH", { isPublished: true });
  check("the owner publishes", pub.status === 200, `status ${pub.status}`);
  const logo = "https://res.cloudinary.com/demo/image/upload/qa22b-logo.png";
  const badImg = await send(founder, `/api/organizations/${org.id}`, "PATCH", { profile: { logoImage: "javascript:alert(1)" } });
  check("a non-upload image URL is refused (422)", badImg.status === 422, `status ${badImg.status}`);
  const goodImg = await send(founder, `/api/organizations/${org.id}`, "PATCH", { profile: { logoImage: logo, coverImage: logo } });
  check("an uploaded logo and cover are saved", goodImg.status === 200 && (await pg.query(`SELECT "logoImage" FROM "VenueOrganization" WHERE id=$1`, [org.id])).rows[0].logoImage === logo, `status ${goodImg.status}`);

  const emptyRes = await call(null, `/groups/${tag}-grp`);
  const emptyHtml = await emptyRes.text();
  check("the empty organization page renders and is not indexed", emptyRes.status === 200 && /noindex/.test(emptyHtml));

  /* ── Association: invite an existing business ────────── */
  const ownBiz = (await pg.query(`SELECT id, slug FROM "Business" WHERE slug='qa-salon'`)).rows[0];
  const invRes = await send(manager, `/api/organizations/${org.id}/businesses`, "POST", { businessSlug: ownBiz.slug, relation: "TENANT", note: "تنضم لدليل المجموعة؟" });
  const association = (await json(invRes)).association;
  check("the manager invites an existing business by slug", invRes.status === 201 && association?.status === "INVITED", `status ${invRes.status}`);
  check("inviting it twice is refused", (await send(manager, `/api/organizations/${org.id}/businesses`, "POST", { businessSlug: ownBiz.slug, relation: "TENANT" })).status === 409);
  check("a made-up slug is a 404", (await send(manager, `/api/organizations/${org.id}/businesses`, "POST", { businessSlug: "no-such-biz", relation: "TENANT" })).status === 404);
  check("an invited-but-unanswered business is not public", !(await (await call(null, `/groups/${tag}-grp`)).text()).includes(ownBiz.slug));
  const orgApprove = await send(manager, `/api/organizations/${org.id}/businesses/${association.id}`, "PATCH", { action: "approve" });
  check("the organization cannot answer its own invitation for the business (409, state unchanged)", orgApprove.status === 409, `status ${orgApprove.status}`);

  const bizView = await json(await call(owner, "/api/business/organizations"));
  const mineAssoc = bizView.associations?.find((a) => a.id === association.id);
  check("the business owner sees the invitation with the organization named", mineAssoc?.status === "INVITED" && mineAssoc?.organization?.slug === `${tag}-grp`, JSON.stringify(mineAssoc?.organization?.slug));
  const accept = await send(owner, `/api/business/organizations/${association.id}`, "PATCH", { action: "accept" });
  check("the business owner accepts", accept.status === 200, `status ${accept.status}`);
  check("ownership did not move", (await pg.query(`SELECT u.email FROM "Business" b JOIN "User" u ON u.id=b."ownerId" WHERE b.id=$1`, [ownBiz.id])).rows[0].email === "owner@qa.test");

  /* ── The public directory, ar/en, SEO ────────────────── */
  const arRes = await call(null, `/groups/${tag}-grp`);
  const ar = await arRes.text();
  check("the Arabic page lists the business with a booking link carrying ?org=", arRes.status === 200 && ar.includes(`/company/${ownBiz.slug}?org=${tag}-grp`));
  check("Arabic metadata: title, canonical, indexable now", /<title>[^<]*مجموعة مطاعم/.test(ar) && new RegExp(`rel="canonical"[^>]*/groups/${tag}-grp`).test(ar) && !/noindex/.test(ar));
  check("the profile shows (description, phone, instagram)", /مجموعة مطاعم تجريبية/.test(ar) && /0221234567/.test(ar) && /qa_group/.test(ar));
  const en = await (await call(null, `/en/groups/${tag}-grp`)).text();
  check("English metadata and page", /<title>[^<]*Restaurant group \(QA fixture\)/.test(en) && /hreflang="ar"/i.test(en));
  check("no claim of gate passes or official authorisation", !/entry pass|تصريح دخول|authori[sz]ed by|Emaar/i.test(ar.replace(/مش بتصدر تصاريح/g, "")));
  const filtered = await (await call(null, `/groups/${tag}-grp?q=zzzz-nothing`)).text();
  check("the directory search filters", !filtered.includes(`/company/${ownBiz.slug}?org=`), "");
  const indexPage = await (await call(null, "/groups")).text();
  check("the groups index lists it", indexPage.includes(`/groups/${tag}-grp`));
  const company = await (await call(null, `/company/${ownBiz.slug}`)).text();
  check("the business page says it is part of the organization", company.includes(`/groups/${tag}-grp`));
  const pubApi = await json(await call(null, `/api/public/groups/${tag}-grp`));
  check("the public API returns the directory and nothing private", pubApi.organization?.directory?.length === 1 && !/email|userId|token|invite/i.test(JSON.stringify(pubApi.organization?.directory)), JSON.stringify(pubApi.organization?.directory?.length));

  /* ── The marketing QR encodes exactly the public link ── */
  const qrRes = await call(founder, `/api/organizations/${org.id}/qr?format=svg`);
  const qrSvg = await qrRes.text();
  const expected = await QRCode.toString(`${B}/groups/${tag}-grp?src=qr`, { errorCorrectionLevel: "H", margin: 2, width: 1024, type: "svg" });
  check("the QR endpoint returns an SVG that encodes exactly /groups/<slug>?src=qr", qrRes.headers.get("content-type")?.includes("svg") && qrSvg === expected, `match=${qrSvg === expected}`);
  const qrPng = await call(founder, `/api/organizations/${org.id}/qr?format=png`);
  check("…and a PNG", qrPng.status === 200 && qrPng.headers.get("content-type") === "image/png");
  check("the public cannot pull the QR (401)", (await call(null, `/api/organizations/${org.id}/qr`)).status === 401);
  // Regression: the business's own QR still encodes its booking page.
  const bizQr = await call(owner, "/api/business/qr?format=svg");
  const bizExpected = await QRCode.toString(`${B}/company/${ownBiz.slug}?src=qr`, { errorCorrectionLevel: "H", margin: 2, width: 1024, color: { dark: "#0A5F47", light: "#FFFFFF" }, type: "svg" });
  check("the business QR still encodes /company/<slug>?src=qr", bizQr.status === 200 && (await bizQr.text()) === bizExpected);

  /* ── Views and metrics ───────────────────────────────── */
  const view = await send(null, `/api/public/groups/${tag}-grp/view`, "POST", { source: "QR" });
  check("a visit is counted with a 204", view.status === 204);
  await send(null, `/api/public/groups/${tag}-grp/view`, "POST", { source: "DIRECT" });
  const viewRows = await pg.query(`SELECT source, count FROM "OrganizationView" WHERE "organizationId"=$1`, [org.id]);
  check("views land as one integer per channel and day", viewRows.rows.length >= 2 && viewRows.rows.every((r) => r.count >= 1), JSON.stringify(viewRows.rows));

  /* ── A booking through the organization page ─────────── */
  const svc = (await pg.query(`SELECT id FROM "Service" WHERE "businessId"=$1 AND "isAvailable" ORDER BY "sortOrder" LIMIT 1`, [ownBiz.id])).rows[0].id;
  const branchId = (await pg.query(`SELECT id FROM "Branch" WHERE "businessId"=$1 AND "isActive" ORDER BY "sortOrder" LIMIT 1`, [ownBiz.id])).rows[0]?.id;
  const day = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
  const slots = await json(await call(null, `/api/public/${ownBiz.slug}/slots?serviceId=${svc}&date=${day}&branchId=${branchId}`));
  const bk1 = await send(null, `/api/public/${ownBiz.slug}/bookings`, "POST", { serviceId: svc, date: day, startTime: slots.slots?.[0], branchId, customerName: "زبون الجهة", customerPhone: "01019222101", org: `${tag}-grp` });
  const bk1Body = await json(bk1);
  const bk1Id = bk1Body.booking?.id ?? (await pg.query(`SELECT id FROM "Booking" WHERE "customerPhone"='01019222101' ORDER BY "createdAt" DESC LIMIT 1`)).rows[0]?.id;
  if (bk1Id) created.bookings.push(bk1Id);
  const attr1 = await pg.query(`SELECT "organizationId" FROM "OrganizationBookingAttribution" WHERE "bookingId"=$1`, [bk1Id]);
  check("a booking from the organization page is created and attributed to it", bk1.status === 201 && attr1.rows.length === 1 && attr1.rows[0].organizationId === org.id, `status ${bk1.status}, rows ${attr1.rows.length}`);
  const bk2 = await send(null, `/api/public/${ownBiz.slug}/bookings`, "POST", { serviceId: svc, date: day, startTime: slots.slots?.[1], branchId, customerName: "زبون مباشر", customerPhone: "01019222102", org: "no-such-group" });
  const bk2Id = (await pg.query(`SELECT id FROM "Booking" WHERE "customerPhone"='01019222102' ORDER BY "createdAt" DESC LIMIT 1`)).rows[0]?.id;
  if (bk2Id) created.bookings.push(bk2Id);
  check("a forged org slug books fine but credits nobody", bk2.status === 201 && (await pg.query(`SELECT 1 FROM "OrganizationBookingAttribution" WHERE "bookingId"=$1`, [bk2Id])).rows.length === 0, `status ${bk2.status}`);

  const metrics = await json(await call(founder, `/api/organizations/${org.id}/metrics`));
  check("metrics are counts only (views by channel, attributed bookings, per business)", metrics.attributedBookings === 1 && (metrics.views?.QR ?? 0) >= 1 && !/زبون|010192221|customerPhone|customerName|price/i.test(JSON.stringify(metrics)), JSON.stringify(metrics));
  check("the business owner cannot read the organization's metrics (404)", (await call(owner, `/api/organizations/${org.id}/metrics`)).status === 404);
  const audit = await json(await call(founder, `/api/organizations/${org.id}/audit`));
  check("the audit trail records the review, publish and association", Array.isArray(audit.entries ?? audit.audit) && JSON.stringify(audit).includes("org."), "");

  /* ── Email invites ───────────────────────────────────── */
  const einv = await send(founder, `/api/organizations/${org.id}/invites`, "POST", { email: `${tag}-newbiz@example.test`, relation: "OWNED" });
  const einvBody = await json(einv);
  const token = einvBody.invite?.link?.split("org_invite=")[1];
  check("an email invite returns its link even without an email service", einv.status === 201 && !!token && einvBody.invite.emailed === false, `status ${einv.status}`);
  const readInv = await json(await call(null, `/api/public/org-invites/${token}`));
  check("the invite link reads publicly: who invites, until when, nothing else", readInv.invite?.organization && !JSON.stringify(readInv).includes(regEmail), JSON.stringify(readInv.invite?.organization?.slug ?? readInv));
  check("the signup page accepts the invite parameter", (await call(null, `/signup?org_invite=${token}`)).status === 200);
  const invId = einvBody.invite?.id;
  check("the founder cancels the invite", (await send(founder, `/api/organizations/${org.id}/invites/${invId}`, "DELETE")).status === 200);
  check("a cancelled invite link is dead", (await call(null, `/api/public/org-invites/${token}`)).status === 404);

  /* ── Pages ───────────────────────────────────────────── */
  check("the founder's console page renders", (await call(founder, "/org-admin")).status === 200 && (await call(founder, `/org-admin/${org.id}`)).status === 200);

  /* ── The profile form in a real browser persists city and kind-safe edits ── */
  {
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addCookies([...founder.cookies].map(([name, value]) => ({ name, value, url: B })));
      const page = await ctx.newPage();
      await page.goto(`${B}/org-admin/${org.id}`, { waitUntil: "networkidle" });
      const cityId = (await pg.query(`SELECT id FROM "City" ORDER BY "nameAr" DESC LIMIT 1`)).rows[0].id;
      const form = page.locator('form[aria-labelledby="prof-h"]');
      await form.locator("select").nth(1).selectOption(cityId);
      check("the console offers logo and cover uploads", (await form.locator('input[type="file"]').count()) === 2);
      await form.getByRole("button", { name: /احفظ|Save/ }).click();
      await page.waitForResponse((r) => r.url().endsWith(`/api/organizations/${org.id}`) && r.request().method() === "PATCH");
      await page.waitForTimeout(500);
      const saved = (await pg.query(`SELECT "cityId", status FROM "VenueOrganization" WHERE id=$1`, [org.id])).rows[0];
      check("choosing a city in the browser form persists it, and leaves the approval alone", saved.cityId === cityId && saved.status === "APPROVED", JSON.stringify(saved));
      // Changing the name shows the re-review warning before saving.
      await form.locator("input").first().fill("مجموعة باسم جديد");
      check("the form warns that a new name goes back to review", await form.getByRole("status").isVisible());
    } finally {
      await browser.close();
    }
  }

  /* ── A new name after approval goes back to review ── */
  const renamed = await send(founder, `/api/organizations/${org.id}`, "PATCH", { profile: { nameAr: "مول مشهور جدًا (بيانات اختبار)" } });
  const renamedBody = await json(renamed);
  const afterRename = (await pg.query(`SELECT status, "isPublished" FROM "VenueOrganization" WHERE id=$1`, [org.id])).rows[0];
  check("renaming an approved organization sends it back to review and offline", renamed.status === 200 && renamedBody.reReview === true && afterRename.status === "PENDING" && afterRename.isPublished === false, JSON.stringify(afterRename));
  check("…its page is gone until re-approved", (await call(null, `/groups/${tag}-grp`)).status === 404);
  check("…and it cannot republish itself", (await send(founder, `/api/organizations/${org.id}`, "PATCH", { isPublished: true })).status === 409);
  const sameName = await send(founder, `/api/organizations/${org.id}`, "PATCH", { profile: { descriptionAr: "وصف بس" } });
  check("…while editing other fields while pending is fine", sameName.status === 200 && (await json(sameName)).reReview === false);
  await send(admin, `/api/admin/organizations/${org.id}`, "PATCH", { status: "APPROVED" });
  await send(founder, `/api/organizations/${org.id}`, "PATCH", { isPublished: true });
  check("after re-approval it publishes again", (await call(null, `/groups/${tag}-grp`)).status === 200);
  const descOnly = await send(founder, `/api/organizations/${org.id}`, "PATCH", { profile: { descriptionAr: "وصف تاني" } });
  check("editing a description does not trigger review", (await json(descOnly)).reReview === false && (await pg.query(`SELECT status FROM "VenueOrganization" WHERE id=$1`, [org.id])).rows[0].status === "APPROVED");

  /* ── Member appointments are rate-limited (they reveal whether an account exists) ── */
  await pg.query(`DELETE FROM "RateLimit"`);
  const probes = [];
  for (let i = 0; i < 11; i++) probes.push((await send(founder, `/api/organizations/${org.id}/members`, "POST", { email: `${tag}-probe-${i}@example.test` })).status);
  check("the 11th member lookup within an hour is refused (429)", probes.slice(0, 10).every((c) => c === 404) && probes[10] === 429, probes.join(","));
  await pg.query(`DELETE FROM "RateLimit"`);
  check("a stranger gets 404 from that console page", (await call(owner, `/org-admin/${org.id}`)).status === 404);
  check("the owner's organizations page renders", (await call(owner, "/dashboard/organizations")).status === 200);
  check("the admin venues page (with the review section) renders", (await call(admin, "/admin/venues")).status === 200);

  /* ── Removal, then suspension ────────────────────────── */
  const rm = await send(founder, `/api/organizations/${org.id}/businesses/${association.id}`, "PATCH", { action: "remove" });
  check("the organization removes the business", rm.status === 200, `status ${rm.status}`);
  check("…it leaves the directory", !(await (await call(null, `/groups/${tag}-grp`)).text()).includes(`/company/${ownBiz.slug}?org=`));
  check("…and the business is untouched (page up, services intact)", (await call(null, `/company/${ownBiz.slug}`)).status === 200 && (await pg.query(`SELECT count(*)::int AS n FROM "Service" WHERE "businessId"=$1`, [ownBiz.id])).rows[0].n > 0);
  check("…and its page no longer claims membership", !(await (await call(null, `/company/${ownBiz.slug}`)).text()).includes(`/groups/${tag}-grp`));

  const susNoReason = await send(admin, `/api/admin/organizations/${org.id}`, "PATCH", { status: "SUSPENDED" });
  check("suspension needs a reason", susNoReason.status === 422);
  await send(admin, `/api/admin/organizations/${org.id}`, "PATCH", { status: "SUSPENDED", reason: "فحص QA" });
  check("a suspended organization disappears from the public site", (await call(null, `/groups/${tag}-grp`)).status === 404);
  const suspendedView = await json(await call(founder, `/api/organizations/${org.id}`));
  check("the organization sees the administrator's written reason", suspendedView.organization?.statusReason === "فحص QA", JSON.stringify(suspendedView.organization?.statusReason));
  check("…and can no longer recruit", (await send(founder, `/api/organizations/${org.id}/businesses`, "POST", { businessSlug: ownBiz.slug, relation: "TENANT" })).status === 409);
  check("existing URLs unaffected", (await call(null, `/company/${ownBiz.slug}`)).status === 200 && (await call(null, "/businesses")).status === 200);
} catch (e) {
  check("script ran to the end", false, String(e?.stack ?? e));
} finally {
  if (created.bookings.length) {
    await pg.query(`DELETE FROM "Payment" WHERE "bookingId" = ANY($1)`, [created.bookings]);
    await pg.query(`DELETE FROM "Booking" WHERE id = ANY($1)`, [created.bookings]);
  }
  if (created.orgs.length) {
    await pg.query(`DELETE FROM "AuditLog" WHERE "resourceType"='Organization' AND "resourceId" = ANY($1)`, [created.orgs]);
    await pg.query(`DELETE FROM "VenueOrganization" WHERE id = ANY($1)`, [created.orgs]);
  }
  if (created.users.length) {
    await pg.query(`DELETE FROM "LifecycleEvent" WHERE "userId" = ANY($1)`, [created.users]);
    await pg.query(`DELETE FROM "User" WHERE id = ANY($1)`, [created.users]).catch((e) => console.log("user cleanup:", e.message));
  }
  await pg.query(`DELETE FROM "RateLimit"`);
  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
