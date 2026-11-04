/**
 * Phase 27 end to end, over HTTP against a running server: loyalty
 * (earn on completion, spend only with a proven number, give back on
 * cancel), packages and memberships sold at the desk and used by online
 * bookings, the slot waitlist (join, offer by the operations cron,
 * accept), the no-show policy, walk-ins, recurring series, the
 * operations report, marketing consent, an organization program that
 * reaches owned brands only, and who may call what.
 *
 *   node scripts/qa-phase27.mjs [http://localhost:3101]
 *
 * Fictional data made through the product's APIs, removed at the end.
 */
import {
  pg, part, check, login, call, send, json, account, customer, business, organization, associate,
  slotNear, shiftBooking, minutesUntil, book, teardown, summary, made, cronHeaders,
} from "./qa-phase24-lib.mjs";

const svc = (nameAr, nameEn, duration, price) => ({ nameAr, nameEn, duration, price });
const data = (b) => b.data ?? b;
let failedHard = 0;

try {

  const admin = await login("admin@qa.test");

  // ── Set up ───────────────────────────────────────────────────────────
  part("setup");
  const salon = await business("p27-salon", {
    nameAr: "صالون تجريبي ٢٧", nameEn: "Test Salon 27", category: "salons",
    services: [svc("قص شعر", "Haircut", 30, 200), svc("صبغة", "Colour", 60, 400)],
  });
  const other = await business("p27-other", { nameAr: "نشاط آخر ٢٧", nameEn: "Other 27", category: "salons", services: [svc("قص", "Cut", 30, 150)] });
  const cust = await customer("p27-a", "Customer A (test)");
  await pg.query(`UPDATE "User" SET "phoneVerifiedAt" = now() WHERE id = $1`, [cust.userId]);
  check("businesses and a verified customer exist", !!salon.id && !!other.id && !!cust.phone);
  const [haircut, colour] = salon.services;

  // ── Loyalty ──────────────────────────────────────────────────────────
  part("loyalty");
  const prog = await send(salon.owner, "/api/business/loyalty", "PUT", {
    nameAr: "نقاط الصالون", isActive: true, pointsPerVisit: 100, pointsPer100Egp: 0,
    redeemPoints: 100, redeemValueCents: 5000, maxRedeemPercent: 50, expiryDays: 365, dailyEarnCap: 2,
  });
  check("the owner creates a loyalty program", prog.status === 200, prog.status);
  const badProg = await send(salon.owner, "/api/business/loyalty", "PUT", { nameAr: "x", isActive: true, pointsPerVisit: -1 });
  check("out-of-bounds rules are refused", badProg.status === 422, badProg.status);

  let slot = await slotNear(salon, haircut.id, 60);
  const first = await book(salon, { serviceId: haircut.id, slot, as: cust });
  check("the customer books", first.status === 201, `${first.status} ${JSON.stringify(first.body).slice(0, 120)}`);
  await shiftBooking(first.booking.id, -120);
  const done = await send(salon.owner, `/api/business/bookings/${first.booking.id}`, "PATCH", { status: "COMPLETED" });
  check("the owner completes the visit", done.status === 200, done.status);
  const again = await send(salon.owner, `/api/business/bookings/${first.booking.id}`, "PATCH", { status: "COMPLETED" });
  check("completing twice is refused (no second earn)", again.status !== 200, again.status);
  const w1 = data(await json(await call(cust, "/api/account/wallet")));
  const acct = (w1.loyalty ?? []).find((a) => a.programName === "نقاط الصالون");
  check("the wallet shows 100 points earned", acct?.available === 100, JSON.stringify(acct));

  slot = await slotNear(salon, colour.id, 180);
  const usable = data(await json(await call(cust, `/api/account/wallet?slug=${salon.slug}&serviceId=${colour.id}&date=${slot.date}&time=${slot.startTime}`)));
  check("the booking page is told the points can take 50 EGP off", usable.usable?.loyalty?.maxOffCents === 5000, JSON.stringify(usable.usable));

  // A guest typing the same number cannot spend them.
  const guest = await send(null, `/api/public/${salon.slug}/bookings`, "POST", {
    serviceId: colour.id, date: slot.date, startTime: slot.startTime, customerName: "Impostor", customerPhone: cust.phone, redeemPoints: 100,
  });
  check("a guest typing the number cannot spend its points", guest.status === 403 && (await json(guest)).code === "phone-unverified", guest.status);
  const spend = await send(cust, `/api/public/${salon.slug}/bookings`, "POST", {
    serviceId: colour.id, date: slot.date, startTime: slot.startTime, customerName: "Customer A", customerPhone: cust.phone, redeemPoints: 100,
  });
  const spent = data(await json(spend));
  check("the signed-in customer spends 100 points for 50 EGP off", spend.status === 201 && Number(spent.booking?.totalPrice) === 350, `${spend.status} ${JSON.stringify(spent).slice(0, 160)}`);
  const w2 = data(await json(await call(cust, "/api/account/wallet")));
  check("the balance is now 0", (w2.loyalty ?? []).find((a) => a.programName === "نقاط الصالون")?.available === 0);
  const cancel = await send(salon.owner, `/api/business/bookings/${spent.booking?.id}`, "PATCH", { status: "CANCELLED" });
  check("the owner cancels that booking", cancel.status === 200, cancel.status);
  const w3 = data(await json(await call(cust, "/api/account/wallet")));
  check("the points come back on cancel", (w3.loyalty ?? []).find((a) => a.programName === "نقاط الصالون")?.available === 100);

  const look = data(await json(await call(salon.owner, `/api/business/loyalty/customer?phone=${cust.phone}`)));
  check("the owner sees the customer's ledger", look.available === 100 && (look.entries ?? []).length >= 3, JSON.stringify(look).slice(0, 160));
  const key = `qa-${Date.now()}`;
  const adj = await Promise.all([1, 2].map(() => send(salon.owner, "/api/business/loyalty/customer", "POST", { phone: cust.phone, points: 25, note: "تعويض تجريبي", key })));
  const applied = await Promise.all(adj.map(async (r) => data(await json(r)).applied));
  check("a double-submitted correction applies once", applied.filter((n) => n === 25).length === 1, JSON.stringify(applied));

  // ── Packages and memberships ─────────────────────────────────────────
  part("packages");
  const plan = data(await json(await send(salon.owner, "/api/business/packages", "POST", {
    nameAr: "باقة ٣ قصات", serviceIds: [haircut.id], sessions: 3, priceCents: 45000, validityDays: 60,
  }))).plan;
  check("the owner creates a package plan", !!plan?.id);
  const sale = await send(salon.owner, "/api/business/packages/sell", "POST", { kind: "package", planId: plan.id, phone: cust.phone, customerName: "Customer A", method: "CASH" });
  const sold = data(await json(sale));
  check("the desk sells it with a receipt", sale.status === 201 && /^MW-/.test(sold.receiptNumber ?? ""), `${sale.status} ${JSON.stringify(sold)}`);
  slot = await slotNear(salon, haircut.id, 300);
  const pkgBook = await send(cust, `/api/public/${salon.slug}/bookings`, "POST", {
    serviceId: haircut.id, date: slot.date, startTime: slot.startTime, customerName: "Customer A", customerPhone: cust.phone, usePackageId: sold.id,
  });
  const pb = data(await json(pkgBook));
  check("an online booking uses a session at no charge", pkgBook.status === 201 && Number(pb.booking?.totalPrice) === 0, `${pkgBook.status} ${JSON.stringify(pb).slice(0, 160)}`);
  const pkgRow = (await pg.query(`SELECT "sessionsUsed" FROM "CustomerPackage" WHERE id = $1`, [sold.id])).rows[0];
  check("one session is used", pkgRow?.sessionsUsed === 1);
  const wrongSvc = await send(cust, `/api/public/${salon.slug}/bookings`, "POST", {
    serviceId: colour.id, date: slot.date, startTime: (await slotNear(salon, colour.id, 420)).startTime, customerName: "Customer A", customerPhone: cust.phone, usePackageId: sold.id,
  });
  check("the package does not cover another service", wrongSvc.status === 409 && (await json(wrongSvc)).code === "entitlement-gone", wrongSvc.status);
  const refuse = await send(salon.owner, `/api/business/packages/sold/${sold.id}`, "POST", { kind: "package", action: "refund", amountCents: 30000, reason: "QA test" });
  check("a refund is refused while a booking holds a session", refuse.status === 409 && (await json(refuse)).code === "live-bookings", refuse.status);
  await send(salon.owner, `/api/business/bookings/${pb.booking.id}`, "PATCH", { status: "CANCELLED" });
  const after = (await pg.query(`SELECT "sessionsUsed" FROM "CustomerPackage" WHERE id = $1`, [sold.id])).rows[0];
  check("cancelling gives the session back", after?.sessionsUsed === 0);
  const refund = await send(salon.owner, `/api/business/packages/sold/${sold.id}`, "POST", { kind: "package", action: "refund", amountCents: 45000, reason: "QA test" });
  check("now the refund goes through and the package is REFUNDED", refund.status === 200 && (await pg.query(`SELECT status FROM "CustomerPackage" WHERE id = $1`, [sold.id])).rows[0]?.status === "REFUNDED", refund.status);
  const otherSees = await send(other.owner, `/api/business/packages/sold/${sold.id}`, "POST", { kind: "package", action: "cancel" });
  check("another business cannot touch it", otherSees.status === 409 || otherSees.status === 404, otherSees.status);

  const mplan = data(await json(await send(salon.owner, "/api/business/memberships", "POST", { nameAr: "عضوية شهرية", serviceIds: [], priceCents: 60000, periodDays: 30, includedVisits: 2 }))).plan;
  const msale = data(await json(await send(salon.owner, "/api/business/packages/sell", "POST", { kind: "membership", planId: mplan.id, phone: cust.phone, customerName: "Customer A", method: "CARD" })));
  check("a membership is sold", !!msale.id);
  const pause = await send(salon.owner, `/api/business/packages/sold/${msale.id}`, "POST", { kind: "membership", action: "pause" });
  const resume = await send(salon.owner, `/api/business/packages/sold/${msale.id}`, "POST", { kind: "membership", action: "resume" });
  check("it pauses and resumes", pause.status === 200 && resume.status === 200, `${pause.status}/${resume.status}`);
  const renew1 = await send(salon.owner, `/api/business/packages/sold/${msale.id}`, "POST", { kind: "membership", action: "renew", method: "CASH" });
  const renew2 = await send(salon.owner, `/api/business/packages/sold/${msale.id}`, "POST", { kind: "membership", action: "renew", method: "CASH" });
  check("renewal is bounded to one period ahead", renew1.status === 200 && renew2.status === 409, `${renew1.status}/${renew2.status} ${JSON.stringify(await json(renew1))}`);

  // ── Desk: walk-ins and series ────────────────────────────────────────
  part("desk");
  const walk = await send(salon.owner, "/api/business/bookings", "POST", { serviceId: haircut.id, customerName: "Walk In (test)", customerPhone: "01099990001", walkIn: true });
  const wb = data(await json(walk));
  check("a walk-in is booked now and ARRIVED", walk.status === 201 && wb.status === "ARRIVED", `${walk.status} ${JSON.stringify(wb).slice(0, 120)}`);
  const start = (await slotNear(salon, colour.id, 2 * 1440)) ?? slot;
  const series = await send(salon.owner, "/api/business/series", "POST", {
    serviceId: colour.id, customerName: "Series (test)", customerPhone: "01099990002", startDate: start.date, startTime: "13:00", intervalWeeks: 1, occurrences: 3,
  });
  const sr = data(await json(series));
  check("a weekly series of 3 is made", series.status === 201 && sr.made?.length === 3, `${series.status} ${JSON.stringify(sr).slice(0, 200)}`);
  const tooMany = await send(salon.owner, "/api/business/series", "POST", {
    serviceId: colour.id, customerName: "Series (test)", customerPhone: "01099990002", startDate: start.date, startTime: "15:00", intervalWeeks: 1, occurrences: 40,
  });
  check("an unbounded series is refused", tooMany.status === 422, tooMany.status);
  const end = await send(salon.owner, `/api/business/series/${sr.seriesId}`, "DELETE");
  check("ending the series cancels its upcoming visits", end.status === 200 && data(await json(end)).cancelled === 3, end.status);

  // ── No-show policy ───────────────────────────────────────────────────
  part("no-show");
  await send(salon.owner, "/api/business/operations", "PATCH", { noShowLimit: 1, noShowAction: "BLOCK_ONLINE" });
  slot = await slotNear(salon, haircut.id, 600);
  const ns = await book(salon, { serviceId: haircut.id, slot, name: "No Show (test)" });
  await shiftBooking(ns.booking.id, -((await minutesUntil(ns.booking.id)) + 60));
  const marked = await send(salon.owner, `/api/business/bookings/${ns.booking.id}`, "PATCH", { status: "NO_SHOW" });
  check("the owner marks a no-show", marked.status === 200, marked.status);
  const blocked = await send(null, `/api/public/${salon.slug}/bookings`, "POST", {
    serviceId: haircut.id, date: slot.date, startTime: (await slotNear(salon, haircut.id, 700)).startTime, customerName: "No Show (test)", customerPhone: ns.phone,
  });
  check("that number cannot book online now", blocked.status === 403 && (await json(blocked)).code === "no-show-blocked", blocked.status);
  await send(salon.owner, "/api/business/operations", "PATCH", { noShowLimit: null });

  // ── Waitlist ─────────────────────────────────────────────────────────
  part("waitlist");
  await send(salon.owner, "/api/business/operations", "PATCH", { waitlistEnabled: true, waitlistOfferMinutes: 30 });
  slot = await slotNear(salon, haircut.id, 1440 + 120);
  const taken = await book(salon, { serviceId: haircut.id, slot, name: "Holder (test)" });
  const toTime = `${String(Math.min(23, Number(slot.startTime.slice(0, 2)) + 1)).padStart(2, "0")}${slot.startTime.slice(2)}`;
  const join = await send(null, `/api/public/${salon.slug}/waitlist`, "POST", {
    serviceId: haircut.id, date: slot.date, fromTime: slot.startTime, toTime, customerName: "Waiter (test)", customerPhone: "01099990003", customerEmail: "waiter@example.test",
  });
  const jw = data(await json(join));
  check("a customer joins the waitlist", join.status === 201 && /booking-waitlist/.test(jw.manageUrl ?? ""), `${join.status} ${JSON.stringify(jw)}`);
  const dup = await send(null, `/api/public/${salon.slug}/waitlist`, "POST", {
    serviceId: haircut.id, date: slot.date, fromTime: slot.startTime, toTime, customerName: "Waiter (test)", customerPhone: "01099990003",
  });
  check("the same number cannot join twice for the day", dup.status === 409, dup.status);
  // Fill the window's other starts so only the cancelled one frees up.
  const holds = [];
  for (let t = 0; t < 4; t++) {
    const s2 = await slotNear(salon, haircut.id, 1440 + 120);
    if (!s2 || s2.date !== slot.date || s2.startTime >= toTime) break;
    holds.push(await book(salon, { serviceId: haircut.id, slot: s2, name: "Filler (test)" }));
  }
  await send(salon.owner, `/api/business/bookings/${taken.booking.id}`, "PATCH", { status: "CANCELLED" });
  const ops = await call(null, "/api/cron/operations", { headers: cronHeaders });
  check("the operations cron runs", ops.status === 200, ops.status);
  const token = jw.manageUrl.split("/").pop();
  const view = data(await json(await call(null, `/api/public/booking-waitlist/${token}`)));
  check("the freed time is offered", view.status === "OFFERED" && !!view.offer?.token, JSON.stringify(view).slice(0, 200));
  if (view.offer?.token) {
    const take = await send(null, `/api/public/booking-waitlist/${token}`, "POST", { offerToken: view.offer.token });
    check("accepting books it", take.status === 201 && /\/booking\//.test(data(await json(take)).bookingUrl ?? ""), take.status);
    const twice = await send(null, `/api/public/booking-waitlist/${token}`, "POST", { offerToken: view.offer.token });
    check("a second tap returns the same booking", twice.status === 201, twice.status);
  }
  const staffView = data(await json(await call(salon.owner, `/api/business/waitlist?date=${slot.date}`)));
  check("the desk sees the waitlist", (staffView.entries ?? []).some((e) => e.status === "BOOKED"));

  // ── Report, consent, automations ─────────────────────────────────────
  part("operations");
  const rep = await call(salon.owner, `/api/business/reports/operations?from=${slot.date}&days=1`);
  const rj = data(await json(rep));
  check("the operations report answers", rep.status === 200 && typeof rj.totals?.booked === "number", rep.status);
  check("the report names no customer", !JSON.stringify(rj).includes("Waiter") && !JSON.stringify(rj).includes("0109999"));
  const forb = await call(cust, `/api/business/reports/operations`);
  check("a customer cannot read a business report", forb.status === 404 || forb.status === 401 || forb.status === 403, forb.status);
  const consent = await send(cust, "/api/account/profile", "PATCH", { marketingConsent: true });
  const prof = data(await json(await call(cust, "/api/account/profile")));
  check("marketing consent is saved", consent.status === 200 && prof.marketingConsent === true, consent.status);
  const ops2 = data(await json(await call(null, "/api/cron/operations", { headers: cronHeaders })));
  check("a second cron run is clean", Array.isArray(ops2.failed) && ops2.failed.length === 0, JSON.stringify(ops2.failed));
  const noAuth = await call(null, "/api/cron/operations");
  check("the cron refuses without its secret", noAuth.status === 401, noAuth.status);

  // ── Organization ─────────────────────────────────────────────────────
  part("organization");
  const founder = await account("p27-org", "Org founder (test)");
  const org = await organization(founder, admin, { slug: "p27-group", kind: "OTHER", nameAr: "مجموعة تجريبية ٢٧", nameEn: "Test Group 27" });
  await associate(founder, org.id, salon, "OWNED", { ask: ["REPORTS"] });
  await associate(founder, org.id, other, "HOSTED");
  const op = await send(founder, `/api/organizations/${org.id}/loyalty`, "PUT", {
    nameAr: "نقاط المجموعة", isActive: true, pointsPerVisit: 10, pointsPer100Egp: 0, redeemPoints: 100, redeemValueCents: 1000, maxRedeemPercent: 20, expiryDays: 365, dailyEarnCap: 2,
  });
  check("the organization's program invites owned brands only", op.status === 200 && data(await json(op)).invited === 1, op.status);
  const otherInv = data(await json(await call(other.owner, "/api/business/loyalty")));
  check("the hosted business is not invited", (otherInv.invitations ?? []).length === 0);
  const promo = await send(founder, `/api/organizations/${org.id}/promotions`, "POST", { nameAr: "عرض المجموعة", kind: "PERCENT", value: 10 });
  check("a promotion lands on the owned brand only, switched off", promo.status === 201 && data(await json(promo)).offered === 1, promo.status);
  const pk = await call(founder, `/api/organizations/${org.id}/packages`);
  check("the organization sees package counts for brands sharing reports", pk.status === 200 && (data(await json(pk)).businesses ?? []).length === 1, pk.status);
  const stranger = await call(cust, `/api/organizations/${org.id}/loyalty`);
  check("a stranger cannot read the organization's program", stranger.status === 404 || stranger.status === 401, stranger.status);

  // ── The new screens render (server-side, both languages) ────────────
  part("pages");
  const page = async (jar, path) => {
    const r = await call(jar, path, { redirect: "manual" });
    const html = r.status === 200 ? await r.text() : "";
    return { status: r.status, ok: r.status === 200 && !/Application error|Internal Server Error/.test(html) };
  };
  for (const lang of ["", "/en"]) {
    for (const p of ["/dashboard/loyalty", "/dashboard/packages", "/dashboard/waitlist", "/dashboard/operations", "/dashboard/bookings", "/dashboard/staff", "/dashboard/services"]) {
      // The dashboard is a single address; /en is only a language cookie there.
      if (lang) continue;
      const r = await page(salon.owner, p);
      check(`${p} renders for the owner`, r.ok, r.status);
    }
    const w = await page(cust, `${lang}/account/wallet`.replace("/en/account", "/account"));
    check(`the wallet renders${lang ? " (en)" : ""}`, w.ok, w.status);
    const c = await page(null, `${lang}/company/${salon.slug}`);
    check(`the business page with its widget renders${lang ? " (en)" : ""}`, c.ok, c.status);
  }
  const wl = await page(null, `/booking-waitlist/${token}`);
  check("the waitlist link page renders", wl.ok, wl.status);
  const bad = await page(null, "/booking-waitlist/not-a-real-token-123");
  check("an unknown waitlist link does not crash", bad.status === 200 || bad.status === 404, bad.status);
  const ol = await page(founder, `/org-admin/${org.id}/loyalty`);
  check("the organization loyalty console renders", ol.ok, ol.status);
  const anon = await page(null, "/dashboard/loyalty");
  check("the dashboard page sends a stranger to sign in", anon.status === 307 || anon.status === 302 || anon.status === 303, anon.status);
} catch (e) {
  failedHard = 1;
  console.error("QA aborted:", e);
} finally {
  await pg.query(`DELETE FROM "LoyaltyProgram" WHERE "businessId" = ANY($1) OR "organizationId" = ANY($2)`, [made.businesses, made.orgs]).catch(() => {});
  await pg.query(`DELETE FROM "OrganizationPromotion" WHERE "organizationId" = ANY($1)`, [made.orgs]).catch(() => {});
  await pg.query(`DELETE FROM "SlotWaitlistEntry" WHERE "businessId" = ANY($1)`, [made.businesses]).catch(() => {});
  await pg.query(`DELETE FROM "NotificationDelivery" WHERE "businessId" = ANY($1)`, [made.businesses]).catch(() => {});
  await pg.query(`DELETE FROM "OrganizationBusiness" WHERE "organizationId" = ANY($1)`, [made.orgs]).catch(() => {});
  await pg.query(`DELETE FROM "Organization" WHERE id = ANY($1)`, [made.orgs]).catch(() => {});
  await teardown();
  await pg.end();
}
process.exit(summary(true) > 0 || failedHard ? 1 : 0);
