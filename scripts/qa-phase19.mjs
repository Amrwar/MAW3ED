/**
 * Phase 19 end to end: booking and payment reliability over HTTP, on a
 * production build, against the QA database and its fixtures
 * (scripts/qa-fixtures.mjs), with the fake Paymob checkout standing in
 * for the hosted page (lib/services/paymob-fake.ts — the webhook, its
 * signature check, the ledger and the booking moves are the real ones).
 *
 *   a deposit booking paid, confirmed by the webhook, with a receipt;
 *   the same payment reported again changes nothing;
 *   a declined deposit releases the time, and it is offered again;
 *   a customer cancelling mid-payment, then the money landing anyway;
 *   fifty simultaneous requests for one table — one gets it;
 *   "any table" fills every table once and no more;
 *   ten retries carrying one idempotency key make one booking;
 *   a party too large for every table is refused;
 *   a venue trading past midnight offers and takes a 01:00 table;
 *   the notification re-drive cron, with and without its secret;
 *   every notification claim for the confirmed booking has settled.
 *
 * Local only: it writes bookings and payments and removes them.
 *
 *   DATABASE_URL=<qa> npm run build
 *   DATABASE_URL=<qa> AUTH_URL=http://localhost:3101 NEXTAUTH_URL=http://localhost:3101 \
 *     PAYMOB_FAKE=1 PAYMOB_FAKE_BASE_URL=http://localhost:3101 CRON_SECRET=p19-local-cron \
 *     WHATSAPP_ACCESS_TOKEN= npx next start -p 3101
 *   node scripts/qa-phase19.mjs [baseUrl] [--db url] [--cron-secret s]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const args = process.argv.slice(2);
const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const DB = args.includes("--db") ? args[args.indexOf("--db") + 1] : "postgresql://qa:qa@localhost:5450/maw3ed_qa";
const CRON = args.includes("--cron-secret") ? args[args.indexOf("--cron-secret") + 1] : "p19-local-cron";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB) || !/^http:\/\/localhost[:/]/.test(B)) {
  console.error("Local only: this writes bookings and payments.");
  process.exit(1);
}

const pg = new Client({ connectionString: DB });
await pg.connect();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const TAG = "P19 E2E";
const created = { bookings: new Set(), hours: [], restore: [] };
const json = async (res) => {
  const j = await res.json().catch(() => ({}));
  return j.data ?? j;
};
let ip = 1;
const post = (path, body, headers = {}) =>
  fetch(`${B}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.19.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}`, ...headers },
    body: JSON.stringify(body),
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The fake Paymob page's buttons, pressed from here: posts the signed callback to the real webhook. */
async function payOnFakePage(paymentUrl, outcome) {
  const u = new URL(paymentUrl);
  const order = u.searchParams.get("order");
  const form = new URLSearchParams({ order, outcome });
  const res = await fetch(`${B}${u.pathname}`, { method: "POST", body: form, redirect: "manual" });
  return { order, status: res.status };
}

/** Business row by slug, plus what this script may have to put back. */
async function business(slug) {
  const { rows } = await pg.query(
    `select id, "depositEnabled", "depositPercent", plan, "subscriptionStatus", "autoConfirm", "bufferMinutes", "minNoticeMinutes" from "Business" where slug=$1`,
    [slug],
  );
  return rows[0];
}

async function ensureHours(bizId, open, close, idPrefix) {
  const have = (await pg.query(`select "dayOfWeek" from "AvailabilityRule" where "businessId"=$1`, [bizId])).rows.map((r) => r.dayOfWeek);
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    if (have.includes(d)) {
      const prev = (await pg.query(`select id, "openTime", "closeTime", "isClosed" from "AvailabilityRule" where "businessId"=$1 and "dayOfWeek"=$2`, [bizId, d])).rows[0];
      created.restore.push(() => pg.query(`update "AvailabilityRule" set "openTime"=$2, "closeTime"=$3, "isClosed"=$4 where id=$1`, [prev.id, prev.openTime, prev.closeTime, prev.isClosed]));
      await pg.query(`update "AvailabilityRule" set "openTime"=$2, "closeTime"=$3, "isClosed"=false where id=$1`, [prev.id, open, close]);
    } else {
      const { rows } = await pg.query(
        `insert into "AvailabilityRule" (id, "businessId", "dayOfWeek", "openTime", "closeTime") values ($4||$2::text, $1, $2::int, $3, $5) returning id`,
        [bizId, d, open, idPrefix, close],
      );
      created.hours.push(rows[0].id);
    }
  }
}

