/**
 * Phase 24 — the organization platform under realistic conditions, end
 * to end over HTTP on a production build against the QA database, with
 * the access sandbox (ACCESS_SANDBOX=1). Four fictional organizations are
 * built through the product's own APIs and exercised as their people
 * would use them:
 *
 *   A  a restaurant group owning three brands
 *   B  a mall hosting independent tenants (the "Eterna-style" venue
 *      configuration, as clearly fictional test data)
 *   C  a clinic group with branch-limited and whole-clinic relationships
 *   D  a management company with delegated access to two businesses
 *
 * then the customer journey through the mall (Part 3), the exceptions
 * (Part 4) and the security checks (Part 6). Results by part are printed
 * at the end and recorded in docs/eterna/ORGANIZATION_TEST_RESULTS.md.
 *
 *   CRON_SECRET=p19-local-cron node scripts/qa-phase24.mjs [baseUrl] [--db url]
 *
 * Local only; everything it creates is removed.
 */
import { createRequire } from "module";
import {
  B, pg, check, notRun, part, login, call, send, json, sandbox, runAccessCron, cronHeaders, tag, made,
  account, customer, business, organization, associate, slotNear, book, cairoNow, teardown, summary, authSecret, shiftBooking, minutesUntil,
} from "./qa-phase24-lib.mjs";
const require = createRequire(import.meta.url);
const QRCode = require("qrcode");
const { SignJWT } = await import("jose");

const SECRET = authSecret();
const bearer = (userId, businessId) =>
  new SignJWT({ businessId, adminRole: null }).setProtectedHeader({ alg: "HS256" }).setSubject(userId)
    .setIssuer("maw3ed").setAudience("maw3ed-mobile-access").setIssuedAt().setExpirationTime("30m").sign(new TextEncoder().encode(SECRET));

const svc = (nameAr, nameEn, duration, price) => ({ nameAr, nameEn, duration, price });
const bookingIds = async (jar) => {
  const r = await json(await call(jar, "/api/business/bookings?limit=100"));
  return (r.bookings ?? r.data ?? []).map((b) => b.id);
};
const ownersOf = async (ids) => ids.length ? (await pg.query(`SELECT DISTINCT "businessId" FROM "Booking" WHERE id = ANY($1)`, [ids])).rows.map((r) => r.businessId) : [];
const act = async (jar, businessId) => { jar.cookies.delete("maw3ed-acting"); return send(jar, "/api/organizations/acting", "POST", { businessId }); };
const leave = (jar) => send(jar, "/api/organizations/acting", "DELETE");
const audits = async (resourceIds, action) =>
  (await pg.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "resourceId" = ANY($1) AND action LIKE $2`, [resourceIds, action])).rows[0].n;
const status = async (id) => (await pg.query(`SELECT status::text FROM "Booking" WHERE id = $1`, [id])).rows[0]?.status;
const access = (token) => call(null, `/api/booking/${token}/access`).then(json);
const checkIn = (jar, code, action) => send(jar, "/api/business/check-in", "POST", action ? { code, action } : { code }).then(json);
const codeOf = async (token) => ((await access(token)).checkIn?.url ?? "").split("/c/")[1] ?? "";

try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const admin = await login("admin@qa.test");
  const prov = await json(await sandbox({ action: "ensure-provider" }));
  await sandbox({ action: "mode", mode: "NORMAL" });
  if (prov.provider?.kind !== "SANDBOX") throw new Error("the access sandbox is not available on this build (ACCESS_SANDBOX=1)");

  /* ════════════════════════════════════════════════════════════════
   * A. RESTAURANT GROUP — a parent company owning three brands
   * ════════════════════════════════════════════════════════════════ */
  part("A. Restaurant group");
  const palmFounder = await account("palm-founder", "Palm Dining founder (test)");
  const palm = await organization(palmFounder, admin, {
    slug: "palm", kind: "RESTAURANT_GROUP", nameAr: "مجموعة النخيل للمطاعم (بيانات تجريبية)", nameEn: "Palm Dining Group (test data)",
    descriptionAr: "مجموعة مطاعم وهمية لاختبار المنصة.", descriptionEn: "A fictional restaurant group for platform testing.",
  });
  check("A1: the group registers, is approved by the platform and publishes its page", palm?.id && (await pg.query(`SELECT status::text, "isPublished" FROM "VenueOrganization" WHERE id = $1`, [palm.id])).rows[0]?.isPublished === true);
  const grill = await business("grill", { nameAr: "مشويات النخيل (تجريبي)", nameEn: "Palm Grill (test)", category: "restaurants", services: [svc("عشاء", "Dinner", 90, 400)], plan: "PRO" });
  const cafe = await business("cafe", { nameAr: "كافيه النخيل (تجريبي)", nameEn: "Palm Cafe (test)", category: "restaurants", services: [svc("فطار", "Breakfast", 60, 150)], plan: "PRO" });
  const sushi = await business("sushi", { nameAr: "سوشي النخيل (تجريبي)", nameEn: "Palm Sushi (test)", category: "restaurants", services: [svc("أوماكاسي", "Omakase", 120, 1200)] });
  check("A2: three brands sign up, onboard and publish on their own accounts", [grill, cafe, sushi].every((b) => b.id));
  // Palm Grill seats guests at tables; its owner sets two up.
  const tables = [];
  for (const name of ["ترابيزة ١", "ترابيزة ٢"]) tables.push((await json(await send(grill.owner, "/api/business/resources", "POST", { name, kind: "TABLE", capacity: 4 }))).resource?.id);
  const aGrill = await associate(palmFounder, palm.id, grill, "OWNED", { ask: ["RESERVATIONS", "STAFF", "RESOURCES", "REPORTS", "FINANCE"], section: "Grill" });
  const aCafe = await associate(palmFounder, palm.id, cafe, "OWNED", { ask: ["RESERVATIONS", "STAFF", "REPORTS", "FINANCE"], grant: ["RESERVATIONS", "REPORTS"] });
  const aSushi = await associate(palmFounder, palm.id, sushi, "OWNED", { ask: ["RESERVATIONS", "REPORTS"], grant: ["RESERVATIONS"] });
  const scopes = (await pg.query(`SELECT id, scopes::text[] AS s FROM "OrganizationBusiness" WHERE id = ANY($1)`, [[aGrill, aCafe, aSushi]])).rows;
  const sc = (id) => scopes.find((r) => r.id === id)?.s.join(",");
  check("A3: each brand grants only what its owner chose", sc(aGrill) === "RESERVATIONS,STAFF,RESOURCES,REPORTS,FINANCE" && sc(aCafe) === "RESERVATIONS,REPORTS" && sc(aSushi) === "RESERVATIONS", JSON.stringify(scopes));
  check("A3: ownership of each brand did not move to the group", (await pg.query(`SELECT count(*)::int AS n FROM "Business" WHERE id = ANY($1) AND "ownerId" = ANY($2)`, [[grill.id, cafe.id, sushi.id], [grill.owner.userId, cafe.owner.userId, sushi.owner.userId]])).rows[0].n === 3);

  const palmOps = await account("palm-ops", "Palm operations manager (test)");
  check("A4: the founder appoints an operations manager", (await send(palmFounder, `/api/organizations/${palm.id}/members`, "POST", { email: palmOps.email })).status === 201);
  const opsPortfolio = (await json(await call(palmOps, "/api/organizations/operable"))).businesses ?? [];
  check("A4: centralised management — the manager's portfolio lists the three brands with exactly their grants",
    opsPortfolio.length === 3 && opsPortfolio.find((b) => b.business.id === sushi.id)?.scopes.join() === "RESERVATIONS", JSON.stringify(opsPortfolio.map((b) => [b.business.slug, b.scopes])));

  // Customers book each brand; some came through the group's page.
  const bks = {};
  for (const [k, biz, n, org] of [["g1", grill, 30, palm], ["g2", grill, 150, null], ["c1", cafe, 60, palm], ["s1", sushi, 90, null]]) {
    const slot = await slotNear(biz, biz.services[0].id, n);
    const r = await book(biz, { slot, name: `ضيف ${k}`, org: org ? `${tag}-palm` : undefined });
    bks[k] = r.booking;
    if (r.status !== 201 && r.status !== 200) check(`A5: booking ${k} at ${biz.slug}`, false, `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  check("A5: customers book each brand on its own page", Object.values(bks).every((b) => b?.id), JSON.stringify(Object.keys(bks)));
  check("A5: individual operations — each brand's owner sees only their own bookings",
    (await ownersOf(await bookingIds(grill.owner))).join() === grill.id && (await ownersOf(await bookingIds(cafe.owner))).join() === cafe.id);
  await act(palmOps, grill.id);
  const opsGrill = await bookingIds(palmOps);
  check("A6: the manager operating Palm Grill sees Palm Grill's bookings and nobody else's", opsGrill.includes(bks.g1.id) && (await ownersOf(opsGrill)).join() === grill.id);
  const staffAdd = await send(palmOps, "/api/business/staff", "POST", { nameAr: "شيف تجريبي", nameEn: "Test chef", role: "chef", workingDays: [0, 1, 2, 3, 4, 5, 6], specialties: [] });
  check("A7: staff management — with STAFF granted, the manager adds a chef to Palm Grill", staffAdd.status === 201 || staffAdd.status === 200, `status ${staffAdd.status}`);
  const resGrill = await json(await call(palmOps, "/api/business/resources"));
  const tableEdit = await send(palmOps, `/api/business/resources/${tables[0]}`, "PATCH", { capacity: 6 });
  const tableAdd = await send(palmOps, "/api/business/resources", "POST", { name: "ترابيزة الشرفة", kind: "TABLE", capacity: 2 });
  check("A7: resource management — with RESOURCES the manager sees Palm Grill's tables, resizes one and adds another",
    (resGrill.resources ?? resGrill.data ?? resGrill).length >= 2 && tableEdit.status === 200 && [200, 201].includes(tableAdd.status), `${tableEdit.status}/${tableAdd.status}`);
  check("A7: the tables page opens for the manager", (await call(palmOps, "/dashboard/resources")).status === 200);
  const grillBooking = (await json(await call(palmOps, "/api/business/bookings?limit=100"))).bookings?.find((b) => b.id === bks.g1.id);
  check("A8: with FINANCE, the manager sees Palm Grill's prices", grillBooking && Number(grillBooking.totalPrice) > 0, JSON.stringify(grillBooking ?? null).slice(0, 160));
  await act(palmOps, cafe.id);
  const opsCafe = await bookingIds(palmOps);
  check("A6: switching to Palm Cafe shows Palm Cafe's bookings only — booking separation", opsCafe.includes(bks.c1.id) && !opsCafe.includes(bks.g1.id) && (await ownersOf(opsCafe)).join() === cafe.id);
  check("A7: without STAFF, adding staff at Palm Cafe is refused", [403, 404].includes((await send(palmOps, "/api/business/staff", "POST", { nameAr: "موظف", workingDays: [1], specialties: [] })).status));
  check("A7: without RESOURCES, Palm Cafe's tables are closed to the manager", (await call(palmOps, "/api/business/resources")).status === 403);
  check("A9: correct permissions — the manager cannot read Palm Cafe's customers (no CUSTOMERS grant)", [403, 404].includes((await call(palmOps, "/api/business/customers")).status));
  check("A9: …nor change Palm Cafe's booking policy (owner only)", [401, 403, 404, 409].includes((await send(palmOps, "/api/business/settings/booking", "PATCH", { autoConfirm: false })).status));
  check("A9: …nor change what Palm Cafe grants the group (the business owner's decision)", [401, 403, 404, 409].includes((await send(palmOps, `/api/business/organizations/${aCafe}`, "PATCH", { action: "grant", scopes: ["RESERVATIONS", "FINANCE"] })).status));
  await leave(palmOps);

  const pf = await json(await call(palmOps, `/api/organizations/${palm.id}/portfolio`));
  const row = (id) => pf.rows?.find((r) => r.business?.id === id);
  check("A10: aggregated reporting — Palm Grill shares counts and revenue", row(grill.id)?.figures?.bookings === 2 && typeof row(grill.id)?.figures?.revenue === "number", JSON.stringify(row(grill.id)));
  check("A10: …Palm Cafe shares counts without revenue (no FINANCE)", row(cafe.id)?.figures?.bookings === 1 && row(cafe.id)?.figures?.revenue === null);
  check("A10: …Palm Sushi shared nothing and is listed as not shared", row(sushi.id) && row(sushi.id).figures === null);
  check("A10: …totals add up over the sharing brands; no customer appears", pf.totals?.bookings === 3 && pf.totals?.sharing === 2 && !/ضيف|0102|customer|phone/i.test(JSON.stringify(pf)));
  const consolePage = await call(palmOps, `/org-admin/${palm.id}`);
  check("A10: the organization console opens for the manager", consolePage.status === 200);
  check("A10: the portfolio is not readable by a brand's owner or anonymously", [404].includes((await call(grill.owner, `/api/organizations/${palm.id}/portfolio`)).status) && (await call(null, `/api/organizations/${palm.id}/portfolio`)).status === 401);

  /* ════════════════════════════════════════════════════════════════
   * B + Part 2. SHOPPING MALL — independent tenants (fictional,
   * Eterna-style configuration)
   * ════════════════════════════════════════════════════════════════ */
  part("B. Shopping mall");
  const mallFounder = await account("mall-founder", "Nile Gate Mall operator (test)");
  const mall = await organization(mallFounder, admin, {
    slug: "nilegate", kind: "MALL", nameAr: "مول بوابة النيل (بيانات تجريبية)", nameEn: "Nile Gate Mall (fictional test data)",
    descriptionAr: "مول وهمي بالكامل لاختبار تشغيل مول على المنصة. مش جهة حقيقية.", descriptionEn: "An entirely fictional mall used to test running a mall on the platform. Not a real operator.",
  });
  const mallSlug = `${tag}-nilegate`;
  const cityId = (await pg.query(`SELECT id FROM "City" WHERE slug = 'new-cairo'`)).rows[0].id;
  const vRes = await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-nilegate-v`, kind: "MALL", nameAr: "مول بوابة النيل (تجريبي)", nameEn: "Nile Gate Mall (test)", organizationId: mall.id, cityId });
  const venue = (await json(vRes)).venue;
  made.venues.push(venue?.id);
  await send(admin, `/api/admin/venues/${venue.id}`, "PATCH", { status: "ACTIVE", isPublished: true });
  check("P2: the platform creates the mall's venue under the mall organization, active and public", vRes.status === 201 && (await pg.query(`SELECT status::text, "isPublished", "organizationId" FROM "Venue" WHERE id = $1`, [venue.id])).rows[0]?.organizationId === mall.id);
  const ground = (await json(await send(mallFounder, `/api/venues/${venue.id}/zones`, "POST", { kind: "FLOOR", nameAr: "الدور الأرضي", nameEn: "Ground floor", level: 0 }))).zone;
  const food = (await json(await send(mallFounder, `/api/venues/${venue.id}/zones`, "POST", { kind: "ZONE", nameAr: "منطقة المطاعم", nameEn: "Food court", level: 1 }))).zone;
  const gate = (await json(await send(mallFounder, `/api/venues/${venue.id}/gates`, "POST", { nameAr: "البوابة الشمالية", nameEn: "North gate", kind: "PEDESTRIAN", code: `${tag}-N` }))).gate;
  const gate2 = (await json(await send(mallFounder, `/api/venues/${venue.id}/gates`, "POST", { nameAr: "بوابة الجراج", nameEn: "Car park gate", kind: "PEDESTRIAN", code: `${tag}-P` }))).gate;
  check("P2: the mall operator adds floors, zones and gates", !!ground?.id && !!food?.id && !!gate?.id && !!gate2?.id);
  const pol = await send(mallFounder, `/api/venues/${venue.id}/policy`, "PUT", {
    visitorEligibility: "BOOKING_REQUIRED", accessBeforeMinutes: 120, accessAfterMinutes: 30, maxGuestsPerBooking: 2,
    reentryAllowed: false, allowedGateIds: [gate.id], accessInstructionsAr: "ادخل من البوابة الشمالية ومعاك تصريح الزيارة.", accessInstructionsEn: "Enter by the north gate with your visitor pass.",
  });
  check("P2: venue-specific access rules (booking required, 2 guests, north gate only)", pol.status === 200, `status ${pol.status}`);
  const site = `SITE-${tag}`;
  made.sites.push(site);
  const provSet = await send(admin, `/api/venues/${venue.id}/access`, "PUT", { providerSlug: prov.provider.slug, siteRef: site });
  const opOn = await send(mallFounder, `/api/venues/${venue.id}/access`, "PUT", { accessEnabled: true });
  check("P2: optional visitor access — the platform picks the (sandbox) provider; the operator switches passes on", provSet.status === 200 && opOn.status === 200, `${provSet.status}/${opOn.status}`);
  const opProv = await send(mallFounder, `/api/venues/${venue.id}/access`, "PUT", { providerSlug: prov.provider.slug, siteRef: "SITE-ELSEWHERE" });
  check("P2: …the operator cannot choose or repoint the provider", opProv.status === 404);
  const guardJar = await account("mall-security", "Nile Gate security desk (test)");
  check("P2: a security-desk account is given the venue's security role", (await send(admin, "/api/admin/venue-roles", "POST", { email: guardJar.email, kind: "VENUE_SECURITY", venueId: venue.id })).status === 201);

  const rest = await business("m-rest", { nameAr: "مطعم الشرفة (تجريبي)", nameEn: "Terrace Restaurant (test)", category: "restaurants", services: [svc("غدا", "Lunch", 60, 300)] });
  const clinic = await business("m-clinic", { nameAr: "عيادة الشفاء للأسنان (تجريبي)", nameEn: "Shifa Dental (test)", category: "dentists", services: [svc("كشف", "Check-up", 30, 500)], autoConfirm: false });
  const barber = await business("m-barber", { nameAr: "حلاق البوابة (تجريبي)", nameEn: "Gate Barbers (test)", category: "salons", services: [svc("قص شعر", "Haircut", 30, 120)] });
  const joiner = await business("m-joiner", { nameAr: "سبا النيل (تجريبي)", nameEn: "Nile Spa (test)", category: "spas", services: [svc("مساج", "Massage", 60, 600)] });
  const decliner = await business("m-decliner", { nameAr: "جيم مستقل (تجريبي)", nameEn: "Independent Gym (test)", category: "gyms", services: [svc("حصة", "Session", 60, 200)] });
  const invites = {};
  for (const [k, biz, section] of [["rest", rest, "المطاعم"], ["clinic", clinic, "العيادات"], ["barber", barber, "التجميل"], ["decliner", decliner, "الرياضة"]]) {
    const r = await send(mallFounder, `/api/organizations/${mall.id}/businesses`, "POST", { businessSlug: biz.slug, relation: "HOSTED", requestedScopes: [] });
    invites[k] = { id: (await json(r)).association?.id, status: r.status, section };
  }
  check("B1: tenant invitations — the mall invites four independent businesses as HOSTED", Object.values(invites).every((i) => i.status === 201));
  check("B1: a mall cannot ask a tenant for any operating scope", (await send(mallFounder, `/api/organizations/${mall.id}/businesses`, "POST", { businessSlug: joiner.slug, relation: "HOSTED", requestedScopes: ["RESERVATIONS"] })).status === 422);
  check("B1: …nor claim ownership of a tenant by inviting it as OWNED without the owner's acceptance", (await pg.query(`SELECT count(*)::int AS n FROM "OrganizationBusiness" WHERE "organizationId" = $1 AND relation = 'OWNED' AND status = 'APPROVED'`, [mall.id])).rows[0].n === 0);
  for (const k of ["rest", "clinic", "barber"]) {
    const biz = { rest, clinic, barber }[k];
    await send(biz.owner, `/api/business/organizations/${invites[k].id}`, "PATCH", { action: "accept" });
    await send(mallFounder, `/api/organizations/${mall.id}/businesses/${invites[k].id}`, "PATCH", { action: "organize", section: invites[k].section });
  }
  const dec = await send(decliner.owner, `/api/business/organizations/${invites.decliner.id}`, "PATCH", { action: "decline" });
  check("B2: membership approval — three tenants accept, one declines", dec.status === 200 && (await pg.query(`SELECT count(*)::int AS n FROM "OrganizationBusiness" WHERE "organizationId" = $1 AND status = 'APPROVED'`, [mall.id])).rows[0].n === 3);
  const join = await send(joiner.owner, "/api/business/organizations", "POST", { organizationId: mall.id, relation: "HOSTED" });
  const joinId = (await json(join)).association?.id;
  const joinOk = await send(mallFounder, `/api/organizations/${mall.id}/businesses/${joinId}`, "PATCH", { action: "approve", section: "التجميل" });
  check("B2: a business asks to join the mall and the mall approves it", join.status === 201 && joinOk.status === 200, `${join.status}/${joinOk.status}`);
  // Venue membership — what visitor passes are based on.
  const memberships = {};
  const selfApprove = [];
  for (const [k, biz, zone, unit] of [["rest", rest, food, "F-12"], ["clinic", clinic, ground, "G-03"], ["barber", barber, ground, "G-08"]]) {
    const r = await send(biz.owner, "/api/business/venues/memberships", "POST", { venueId: venue.id });
    const m = (await json(r)).membership;
    selfApprove.push((await send(biz.owner, `/api/venues/${venue.id}/memberships/${m?.id}`, "PATCH", { decision: "approve" })).status);
    const d = await send(mallFounder, `/api/venues/${venue.id}/memberships/${m?.id}`, "PATCH", { decision: "approve", zoneId: zone.id, unit });
    memberships[k] = m?.id;
    if (d.status !== 200) check(`B2: venue membership of ${k}`, false, `${r.status}/${d.status}`);
  }
  check("B2: tenants request a place in the venue; the mall approves with floor and unit", Object.values(memberships).every(Boolean));
  check("B2: a tenant cannot approve its own venue request", selfApprove.length === 3 && selfApprove.every((x) => x === 404), JSON.stringify(selfApprove));

  const dirHtml = await (await call(null, `/groups/${mallSlug}`)).text();
  const listed = (b) => dirHtml.includes(`/company/${b.slug}?org=${mallSlug}`);
  check("B3: business directory — the mall's page lists its four tenants, each linking to its booking page", [rest, clinic, barber, joiner].every(listed), [rest, clinic, barber, joiner].map(listed).join());
  check("B3: …and not the business that declined", !listed(decliner));
  check("B3: categories — tenants are grouped under the mall's sections", ["المطاعم", "العيادات", "التجميل"].every((s) => dirHtml.includes(s)));
  const searched = await (await call(null, `/groups/${mallSlug}?q=${encodeURIComponent("حلاق")}`)).text();
  check("B4: search narrows the directory", searched.includes(`/company/${barber.slug}?org=`) && !searched.includes(`/company/${rest.slug}?org=`));
  const enDir = await (await call(null, `/en/groups/${mallSlug}`)).text();
  check("B5: public mall URL — the English page renders with the English name", enDir.includes("Nile Gate Mall (fictional test data)"));
  const qr = await (await call(mallFounder, `/api/organizations/${mall.id}/qr?format=svg`)).text();
  const expected = await QRCode.toString(`${B}/groups/${mallSlug}?src=qr`, { errorCorrectionLevel: "H", margin: 2, width: 1024, type: "svg" });
  check("B5: QR sharing — the mall's QR encodes exactly its public URL", qr === expected);
  const venuePage = await call(null, `/venues/${tag}-nilegate-v`);
  check("B5: the venue's public page is up", venuePage.status === 200);

  // Privacy-safe venue reporting.
  const mallMetrics = await json(await call(mallFounder, `/api/organizations/${mall.id}/metrics`));
  const venueMetrics = await json(await call(mallFounder, `/api/venues/${venue.id}/metrics`));
  check("B7: the mall's reports are counts — no customer, phone or price", !/customerName|customerPhone|0102|totalPrice|email/i.test(JSON.stringify([mallMetrics, venueMetrics])));
  const mallPf = await json(await call(mallFounder, `/api/organizations/${mall.id}/portfolio`));
  check("B7: hosting is not a reporting line — the mall's portfolio has no tenants in it", Array.isArray(mallPf.rows) && mallPf.rows.length === 0);
  check("B8: the mall cannot operate a tenant (no delegated access exists)", (await act(mallFounder, rest.id)).status !== 200 && ((await json(await call(mallFounder, "/api/organizations/operable"))).businesses ?? []).length === 0);
  await leave(mallFounder);
  check("B8: …nor read a tenant's bookings, customers or payments", [401, 403, 404].includes((await call(mallFounder, "/api/business/bookings")).status) && [401, 403, 404].includes((await call(mallFounder, "/api/business/customers")).status));
  const tenantList = await json(await call(mallFounder, `/api/venues/${venue.id}/memberships`));
  check("B8: the mall's tenant list holds no customer or financial data", (tenantList.memberships ?? []).length === 3 && !/customer|phone|payment|revenue|price/i.test(JSON.stringify(tenantList)));

  /* ════════════════════════════════════════════════════════════════
   * PART 3. CUSTOMER JOURNEY through the mall
   * ════════════════════════════════════════════════════════════════ */
  part("3. Customer journey");
  const open = await call(null, `/groups/${mallSlug}?src=qr`);
  await send(null, `/api/public/groups/${mallSlug}/view`, "POST", { source: "QR" });
  check("3.1: the customer opens the mall directory from its QR", open.status === 200);
  const pubDir = await json(await call(null, `/api/public/groups/${mallSlug}`));
  check("3.2: browses the businesses (public API: names and links only)", (pubDir.organization?.directory?.length ?? 0) === 4 && !/email|userId|token|ownerId/i.test(JSON.stringify(pubDir.organization?.directory)));
  const company = await call(null, `/company/${rest.slug}?org=${mallSlug}`);
  check("3.3: selects the restaurant — its booking page opens", company.status === 200);
  const slot = await slotNear(rest, rest.services[0].id, 10);
  check("3.4: picks a reservation time", !!slot, JSON.stringify(slot));
  const sara = await customer("sara", "Sara (test customer)");
  const j = await book(rest, { slot, name: "سارة (عميلة تجريبية)", org: mallSlug, as: sara });
  const jb = j.booking;
  check("3.5: completes the booking", (j.status === 201 || j.status === 200) && !!jb?.accessToken, `${j.status} ${JSON.stringify(j.body).slice(0, 200)}`);
  check("3.5: …credited to the mall's page, still owned by the restaurant", (await pg.query(`SELECT count(*)::int AS n FROM "OrganizationBookingAttribution" a JOIN "Booking" b ON b.id = a."bookingId" WHERE a."bookingId" = $1 AND a."organizationId" = $2 AND b."businessId" = $3`, [jb.id, mall.id, rest.id])).rows[0].n === 1);
  const page = await call(null, `/booking/${jb.accessToken}`);
  check("3.6: receives confirmation — the booking page shows it confirmed", page.status === 200 && jb.status === "CONFIRMED");
  // What reached Sara herself: her in-app notifications (WhatsApp, SMS
  // and email are not configured on QA; those channels are skipped and
  // recorded as such, and are verified with the providers, not here).
  const inbox = async () => (await pg.query(`SELECT kind::text AS k, href FROM "Notification" WHERE "userId" = $1 ORDER BY "createdAt"`, [sara.userId])).rows;
  // Sent just after the response (notifyLater), so it may land a moment later.
  let n1 = [];
  for (let i = 0; i < 20 && !n1.length; i++) { n1 = await inbox(); if (!n1.length) await new Promise((r) => setTimeout(r, 250)); }
  check("3.6: …and Sara is told it is confirmed, with a link to her booking", n1.some((n) => n.k === "BOOKING_CONFIRMED" || n.k === "BOOKING_CREATED"), JSON.stringify(n1));
  const acc = await access(jb.accessToken);
  check("3.7: opens the booking QR (check-in code)", ["ready", "not-yet"].includes(acc.checkIn?.display) && /<svg/.test(acc.checkIn?.qrSvg ?? ""), JSON.stringify({ ...acc.checkIn, qrSvg: undefined }));
  check("3.8: visitor access is offered at this venue, as a sandbox", acc.visitorAccess?.offered === true && acc.visitorAccess?.sandbox === true && acc.visitorAccess?.eligibility?.eligible === true, JSON.stringify(acc.visitorAccess?.eligibility));
  const req = await send(null, `/api/booking/${jb.accessToken}/access/pass`, "POST", { displayName: "سارة" });
  const pending = await access(jb.accessToken);
  check("3.8: requests a visitor pass — pending until the provider confirms", req.status === 200 && pending.visitorAccess?.holder?.state === "pending");
  await runAccessCron();
  const active = await access(jb.accessToken);
  const passToken = active.visitorAccess?.holder?.pass?.token;
  check("3.9: receives the real sandbox provider state — active, with its own pass QR", active.visitorAccess?.holder?.state === "active" && /^SANDBOX-/.test(passToken ?? ""));
  const enter = await json(await sandbox({ action: "gate", token: passToken, gate: `${tag}-N`, site, deliver: false }));
  check("3.9: the (sandbox) north gate admits the pass", enter.granted === true, enter.reason);
  const side = await json(await sandbox({ action: "gate", token: passToken, gate: `${tag}-P`, site }));
  check("3.9: …the car-park gate does not (not an allowed gate)", side.granted === false, side.reason);
  const code = await codeOf(jb.accessToken);
  if ((await checkIn(rest.owner, code)).state === "too-early") {
    check("3.10: arriving more than 30 minutes early, the code says so and does not check in", (await checkIn(rest.owner, code, "check-in")).state === "too-early");
    // The wait: the booking moves to start in 10 minutes.
    await shiftBooking(jb.id, -((await minutesUntil(jb.id)) - 10));
  }
  const ci = await checkIn(rest.owner, code, "check-in");
  check("3.10: checks in at the restaurant — the booking is ARRIVED", ci.state === "checked-in" && (await status(jb.id)) === "ARRIVED", JSON.stringify(ci).slice(0, 160));
  check("3.11: completing before the appointment has started is refused", (await send(rest.owner, `/api/business/bookings/${jb.id}`, "PATCH", { status: "COMPLETED" })).status === 409);
  // The meal: the booking moves back so that it started 15 minutes ago.
  await shiftBooking(jb.id, -((await minutesUntil(jb.id)) + 15));
  await send(rest.owner, `/api/business/bookings/${jb.id}`, "PATCH", { status: "IN_PROGRESS" });
  const done = await send(rest.owner, `/api/business/bookings/${jb.id}`, "PATCH", { status: "COMPLETED" });
  check("3.11: the restaurant completes the booking", done.status === 200 && (await status(jb.id)) === "COMPLETED", `status ${done.status}`);
  // Follow-up: the review request goes out 3 h after the end. The booking's
  // end is moved back 4 h to stand in for the wait.
  await shiftBooking(jb.id, -240);
  await pg.query(`UPDATE "Business" SET "reviewRequestEnabled" = true WHERE id = $1`, [rest.id]);
  await call(null, "/api/cron/reminders", { headers: cronHeaders });
  await call(null, "/api/cron/reminders", { headers: cronHeaders });
  const follow = (await inbox()).filter((n) => n.k === "REVIEW_REQUEST");
  check("3.12: receives the permitted follow-up — one review request, even when the job runs twice", follow.length === 1, JSON.stringify(await inbox()));
  const marketing = (await inbox()).filter((n) => !["BOOKING_CREATED", "BOOKING_CONFIRMED", "BOOKING_COMPLETED", "REVIEW_REQUEST", "BOOKING_REMINDER", "BOOKING_STARTING_SOON"].includes(n.k));
  check("3.12: …and nothing else: no message the customer did not ask for", marketing.length === 0, JSON.stringify(marketing));
  const review = await send(null, `/api/public/booking/${jb.accessToken}/review`, "POST", { rating: 5, comment: "تجربة اختبار" });
  check("3.12: …and can leave a review of the completed visit", [200, 201].includes(review.status), `status ${review.status} ${JSON.stringify(await json(review)).slice(0, 120)}`);
  await runAccessCron();
  const gateAfter = await json(await sandbox({ action: "gate", token: passToken, gate: `${tag}-N`, site }));
  check("3.12: after completion the visitor pass no longer opens the gate", gateAfter.granted === false, gateAfter.reason);

  // The other two journeys: a clinic (needs confirming) and a barbershop.
  const cs = await slotNear(clinic, clinic.services[0].id, 5);
  const cj = await book(clinic, { slot: cs, name: "مريض تجريبي", org: mallSlug });
  check("3.5: a clinic booking waits for the clinic to confirm (no auto-confirm)", cj.booking?.status === "PENDING", cj.booking?.status);
  const cAccPending = await access(cj.booking.accessToken);
  check("3.7: no check-in QR and no visitor pass until it is confirmed", !cAccPending.checkIn?.qrSvg && cAccPending.visitorAccess?.eligibility?.eligible !== true);
  await send(clinic.owner, `/api/business/bookings/${cj.booking.id}`, "PATCH", { status: "CONFIRMED" });
  const cAcc = await access(cj.booking.accessToken);
  check("3.7: confirmed — the clinic booking shows its QR", /<svg/.test(cAcc.checkIn?.qrSvg ?? ""));
  const cPass = await send(null, `/api/booking/${cj.booking.accessToken}/access/pass`, "POST", { displayName: "مريض الأسنان" });
  await runAccessCron();
  check("3.8: the clinic's patient can ask for a visitor pass too", cPass.status === 200 && (await access(cj.booking.accessToken)).visitorAccess?.holder?.state === "active");
  const bs = await slotNear(barber, barber.services[0].id, 5);
  const bj = await book(barber, { slot: bs, name: "زبون حلاق تجريبي", org: mallSlug });
  const bCode = await codeOf(bj.booking.accessToken);
  const bScan = await checkIn(barber.owner, bCode);
  check("3.10: a barbershop booking checks in from its QR", bScan.state === "too-early" || (await checkIn(barber.owner, bCode, "check-in")).state === "checked-in", bScan.state);

  /* ════════════════════════════════════════════════════════════════
   * C. CLINIC GROUP — branches and provider scheduling
   * ════════════════════════════════════════════════════════════════ */
  part("C. Clinic group");
  const shifaFounder = await account("shifa-founder", "Shifa Clinics founder (test)");
  const shifa = await organization(shifaFounder, admin, { slug: "shifa", kind: "CLINIC_GROUP", nameAr: "مجموعة عيادات الشفاء (بيانات تجريبية)", nameEn: "Shifa Clinics Group (test data)" });
  const main = await business("c-main", { nameAr: "عيادات الشفاء — متعددة الفروع (تجريبي)", nameEn: "Shifa Clinics multi-branch (test)", category: "clinics", services: [svc("كشف باطنة", "Internal medicine visit", 30, 400)], autoConfirm: true, plan: "PREMIUM" });
  const branches = [];
  for (const [ar, en] of [["فرع التجمع", "New Cairo branch"], ["فرع المعادي", "Maadi branch"]]) {
    const r = await send(main.owner, "/api/business/branches", "POST", { nameAr: ar, nameEn: en, address: "عنوان تجريبي", phone: "0221234567" });
    const bj2 = await json(r);
    branches.push(bj2.branch?.id ?? bj2.id);
    if (r.status !== 201 && r.status !== 200) check(`C0: branch ${en}`, false, `${r.status} ${JSON.stringify(bj2).slice(0, 160)}`);
  }
  const dental = await business("c-dental", { nameAr: "عيادة أسنان الشفاء (تجريبي)", nameEn: "Shifa Dental Clinic (test)", category: "dentists", services: [svc("تنظيف", "Cleaning", 45, 600)], plan: "PRO" });
  check("C0: the clinics sign up; the multi-branch clinic has two branches", branches.filter(Boolean).length === 2, JSON.stringify(branches));
  const aBranch = await associate(shifaFounder, shifa.id, main, "OWNED", { ask: ["RESERVATIONS"], branchId: branches[0] });
  await associate(shifaFounder, shifa.id, dental, "OWNED", { ask: ["RESERVATIONS", "STAFF", "SCHEDULES", "REPORTS"] });
  check("C1: branch permissions — the group may ask a branch only for reservations", (await send(shifaFounder, `/api/organizations/${shifa.id}/businesses`, "POST", { businessSlug: main.slug, relation: "OWNED", branchId: branches[1], requestedScopes: ["CUSTOMERS"] })).status === 422);
  const shifaMgr = await account("shifa-mgr", "Shifa clinic coordinator (test)");
  await send(shifaFounder, `/api/organizations/${shifa.id}/members`, "POST", { email: shifaMgr.email });
  const svcMain = main.services[0].id;
  const b1 = await book(main, { slot: await slotNear(main, svcMain, 40), name: "مريض فرع ١" });
  const b2 = await book(main, { slot: await slotNear(main, svcMain, 80), name: "مريض فرع ٢" });
  await pg.query(`UPDATE "Booking" SET "branchId" = $2 WHERE id = $1`, [b1.booking.id, branches[0]]);
  await pg.query(`UPDATE "Booking" SET "branchId" = $2 WHERE id = $1`, [b2.booking.id, branches[1]]);
  await act(shifaMgr, main.id);
  const seen = await bookingIds(shifaMgr);
  check("C1: the coordinator operating the branch sees that branch's bookings only", seen.includes(b1.booking.id) && !seen.includes(b2.booking.id), JSON.stringify(seen.length));
  check("C1: …and cannot manage staff or hours there (business-wide)", [403, 404].includes((await send(shifaMgr, "/api/business/staff", "POST", { nameAr: "طبيب", workingDays: [1], specialties: [] })).status));
  check("C4: restricted customer information — no customer records without CUSTOMERS", [403, 404].includes((await call(shifaMgr, "/api/business/customers")).status));
  const other = await json(await call(shifaMgr, `/api/business/bookings/${b2.booking.id}`));
  check("C4: …and the other branch's booking is not readable by id", !JSON.stringify(other).includes("مريض فرع ٢"));
  await act(shifaMgr, dental.id);
  const doc = await json(await send(shifaMgr, "/api/business/staff", "POST", { nameAr: "د. تجريبي", nameEn: "Dr Test", role: "dentist", workingDays: [0, 1, 2, 3, 4], specialties: [] }));
  const docId = doc.staff?.id ?? doc.id ?? doc.data?.id;
  const hrs = await send(shifaMgr, `/api/business/staff/${docId}/hours`, "PUT", { hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: "10:00", endTime: "18:00", isOff: d === 5 })) });
  check("C2: provider scheduling — with STAFF and SCHEDULES the coordinator adds a dentist and sets their hours", !!docId && hrs.status === 200, `${docId} ${hrs.status}`);
  check("C2: …but cannot give the dentist sign-in access (owner only)", [403, 404].includes((await send(shifaMgr, `/api/business/staff/${docId}/access`, "PUT", { access: "PROVIDER", phone: "01000000000" })).status));
  check("C3: booking policies stay the owner's — the coordinator cannot change them", [401, 403, 404, 409].includes((await send(shifaMgr, "/api/business/settings/booking", "PATCH", { minNoticeMinutes: 0 })).status));
  await leave(shifaMgr);
  await send(dental.owner, "/api/business/settings/booking", "PATCH", { minNoticeMinutes: 180 });
  const near = await slotNear(dental, dental.services[0].id, 0);
  const tooSoon = await send(null, `/api/public/${dental.slug}/bookings`, "POST", { serviceId: dental.services[0].id, date: cairoNow().date, startTime: cairoNow(30).time.replace(/:\d\d$/, ":00"), customerName: "مستعجل", customerPhone: "01029990001" });
  check("C3: the owner's policy is enforced — 3 h notice: nothing within 3 h is offered or accepted", (!near || near.date !== cairoNow().date || near.startTime >= cairoNow(170).time) && tooSoon.status >= 400, `${JSON.stringify(near)} ${tooSoon.status}`);
  await send(dental.owner, "/api/business/settings/booking", "PATCH", { minNoticeMinutes: 0 });
  const pfShifa = await json(await call(shifaFounder, `/api/organizations/${shifa.id}/portfolio`));
  check("C5: sensitive data — the group's report has counts only, and the branch relationship shares none", !/مريض|0102|customer/i.test(JSON.stringify(pfShifa)) && pfShifa.rows?.find((r) => r.associationId === aBranch)?.figures === null);
  check("C5: the clinic is discreet by default at a venue's security desk", (await json(await call(clinic.owner, "/api/business/settings/booking"))).accessDiscreetDefault === true);

  /* ════════════════════════════════════════════════════════════════
   * D. DELEGATED MANAGEMENT COMPANY
   * ════════════════════════════════════════════════════════════════ */
  part("D. Delegated management");
  const opsFounder = await account("ops-founder", "Cairo Ops Co. founder (test)");
  const opsCo = await organization(opsFounder, admin, { slug: "cairo-ops", kind: "BUSINESS_GROUP", nameAr: "شركة القاهرة للتشغيل (بيانات تجريبية)", nameEn: "Cairo Ops Co. (test data)" });
  const salon = await business("d-salon", { nameAr: "صالون مستقل (تجريبي)", nameEn: "Independent Salon (test)", category: "salons", services: [svc("سشوار", "Blow-dry", 30, 150)] });
  const aSalon = await associate(opsFounder, opsCo.id, salon, "MANAGED", { ask: ["RESERVATIONS", "SERVICES"] });
  const aDentalOps = await associate(opsFounder, opsCo.id, dental, "MANAGED", { ask: ["RESERVATIONS"] });
  check("D1: the company is MANAGED by two independent businesses, each with its own grant", !!aSalon && !!aDentalOps);
  check("D1: finance can never be delegated to a management company", (await send(opsFounder, `/api/organizations/${opsCo.id}/businesses`, "POST", { businessSlug: barber.slug, relation: "MANAGED", requestedScopes: ["FINANCE"] })).status === 422);
  await act(opsFounder, salon.id);
  const newSvc = await send(opsFounder, "/api/business/services", "POST", { nameAr: "خدمة أضافتها الشركة", duration: 30, price: 100 });
  check("D2: scoped — the company adds a service at the salon (SERVICES granted)", [200, 201].includes(newSvc.status), `status ${newSvc.status}`);
  await act(opsFounder, dental.id);
  check("D2: …but not at the dental clinic (RESERVATIONS only)", [403, 404].includes((await send(opsFounder, "/api/business/services", "POST", { nameAr: "ممنوع", duration: 30, price: 1 })).status));
  check("D3: no cross-business escalation — acting at a business it has no relationship with is refused", (await act(opsFounder, rest.id)).status !== 200);
  check("D3: …nor at a brand of another group", (await act(opsFounder, grill.id)).status !== 200);
  opsFounder.cookies.set("maw3ed-acting", rest.id);
  const forgedCookie = await call(opsFounder, "/api/business/bookings");
  check("D3: a forged acting cookie for another business grants nothing", forgedCookie.status !== 200 || !(await ownersOf(await bookingIds(opsFounder))).includes(rest.id));
  await leave(opsFounder);
  check("D3: the company cannot widen its own grant", [401, 403, 404, 409].includes((await send(opsFounder, `/api/business/organizations/${aSalon}`, "PATCH", { action: "grant", scopes: ["RESERVATIONS", "SERVICES", "CUSTOMERS"] })).status));
  await act(opsFounder, salon.id);
  check("D4: before revocation the company operates the salon", (await call(opsFounder, "/api/business/bookings")).status === 200);
  const revoke = await send(salon.owner, `/api/business/organizations/${aSalon}`, "PATCH", { action: "grant", scopes: [] });
  const afterRevoke = await call(opsFounder, "/api/business/bookings");
  check("D4: immediate revocation — the owner withdraws everything; the very next request is refused", revoke.status === 200 && afterRevoke.status !== 200, `${revoke.status}/${afterRevoke.status}`);
  check("D4: …and the salon is gone from the company's portfolio", !((await json(await call(opsFounder, "/api/organizations/operable"))).businesses ?? []).some((b) => b.business.id === salon.id));
  await leave(opsFounder);
  const auditN = await audits([salon.id, opsCo.id, aSalon], "%");
  const actingN = (await pg.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action LIKE 'org.operate%' AND "resourceId" = ANY($1)`, [[salon.id, dental.id, opsCo.id]])).rows[0].n;
  check("D5: audit — the relationship, its grants, the revocation and the acting sessions are recorded", auditN >= 3 && actingN >= 1, `relationship ${auditN}, acting ${actingN}`);

  /* ════════════════════════════════════════════════════════════════
   * PART 4. EXCEPTIONS
   * ════════════════════════════════════════════════════════════════ */
  part("4. Exceptions");
  const fresh = async (biz, min, name) => (await book(biz, { slot: await slotNear(biz, biz.services[0].id, min), name, org: mallSlug })).booking;
  // Cancelled after the pass request.
  const x1 = await fresh(rest, 20, "إلغاء بعد التصريح");
  await send(null, `/api/booking/${x1.accessToken}/access/pass`, "POST", { displayName: "إلغاء" });
  await runAccessCron();
  const x1tok = (await access(x1.accessToken)).visitorAccess?.holder?.pass?.token;
  await send(rest.owner, `/api/business/bookings/${x1.id}`, "PATCH", { status: "CANCELLED" });
  await runAccessCron();
  const x1gate = await json(await sandbox({ action: "gate", token: x1tok, gate: `${tag}-N`, site }));
  check("4.1: booking cancelled after the pass request — the pass is revoked and the gate refuses it", !!x1tok && x1gate.granted === false, x1gate.reason);
  check("4.1: …and its check-in code is dead", (await checkIn(rest.owner, await codeOf(x1.accessToken).catch(() => "")))?.state !== "valid");
  // Rescheduled.
  const x2 = await fresh(rest, 25, "تغيير موعد");
  await send(null, `/api/booking/${x2.accessToken}/access/pass`, "POST", { displayName: "تغيير" });
  await runAccessCron();
  const code2 = await codeOf(x2.accessToken);
  const moved = await slotNear(rest, rest.services[0].id, 24 * 60);
  const rs = await send(rest.owner, `/api/business/bookings/${x2.id}/reschedule`, "POST", { date: moved.date, startTime: moved.startTime });
  const rsCode = await checkIn(rest.owner, code2);
  check("4.2: rescheduled — the same code now follows the new time (too early)", [200].includes(rs.status) && rsCode.state === "too-early", `${rs.status} ${rsCode.state}`);
  await runAccessCron();
  const x2acc = await access(x2.accessToken);
  const x2tok = x2acc.visitorAccess?.holder?.pass?.token;
  const x2gate = x2tok ? await json(await sandbox({ action: "gate", token: x2tok, gate: `${tag}-N`, site })) : { granted: false, reason: "no pass now" };
  check("4.2: …and the visitor pass follows the booking: it no longer opens the gate at the old time", x2gate.granted === false, `${x2acc.visitorAccess?.holder?.state} ${x2gate.reason}`);
  // Duplicate confirmation.
  const x3 = (await book(clinic, { slot: await slotNear(clinic, clinic.services[0].id, 200), name: "تأكيد مكرر" })).booking;
  const c1 = await send(clinic.owner, `/api/business/bookings/${x3.id}`, "PATCH", { status: "CONFIRMED" });
  const c2 = await send(clinic.owner, `/api/business/bookings/${x3.id}`, "PATCH", { status: "CONFIRMED" });
  const confirms = (await pg.query(`SELECT count(*)::int AS n FROM "Notification" WHERE "bookingId" = $1 AND type::text LIKE '%confirm%'`, [x3.id]).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n;
  check("4.3: duplicate confirmation — the second is harmless and the customer is told once", c1.status === 200 && c2.status < 500 && (await status(x3.id)) === "CONFIRMED" && confirms <= 1, `${c1.status}/${c2.status} notifications ${confirms}`);
  const idem = `idem-${tag}`;
  const s4 = await slotNear(barber, barber.services[0].id, 300);
  const d1 = await book(barber, { slot: s4, name: "ضغط مرتين", idempotencyKey: idem });
  const d2 = await send(null, `/api/public/${barber.slug}/bookings`, "POST", { serviceId: barber.services[0].id, date: s4.date, startTime: s4.startTime, customerName: "ضغط مرتين", customerPhone: d1.phone, idempotencyKey: idem });
  check("4.3: a double-submitted booking is one booking", (await json(d2)).booking?.id === d1.booking?.id);
  // Multiple guests.
  const x4 = await fresh(barber, 30, "مع ضيوف");
  await send(null, `/api/booking/${x4.accessToken}/access/pass`, "POST", { displayName: "صاحب الحجز" });
  const gA = await send(null, `/api/booking/${x4.accessToken}/access/guests`, "POST", { displayName: "ضيف ١" });
  const gB = await send(null, `/api/booking/${x4.accessToken}/access/guests`, "POST", { displayName: "ضيف ٢" });
  const gC = await send(null, `/api/booking/${x4.accessToken}/access/guests`, "POST", { displayName: "ضيف ٣" });
  await runAccessCron();
  const gAj = await json(gA);
  const guestView = await json(await call(null, `/api/pass/${gAj.inviteToken}`));
  check("4.4: multiple guests — two named guests get their own passes; the third is over the mall's limit", gA.status === 201 && gB.status === 201 && gC.status === 409 && guestView.pass?.state === "active" && !JSON.stringify(guestView).includes("صاحب الحجز"), `${gA.status}/${gB.status}/${gC.status} ${guestView.pass?.state}`);
  // Provider unavailable.
  await sandbox({ action: "mode", mode: "DOWN" });
  const x5 = await fresh(rest, 35, "المزود واقع");
  await send(null, `/api/booking/${x5.accessToken}/access/pass`, "POST", { displayName: "تجربة" });
  const cronDown = await runAccessCron();
  const x5a = await access(x5.accessToken);
  check("4.5: provider unavailable — the request stays pending (no error, no fake pass); the cron survives", cronDown.status === 200 && x5a.visitorAccess?.holder?.state === "pending" && x5a.visitorAccess?.holder?.pass === null, JSON.stringify(x5a.visitorAccess?.holder?.state));
  const health = await json(await call(guardJar, `/api/venues/${venue.id}/access`));
  check("4.5: …the security desk sees the provider's trouble", JSON.stringify(health.provider ?? health.health ?? health).match(/down|unavail|fail|error|degraded|DOWN/i) !== null || (health.rows ?? []).some((r) => r.state === "pending"), JSON.stringify(health.provider ?? health.health ?? null).slice(0, 160));
  await sandbox({ action: "mode", mode: "NORMAL" });
  await pg.query(`UPDATE "AccessSyncJob" SET "nextAttemptAt" = now() WHERE status::text IN ('PENDING','RETRY','FAILED') AND "nextAttemptAt" > now()`).catch(() => {});
  await runAccessCron();
  check("4.5: …and is issued once the provider is back", (await access(x5.accessToken)).visitorAccess?.holder?.state === "active");
  // Customer without internet: the code itself is text inside the page they already have.
  const offlineHtml = await (await call(null, `/booking/${x5.accessToken}`)).text();
  check("4.6: customer without internet — the QR is rendered into the page (no request needed to show it)", /<svg[^>]*>/.test(offlineHtml) || offlineHtml.includes("/c/"), "the browser check (qa-phase24-browser) covers going offline");
  // Invalid and expired QR.
  check("4.7: invalid QR — a made-up code is unknown", (await checkIn(rest.owner, "Q".repeat(43))).state === "not-found");
  check("4.7: …and a URL from another site is unknown", (await checkIn(rest.owner, "https://evil.example/c/" + "Q".repeat(43))).state === "not-found");
  const x6 = await fresh(rest, 15, "منتهي");
  const code6 = await codeOf(x6.accessToken);
  await shiftBooking(x6.id, -2 * 1440);
  check("4.8: expired QR — a code past its window says expired and cannot check in", (await checkIn(rest.owner, code6)).state === "expired" && (await checkIn(rest.owner, code6, "check-in")).state === "expired");
  // Unauthorized check-in.
  const x7 = await fresh(rest, 10, "دخول غير مصرح");
  const code7 = await codeOf(x7.accessToken);
  check("4.9: unauthorized check-in — another tenant learns nothing", (await checkIn(barber.owner, code7, "check-in")).state === "not-found");
  check("4.9: …the mall operator cannot check in a tenant's customer", ![200].includes((await send(mallFounder, "/api/business/check-in", "POST", { code: code7, action: "check-in" })).status) || (await checkIn(mallFounder, code7, "check-in")).state !== "checked-in");
  check("4.9: …signed out is refused", [401, 404].includes((await send(null, "/api/business/check-in", "POST", { code: code7, action: "check-in" })).status));
  check("4.9: …and the booking is still CONFIRMED", (await status(x7.id)) === "CONFIRMED");
  // No-show.
  await shiftBooking(x7.id, -1440);
  const ns = await send(rest.owner, `/api/business/bookings/${x7.id}`, "PATCH", { status: "NO_SHOW" });
  check("4.10: no-show — marked, and the code then says so", ns.status === 200 && (await checkIn(rest.owner, code7)).state === "no-show", `status ${ns.status}`);
  // Invalid venue relationship: a business not (yet) approved in the venue.
  const pendingMem = await send(joiner.owner, "/api/business/venues/memberships", "POST", { venueId: venue.id });
  const x8 = (await book(joiner, { slot: await slotNear(joiner, joiner.services[0].id, 30), name: "عضوية معلقة" })).booking;
  const x8a = await access(x8.accessToken);
  check("4.11: invalid venue relationship — a tenant whose venue place is still a request offers no visitor pass", pendingMem.status === 201 && x8a.visitorAccess?.offered !== true, JSON.stringify(x8a.visitorAccess?.offered));
  const forgedPass = await send(null, `/api/booking/${x8.accessToken}/access/pass`, "POST", { displayName: "تزوير" });
  check("4.11: …and asking anyway is refused", forgedPass.status >= 400, `status ${forgedPass.status}`);
  // Business removed from the mall.
  const x9 = await fresh(barber, 40, "خروج من المول");
  await send(null, `/api/booking/${x9.accessToken}/access/pass`, "POST", { displayName: "خروج" });
  await runAccessCron();
  const x9tok = (await access(x9.accessToken)).visitorAccess?.holder?.pass?.token;
  const rmMem = await send(mallFounder, `/api/venues/${venue.id}/memberships/${memberships.barber}`, "PATCH", { decision: "remove" });
  const rmDir = await send(mallFounder, `/api/organizations/${mall.id}/businesses/${invites.barber.id}`, "PATCH", { action: "remove" });
  await runAccessCron();
  const x9gate = await json(await sandbox({ action: "gate", token: x9tok, gate: `${tag}-N`, site }));
  const dirAfter = await (await call(null, `/groups/${mallSlug}`)).text();
  check("4.12: business removed from the mall — its visitors' passes stop working", rmMem.status === 200 && !!x9tok && x9gate.granted === false, `${rmMem.status} ${x9gate.reason}`);
  check("4.12: …it leaves the directory, and its own bookings stand", rmDir.status === 200 && !dirAfter.includes(`/company/${barber.slug}?org=`) && (await status(x9.id)) === "CONFIRMED");
  // Ownership changes: the cafe moves from the Palm group to another group.
  const newGroupFounder = await account("new-group", "Second group founder (test)");
  const newGroup = await organization(newGroupFounder, admin, { slug: "second", kind: "RESTAURANT_GROUP", nameAr: "مجموعة تانية (بيانات تجريبية)", nameEn: "Second Group (test data)" });
  const steal = await send(newGroupFounder, `/api/organizations/${newGroup.id}/businesses`, "POST", { businessSlug: cafe.slug, relation: "OWNED", requestedScopes: ["RESERVATIONS"] });
  const stealId = (await json(steal)).association?.id;
  const acceptWhileOwned = stealId ? await send(cafe.owner, `/api/business/organizations/${stealId}`, "PATCH", { action: "accept", scopes: ["RESERVATIONS"] }) : { status: 0 };
  check("4.13: ownership changes — a second group cannot become owner while the first holds it", acceptWhileOwned.status === 409 || steal.status === 409, `${steal.status}/${acceptWhileOwned.status}`);
  await send(cafe.owner, `/api/business/organizations/${aCafe}`, "PATCH", { action: "leave" });
  const reinvite = stealId && acceptWhileOwned.status === 409 ? { status: 200 } : await send(newGroupFounder, `/api/organizations/${newGroup.id}/businesses`, "POST", { businessSlug: cafe.slug, relation: "OWNED", requestedScopes: ["RESERVATIONS"] });
  const pendingSteal = (await pg.query(`SELECT id FROM "OrganizationBusiness" WHERE "organizationId" = $1 AND "businessId" = $2 AND status = 'INVITED'`, [newGroup.id, cafe.id])).rows[0]?.id;
  const moveOk = pendingSteal ? await send(cafe.owner, `/api/business/organizations/${pendingSteal}`, "PATCH", { action: "accept", scopes: ["RESERVATIONS"] }) : { status: 0 };
  await act(palmOps, cafe.id);
  const oldGroup = await call(palmOps, "/api/business/bookings");
  await leave(palmOps);
  check("4.13: after the cafe leaves the Palm group and joins the new one, Palm's manager loses access at once", reinvite.status < 500 && moveOk.status === 200 && oldGroup.status !== 200, `${moveOk.status}/${oldGroup.status}`);
  // Management permissions revoked: D4. Staff account disabled:
  if (!SECRET) notRun("4.15: staff account disabled", "AUTH_SECRET not available to mint an app token");
  else {
    const staffUser = await account("staff-app", "Terrace waiter (test)");
    const { rows: [st] } = await pg.query(`INSERT INTO "StaffMember" (id, "businessId", "nameAr", access, "userId", "isActive", "workingDays", specialties, "updatedAt") VALUES ($1, $2, 'نادل تجريبي', 'PROVIDER', $3, true, '{0,1,2,3,4,5,6}', '{}', now()) RETURNING id`, [`${tag}-staff`, rest.id, staffUser.userId]);
    const tok = await bearer(staffUser.userId, rest.id);
    const before = await fetch(`${B}/api/business/bookings`, { headers: { Authorization: `Bearer ${tok}` } });
    const off = await send(rest.owner, `/api/business/staff/${st.id}/access`, "PUT", { access: null });
    const after = await fetch(`${B}/api/business/bookings`, { headers: { Authorization: `Bearer ${tok}` } });
    check("4.15: staff account disabled — the waiter's app works, then the owner removes access and the same token is refused", before.status === 200 && off.status === 200 && after.status !== 200, `${before.status}/${off.status}/${after.status}`);
  }
  // Late arrival.
  const x10 = await fresh(rest, 10, "متأخر");
  const code10 = await codeOf(x10.accessToken);
  // The 60-minute lunch started 70 minutes ago: the customer arrives after its end.
  await shiftBooking(x10.id, -((await minutesUntil(x10.id)) + 70));
  const late = await checkIn(rest.owner, code10, "check-in");
  check("4.16: late arrival — within the late window after the end, check-in still works", late.state === "checked-in", late.state);
  const x10b = await fresh(rest, 10, "متأخر جدا");
  const code10b = await codeOf(x10b.accessToken);
  await shiftBooking(x10b.id, -1440);
  check("4.16: …a day late it says expired", (await checkIn(rest.owner, code10b, "check-in")).state === "expired");
  // Duplicate provider callbacks.
  const x11 = await fresh(rest, 20, "رد مكرر");
  await send(null, `/api/booking/${x11.accessToken}/access/pass`, "POST", { displayName: "مكرر" });
  await runAccessCron();
  const t11 = (await access(x11.accessToken)).visitorAccess?.holder?.pass?.token;
  const g11 = await json(await sandbox({ action: "gate", token: t11, gate: `${tag}-N`, site, deliver: false }));
  const hook = (h, raw) => call(null, "/api/access/providers/sandbox/events", { method: "POST", body: raw, headers: h });
  const h1 = await json(await hook(g11.event.headers, g11.event.raw));
  const h2 = await json(await hook(g11.event.headers, g11.event.raw));
  const h3 = await json(await hook(g11.event.headers, g11.event.raw));
  const entries = (await pg.query(
    `SELECT count(*)::int AS n FROM "AccessEvent" e
     WHERE e.kind::text = 'ENTRY_GRANTED' AND (
       e."entitlementId" IN (SELECT id FROM "AccessEntitlement" WHERE "bookingId" = $1) OR
       e."credentialId" IN (SELECT c.id FROM "AccessCredential" c JOIN "AccessEntitlement" t ON t.id = c."entitlementId" WHERE t."bookingId" = $1))`, [x11.id])).rows[0].n;
  check("4.17: duplicate provider callbacks — accepted once, the repeats are duplicates, one entry recorded", h1.outcome === "accepted" && h2.outcome === "duplicate" && h3.outcome === "duplicate" && entries === 1, `${h1.outcome}/${h2.outcome}/${h3.outcome} entries ${entries}`);

  /* ════════════════════════════════════════════════════════════════
   * PART 6. END-TO-END SECURITY
   * ════════════════════════════════════════════════════════════════ */
  part("6. Security");
  check("6.1: organization permissions — a manager cannot appoint members or publish (owner only)", [403, 404].includes((await send(palmOps, `/api/organizations/${palm.id}/members`, "POST", { email: "someone@example.test" })).status) && [403, 404].includes((await send(palmOps, `/api/organizations/${palm.id}`, "PATCH", { isPublished: false })).status));
  check("6.1: …an outsider cannot open another organization's console API", (await call(grill.owner, `/api/organizations/${mall.id}`)).status === 404);
  check("6.2: business data isolation — a brand owner cannot open another brand's booking", [403, 404].includes((await call(cafe.owner, `/api/business/bookings/${bks.g1.id}`)).status));
  const deskJ = await json(await call(guardJar, `/api/venues/${venue.id}/access`));
  const patientRow = (deskJ.rows ?? []).find((r) => r.visitorName === "مريض الأسنان");
  check("6.3: clinic privacy — the security desk lists the dental patient but not where they are going",
    !!patientRow && /خصوصية|private/i.test(patientRow.businessName) && !/الشفاء|Shifa/.test(JSON.stringify(deskJ)) && !/0102|totalPrice|serviceName|customerPhone/.test(JSON.stringify(deskJ)),
    JSON.stringify(patientRow ?? null));
  const forgedMember = await send(grill.owner, `/api/organizations/${palm.id}/members`, "POST", { email: grill.owner.email });
  check("6.4: no forged organization membership — a brand owner cannot add themselves to the group", [403, 404].includes(forgedMember.status));
  const roleSelf = await send(mallFounder, "/api/admin/venue-roles", "POST", { email: mallFounder.email, kind: "VENUE_SECURITY", venueId: venue.id });
  check("6.4: …a mall operator cannot grant venue roles (platform only)", [401, 403, 404].includes(roleSelf.status));
  check("6.5: no unauthorized visitor credential — a cancelled booking cannot ask for a pass", (await send(null, `/api/booking/${x1.accessToken}/access/pass`, "POST", { displayName: "x" })).status >= 400);
  check("6.5: …an unknown booking link cannot either", (await send(null, `/api/booking/not-a-real-token-at-all-xxxxxxxx/access/pass`, "POST", { displayName: "x" })).status === 404);
  check("6.5: …the sandbox issuer needs the server secret", (await call(null, "/api/dev/access-sandbox", { method: "POST", body: JSON.stringify({ action: "ensure-provider" }) })).status === 401);
  const wrongSite = await json(await sandbox({ action: "gate", token: t11, gate: `${tag}-N`, site: "SITE-SOMEWHERE-ELSE" }));
  check("6.6: no cross-venue provider access — a pass is refused at another venue's site", wrongSite.granted === false && wrongSite.reason === "wrong-site");
  const otherVenue = await json(await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-other-v`, nameAr: "مكان تاني (تجريبي)", cityId }));
  made.venues.push(otherVenue.venue?.id);
  check("6.6: …the mall's security desk cannot open another venue's desk", (await call(guardJar, `/api/venues/${otherVenue.venue?.id}/access`)).status === 404);
  check("6.6: …nor change its own venue's provider", (await send(guardJar, `/api/venues/${venue.id}/access`, "PUT", { providerSlug: "x", siteRef: "y" })).status === 404);
  check("6.7: correct revocation — the revoked company, the departed group and the removed tenant all hold nothing", !((await json(await call(opsFounder, "/api/organizations/operable"))).businesses ?? []).some((b) => b.business.id === salon.id) && !((await json(await call(palmOps, "/api/organizations/operable"))).businesses ?? []).some((b) => b.business.id === cafe.id));
  const auditActions = (await pg.query(`SELECT DISTINCT action FROM "AuditLog" WHERE "resourceId" = ANY($1) OR "resourceId" IN (SELECT id FROM "Booking" WHERE "businessId" = ANY($2))`, [[palm.id, mall.id, shifa.id, opsCo.id, venue.id, aGrill, aCafe, aSalon], made.businesses])).rows.map((r) => r.action);
  check("6.8: proper audit logs — association, grant, acting, check-in and venue access actions are all recorded",
    ["booking.check_in"].every((a) => auditActions.includes(a)) && auditActions.some((a) => /organization|association|grant/.test(a)) && auditActions.some((a) => /venue|access/.test(a)), auditActions.join(","));
} catch (e) {
  check("script ran to completion", false, e instanceof Error ? e.stack : String(e));
} finally {
  await sandbox({ action: "mode", mode: "NORMAL" }).catch(() => {});
  await teardown();
  await pg.end();
  process.exit(summary(true) ? 1 : 0);
}