const date = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
const date2 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

try {
  // ── Fixtures ─────────────────────────────────────────────────
  const salon = await business("qa-listing-0");
  const restaurant = await business("qa-listing-2");
  if (!salon || !restaurant) throw new Error("fixtures missing: run scripts/qa-fixtures.mjs");

  // The salon takes a 20% deposit for this run, on a plan that allows it.
  created.restore.push(() =>
    pg.query(`update "Business" set "depositEnabled"=$2, "depositPercent"=$3, plan=$4, "subscriptionStatus"=$5, "bufferMinutes"=$6, "minNoticeMinutes"=$7 where id=$1`,
      [salon.id, salon.depositEnabled, salon.depositPercent, salon.plan, salon.subscriptionStatus, salon.bufferMinutes, salon.minNoticeMinutes]),
  );
  await pg.query(`update "Business" set "depositEnabled"=true, "depositPercent"=20, plan='PRO', "subscriptionStatus"='ACTIVE', "bufferMinutes"=0, "minNoticeMinutes"=0 where id=$1`, [salon.id]);
  await ensureHours(salon.id, "09:00", "21:00", "p19e2e-salon-");
  await ensureHours(restaurant.id, "12:00", "23:00", "p19e2e-rest-");
  created.restore.push(() => pg.query(`update "Business" set "bufferMinutes"=$2, "minNoticeMinutes"=$3 where id=$1`, [restaurant.id, restaurant.bufferMinutes, restaurant.minNoticeMinutes]));
  await pg.query(`update "Business" set "bufferMinutes"=0, "minNoticeMinutes"=0 where id=$1`, [restaurant.id]);

  const salonProfile = await json(await fetch(`${B}/api/public/qa-listing-0`));
  const salonService = (salonProfile.services ?? salonProfile.business?.services).find((s) => Number(s.price) > 0) ?? (salonProfile.services ?? salonProfile.business?.services)[0];
  const restProfile = await json(await fetch(`${B}/api/public/qa-listing-2`));
  const restService = (restProfile.services ?? restProfile.business?.services)[0];
  const restTables = (await pg.query(`select id, capacity from "Resource" where "businessId"=$1 and "isActive" order by capacity`, [restaurant.id])).rows;
  check("fixtures: salon service with a price, restaurant with tables", !!salonService && restTables.length >= 2, `${salonService?.nameAr ?? "?"} ${salonService?.price ?? "?"}; tables ${restTables.map((t) => t.capacity).join("/")}`);

  const salonSlots = (await json(await fetch(`${B}/api/public/qa-listing-0/slots?serviceId=${salonService.id}&date=${date}`))).slots ?? [];
  check("salon offers slots on the test day", salonSlots.length >= 4, `${salonSlots.length} slots`);
  let salonSlotIdx = 0;
  const nextSalonSlot = () => salonSlots[salonSlotIdx++];

  async function depositBooking(label, phone) {
    const res = await post(`/api/public/qa-listing-0/bookings`, {
      serviceId: salonService.id, date, startTime: nextSalonSlot(),
      customerName: `${TAG} ${label}`, customerPhone: phone, customerEmail: `p19-${label.replace(/\W/g, "")}@example.test`,
    });
    const body = await json(res);
    if (body.booking?.id) created.bookings.add(body.booking.id);
    return { status: res.status, ...body };
  }

  // ── A. Deposit paid: webhook confirms, receipt issued ────────
  const a = await depositBooking("paid", "01000001901");
  check("A1 deposit booking created, awaiting payment, with a fake checkout URL", a.status === 201 && a.requiresPayment === true && /\/api\/dev\/paymob\/checkout/.test(a.paymentUrl ?? ""), `${a.status} ${a.booking?.status} ${a.code ?? ""}`);
  if (!a.paymentUrl) throw new Error("no payment page: is the server running with PAYMOB_FAKE=1 and PAYMOB_FAKE_BASE_URL=http://localhost:3101?");
  const aPay = await payOnFakePage(a.paymentUrl, "success");
  check("A2 fake page accepted the payment and redirected like Paymob does", aPay.status === 303, String(aPay.status));
  await sleep(300);
  const aView = await json(await fetch(`${B}/api/public/booking/${a.booking.accessToken}`));
  const aPayments = (await pg.query(`select status, "receiptNumber", "providerTransactionId" from "Payment" where "bookingId"=$1`, [a.booking.id])).rows;
  const aEvents = (await pg.query(`select outcome from "WebhookEvent" where "eventId" = any($1)`, [aPayments.map((p) => p.providerTransactionId).filter(Boolean)])).rows;
  check("A3 booking CONFIRMED by the webhook; the deposit shows as paid", aView.status === "CONFIRMED" && aView.money?.paid === a.booking.depositAmount, `${aView.status} paid ${aView.money?.paid} of deposit ${a.booking.depositAmount}`);
  check("A4 one SUCCEEDED payment with a receipt number; webhook event closed as booking-settled", aPayments.length === 1 && aPayments[0].status === "SUCCEEDED" && /^MW-\d{6}$/.test(aPayments[0].receiptNumber ?? "") && aEvents.some((e) => e.outcome === "booking-settled"), JSON.stringify({ payments: aPayments.map((p) => `${p.status}:${p.receiptNumber}`), events: aEvents.map((e) => e.outcome) }));

  // ── B. The same payment reported again ───────────────────────
  const bPay = await payOnFakePage(a.paymentUrl, "success");
  await sleep(300);
  const bPayments = (await pg.query(`select status, "receiptNumber" from "Payment" where "bookingId"=$1`, [a.booking.id])).rows;
  const bView = await json(await fetch(`${B}/api/public/booking/${a.booking.accessToken}`));
  const bOutcomes = (await pg.query(`select outcome from "WebhookEvent" where "receivedAt" > now() - interval '1 minute' order by "receivedAt" desc limit 3`)).rows.map((r) => r.outcome);
  check("B1 a second success callback for the same order settles nothing twice", bPay.status === 303 && bPayments.length === 1 && bPayments[0].receiptNumber === aPayments[0].receiptNumber && bView.status === "CONFIRMED" && bOutcomes.includes("already-settled"), JSON.stringify(bOutcomes));

  // ── C. Declined: the time goes back ──────────────────────────
  const c = await depositBooking("declined", "01000001902");
  const cTime = c.booking.startTime;
  const beforeDecline = (await json(await fetch(`${B}/api/public/qa-listing-0/slots?serviceId=${salonService.id}&date=${date}`))).slots ?? [];
  await payOnFakePage(c.paymentUrl, "decline");
  await sleep(300);
  const cView = await json(await fetch(`${B}/api/public/booking/${c.booking.accessToken}`));
  const afterDecline = (await json(await fetch(`${B}/api/public/qa-listing-0/slots?serviceId=${salonService.id}&date=${date}`))).slots ?? [];
  check("C1 a declined deposit releases the booking and its time is offered again", cView.status === "FAILED_PAYMENT" && !beforeDecline.includes(cTime) && afterDecline.includes(cTime), `${cView.status}; ${cTime} held before: ${!beforeDecline.includes(cTime)}, free after: ${afterDecline.includes(cTime)}`);
  const cPay = await json(await post(`/api/public/booking/${c.booking.accessToken}/pay`, {}));
  check("C2 a released booking cannot open a new payment page", cPay.code === "not-awaiting-payment", JSON.stringify(cPay.code));

  // ── D. Cancelled during payment, then paid anyway ────────────
  const d = await depositBooking("cancelled", "01000001903");
  const dCancel = await json(await post(`/api/booking/${d.booking.accessToken}/cancel`, {}));
  const dPending = (await pg.query(`select status from "Payment" where "bookingId"=$1`, [d.booking.id])).rows;
  check("D1 the customer may cancel while the deposit is unpaid; the payment page is closed in the ledger", dCancel.cancelled === true && dPending.every((p) => p.status === "ABANDONED"), JSON.stringify(dPending.map((p) => p.status)));
  await payOnFakePage(d.paymentUrl, "success");
  await sleep(300);
  const dView = await json(await fetch(`${B}/api/public/booking/${d.booking.accessToken}`));
  const dPayments = (await pg.query(`select status from "Payment" where "bookingId"=$1`, [d.booking.id])).rows;
  const dFlag = (await pg.query(`select count(*)::int as n from "AuditLog" where action='payment.unexpected_deposit' and "resourceId" in (select id from "Payment" where "bookingId"=$1)`, [d.booking.id])).rows[0].n;
  check("D2 money landing after the cancel is recorded and flagged for refund; the booking stays cancelled", dView.status === "CANCELLED" && dPayments.some((p) => p.status === "SUCCEEDED") && dFlag === 1 && dView.money?.paid > 0, `${dView.status} paid ${dView.money?.paid} flags ${dFlag}`);

  // ── E. Fifty for one table ───────────────────────────────────
  const restSlots = (await json(await fetch(`${B}/api/public/qa-listing-2/slots?serviceId=${restService.id}&date=${date}&partySize=2`))).slots ?? [];
  check("E0 restaurant offers slots for a party of two", restSlots.length >= 3, `${restSlots.length}`);
  const T1 = restSlots[0];
  const smallest = restTables[0];
  const e1Start = Date.now();
  const fifty = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      post(`/api/public/qa-listing-2/bookings`, {
        serviceId: restService.id, date, startTime: T1, resourceId: smallest.id, partySize: 1,
        customerName: `${TAG} fifty ${i}`, customerPhone: `0101900${String(i).padStart(4, "0")}`,
      }).then(async (r) => ({ status: r.status, body: await json(r) })),
    ),
  );
  for (const r of fifty) if (r.body.booking?.id) created.bookings.add(r.body.booking.id);
  const fiftyOk = fifty.filter((r) => r.status === 201).length;
  // A loser that raced the winner to the insert is told "taken"; one
  // that derived its slot after the winner committed is told the time
  // is no longer offered. Both are the honest 409 for that request.
  const gone = (r) => r.status === 409 && (r.body.code === "slot-taken" || r.body.code === "slot-unavailable");
  const fiftyTaken = fifty.filter((r) => gone(r) && r.body.code === "slot-taken").length;
  const fiftyGone = fifty.filter(gone).length;
  const others = fifty.filter((r) => r.status !== 201 && !gone(r)).map((r) => `${r.status}:${r.body.code ?? r.body.error ?? ""}`);
  if (others.length) console.log("   E1 other answers:", JSON.stringify(others));
  const fiftyRows = (await pg.query(`select count(*)::int as n from "Booking" where "businessId"=$1 and date=$2::date and "startTime"=$3 and "resourceId"=$4 and status in ('PENDING','CONFIRMED','PENDING_PAYMENT')`, [restaurant.id, date, T1, smallest.id])).rows[0].n;
  check("E1 fifty simultaneous requests for one table at one time: one booking, forty-nine told it went (409)", fiftyOk === 1 && fiftyGone === 49 && fiftyRows === 1, `201×${fiftyOk}, 409 slot-taken×${fiftyTaken} + slot-unavailable×${fiftyGone - fiftyTaken}, other×${50 - fiftyOk - fiftyGone}, rows ${fiftyRows}, ${Date.now() - e1Start} ms for all fifty (started ${new Date(e1Start).toISOString()})`);

  // ── F. "Any table" fills every table once ────────────────────
  const T2 = restSlots[1];
  const thirty = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      post(`/api/public/qa-listing-2/bookings`, {
        serviceId: restService.id, date, startTime: T2, partySize: 2,
        customerName: `${TAG} any ${i}`, customerPhone: `0101910${String(i).padStart(4, "0")}`,
      }).then(async (r) => ({ status: r.status, body: await json(r) })),
    ),
  );
  for (const r of thirty) if (r.body.booking?.id) created.bookings.add(r.body.booking.id);
  const thirtyOk = thirty.filter((r) => r.status === 201).length;
  const seated = (await pg.query(`select "resourceId" from "Booking" where "businessId"=$1 and date=$2::date and "startTime"=$3 and status in ('PENDING','CONFIRMED')`, [restaurant.id, date, T2])).rows;
  const fitting = restTables.filter((t) => t.capacity === null || t.capacity >= 2).length;
  check("F1 'any table' for a party of two seats exactly one party per table that fits, no table twice", thirtyOk === fitting && seated.length === fitting && new Set(seated.map((s) => s.resourceId)).size === fitting && seated.every((s) => s.resourceId), `201×${thirtyOk} of 30; tables that fit ${fitting}; distinct seated ${new Set(seated.map((s) => s.resourceId)).size}`);
  const afterFull = (await json(await fetch(`${B}/api/public/qa-listing-2/slots?serviceId=${restService.id}&date=${date}&partySize=2`))).slots ?? [];
  check("F2 that time is no longer offered once every table is taken", !afterFull.includes(T2));

  // ── G. One key, ten retries ──────────────────────────────────
  const T3 = restSlots[2];
  const key = `p19e2e-${Date.now()}`;
  const ten = await Promise.all(
    Array.from({ length: 10 }, () =>
      post(`/api/public/qa-listing-2/bookings`, {
        serviceId: restService.id, date, startTime: T3, partySize: 2, idempotencyKey: key,
        customerName: `${TAG} idem`, customerPhone: "01019200001",
      }).then(async (r) => ({ status: r.status, body: await json(r) })),
    ),
  );
  for (const r of ten) if (r.body.booking?.id) created.bookings.add(r.body.booking.id);
  const idemIds = new Set(ten.map((r) => r.body.booking?.id).filter(Boolean));
  const idemOthers = ten.filter((r) => r.status !== 201 && r.status !== 200).map((r) => `${r.status}:${r.body.code ?? r.body.error ?? ""}`);
  if (idemOthers.length) console.log("   G1 other answers:", JSON.stringify(idemOthers));
  const idemRows = (await pg.query(`select count(*)::int as n from "Booking" where "idempotencyKey"=$1`, [key])).rows[0].n;
  check("G1 ten simultaneous retries with one idempotency key: every answer is the same booking, one row", ten.every((r) => r.status === 201 || r.status === 200) && idemIds.size === 1 && idemRows === 1, `statuses ${[...new Set(ten.map((r) => r.status))].join(",")}, ids ${idemIds.size}, rows ${idemRows}`);

  // ── H. Too many for any table ────────────────────────────────
  const big = Math.max(...restTables.map((t) => t.capacity ?? 0)) + 1;
  const h = await post(`/api/public/qa-listing-2/bookings`, { serviceId: restService.id, date: date2, startTime: restSlots[0], partySize: big, customerName: `${TAG} big`, customerPhone: "01019300001" });
  const hBody = await json(h);
  const hSlots = (await json(await fetch(`${B}/api/public/qa-listing-2/slots?serviceId=${restService.id}&date=${date2}&partySize=${big}`)));
  check("H1 a party bigger than every table is refused, and offered no times", h.status === 422 && hBody.code === "party-too-large" && (hSlots.slots ?? []).length === 0 && hSlots.reason === "party-too-large", `${h.status} ${hBody.code}; slots ${(hSlots.slots ?? []).length} reason ${hSlots.reason}`);

  // ── I. Past midnight ─────────────────────────────────────────
  const dow2 = new Date(`${date2}T00:00:00Z`).getUTCDay();
  const night = (await pg.query(`select id, "openTime", "closeTime" from "AvailabilityRule" where "businessId"=$1 and "dayOfWeek"=$2`, [restaurant.id, dow2])).rows[0];
  created.restore.push(() => pg.query(`update "AvailabilityRule" set "openTime"=$2, "closeTime"=$3 where id=$1`, [night.id, night.openTime, night.closeTime]));
  await pg.query(`update "AvailabilityRule" set "openTime"='20:00', "closeTime"='02:00' where id=$1`, [night.id]);
  const nightSlots = (await json(await fetch(`${B}/api/public/qa-listing-2/slots?serviceId=${restService.id}&date=${date2}&partySize=2`))).slots ?? [];
  const lateSlot = nightSlots.find((s) => Number(s.split(":")[0]) >= 24);
  check("I1 a venue open 20:00–02:00 offers times after midnight under the evening's date", nightSlots[0] === "20:00" && !!lateSlot && !nightSlots.some((s) => Number(s.split(":")[0]) < 20), nightSlots.join(" "));
  const iRes = await post(`/api/public/qa-listing-2/bookings`, { serviceId: restService.id, date: date2, startTime: lateSlot, partySize: 2, customerName: `${TAG} night`, customerPhone: "01019400001" });
  const iBody = await json(iRes);
  if (iBody.booking?.id) created.bookings.add(iBody.booking.id);
  const iRow = iBody.booking ? (await pg.query(`select "startTime", "endTime", "startsAt", "endsAt" from "Booking" where id=$1`, [iBody.booking.id])).rows[0] : null;
  const iHtml = iBody.booking ? await (await fetch(`${B}/booking/${iBody.booking.accessToken}`)).text() : "";
  const expectShown = `${String(Number(lateSlot.split(":")[0]) - 24).padStart(2, "0")}:${lateSlot.split(":")[1]} +1`;
  check("I2 the 01:00 table is taken, stored on the next calendar day, and shown as a clock time with a next-day mark", iRes.status === 201 && iRow && iRow.startsAt.toISOString().slice(0, 10) > date2 && iHtml.includes(expectShown), `${iRes.status} ${iBody.code ?? ""}; startsAt ${iRow?.startsAt?.toISOString()}; page shows "${expectShown}": ${iHtml.includes(expectShown)}`);

  // ── J. The re-drive cron ─────────────────────────────────────
  const noAuth = await fetch(`${B}/api/cron/notifications`);
  const withAuth = await fetch(`${B}/api/cron/notifications`, { headers: { Authorization: `Bearer ${CRON}` } });
  const cronBody = await withAuth.json().catch(() => ({}));
  check("J1 the notification re-drive refuses without the secret and reports with it", noAuth.status === 401 && withAuth.status === 200 && cronBody.ok === true && typeof cronBody.due === "number", `${noAuth.status}/${withAuth.status} ${JSON.stringify(cronBody)}`);

  // ── K. Every claim settled ───────────────────────────────────
  await sleep(1500);
  const claims = (await pg.query(`select channel, status, attempts, event is not null as has_event from "NotificationDelivery" where "bookingId"=$1`, [a.booking.id])).rows;
  check("K1 the confirmed booking's notification claims all settled (none left PENDING) and carry their event", claims.length > 0 && claims.every((c) => c.status !== "PENDING" && c.has_event && c.attempts >= 1), claims.map((c) => `${c.channel}:${c.status}`).join(" "));
} catch (e) {
  check("script ran to the end", false, e instanceof Error ? e.stack ?? e.message : String(e));
} finally {
  // ── Cleanup ──────────────────────────────────────────────────
  // Payments first, always: a booking payment must name its booking
  // (Payment_target_chk), so a booking cannot go while its payments stay.
  const byName = (await pg.query(`select id from "Booking" where "customerName" like $1`, [`${TAG}%`])).rows.map((r) => r.id);
  const idList = [...new Set([...created.bookings, ...byName])];
  const pays = idList.length ? (await pg.query(`select id, "providerTransactionId" from "Payment" where "bookingId" = any($1)`, [idList])).rows : [];
  if (pays.length) {
    await pg.query(`delete from "AuditLog" where "resourceId" = any($1)`, [pays.map((p) => p.id)]);
    await pg.query(`delete from "WebhookEvent" where "eventId" = any($1)`, [pays.map((p) => p.providerTransactionId).filter(Boolean)]);
    await pg.query(`delete from "Payment" where id = any($1)`, [pays.map((p) => p.id)]);
  }
  if (idList.length) {
    await pg.query(`delete from "AuditLog" where "resourceType"='Booking' and "resourceId" = any($1)`, [idList]);
    await pg.query(`delete from "NotificationDelivery" where "bookingId" = any($1)`, [idList]);
    await pg.query(`delete from "Notification" where "bookingId" = any($1)`, [idList]);
    await pg.query(`delete from "Booking" where id = any($1)`, [idList]);
  }
  await pg.query(`delete from "Booking" where "customerName" like $1`, [`${TAG}%`]);
  await pg.query(`delete from "Customer" where name like $1`, [`${TAG}%`]);
  if (created.hours.length) await pg.query(`delete from "AvailabilityRule" where id = any($1)`, [created.hours]);
  for (const r of created.restore.reverse()) await r().catch((e) => console.error("restore failed", e.message));
  await pg.end();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
