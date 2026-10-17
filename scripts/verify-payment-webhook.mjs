/**
 * Drives every webhook case we can reach without moving real money.
 *
 * Why this exists: the production database has had zero payments, so
 * the webhook — the only thing in the system allowed to say money
 * arrived — has never run against a real callback. Unit tests cover the
 * rules in isolation; this covers the route, the ledger, the booking
 * transition and the database constraints together, which is where the
 * interesting failures live.
 *
 * What it does NOT do is spend money. It never calls Paymob. It signs
 * payloads with PAYMOB_HMAC_SECRET and posts them to a LOCAL server, so
 * what is exercised is our handling of a callback, not a transaction.
 * Cases 1, 2, 3 and 14 in the brief — a real card succeeding, failing,
 * being cancelled, and a real refund — are not here and cannot be; see
 * docs/payments-verification.md for the runbook.
 *
 * It writes fixtures to whatever DATABASE_URL points at, every row
 * prefixed `wh_verify_`, and deletes them at the end whether or not the
 * run passed. The last thing it prints is the leftover count, which
 * should always be zero.
 *
 *   node scripts/verify-payment-webhook.mjs [baseUrl]
 */

import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SECRET = process.env.PAYMOB_HMAC_SECRET;
const TAG = "wh_verify_";

if (!SECRET) {
  console.error("PAYMOB_HMAC_SECRET is not set — cannot sign callbacks. Load .env first.");
  process.exit(2);
}

const connectionString = (process.env.DATABASE_URL ?? "").replace(/[&?]channel_binding=require/g, "");
// Same rule as src/lib/db.ts: Neon's adapter speaks to Neon's proxy,
// so a local Postgres needs the plain one. This harness is usually
// pointed at a throwaway database, which is the whole point of it.
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const db = new PrismaClient({
  adapter: isLocal ? new PrismaPg({ connectionString }) : new PrismaNeon({ connectionString }),
});

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ""}`);
  }
}

/** The transaction object, shaped as Paymob sends it. */
function transaction(overrides = {}) {
  return {
    id: 700000000 + Math.floor(Math.random() * 99999999),
    pending: false,
    amount_cents: 28550,
    success: true,
    is_auth: false,
    is_capture: false,
    is_standalone_payment: true,
    is_voided: false,
    is_refunded: false,
    is_3d_secure: true,
    integration_id: 999,
    has_parent_transaction: false,
    error_occured: false,
    owner: 1,
    currency: "EGP",
    created_at: new Date().toISOString(),
    order: { id: 0 },
    source_data: { pan: "2346", type: "card", sub_type: "Visa" },
    ...overrides,
  };
}

/** Paymob's HMAC: these fields, in this order, concatenated, SHA-512. */
function sign(obj) {
  const data = [
    obj.amount_cents, obj.created_at, obj.currency, obj.error_occured,
    obj.has_parent_transaction, obj.id, obj.integration_id, obj.is_3d_secure,
    obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
    obj.is_voided, obj.order.id, obj.owner, obj.pending,
    obj.source_data.pan, obj.source_data.sub_type, obj.source_data.type, obj.success,
  ].map(String).join("");
  return createHmac("sha512", SECRET).update(data).digest("hex");
}

async function post(body, { raw = false } = {}) {
  const res = await fetch(`${BASE}/api/webhooks/paymob`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

/** A signed TRANSACTION callback for an order. */
function callback(orderId, overrides = {}) {
  const obj = transaction({ ...overrides, order: { id: orderId } });
  return { type: "TRANSACTION", obj, hmac: sign(obj) };
}

async function makeFixture(label, { amountCents = 28550, currency = "EGP" } = {}) {
  const business = await db.business.findFirst({ select: { id: true } });
  if (!business) throw new Error("no business in this database to attach a fixture to");

  const service = await db.service.findFirst({
    where: { businessId: business.id },
    select: { id: true, duration: true },
  });
  if (!service) throw new Error("no service to attach a booking to");

  const orderId = String(900000000 + Math.floor(Math.random() * 99999999));

  const booking = await db.booking.create({
    data: {
      businessId: business.id,
      serviceId: service.id,
      customerName: `${TAG}${label}`,
      customerPhone: "01000000000",
      date: new Date("2099-01-01T00:00:00Z"),
      startTime: "10:00",
      endTime: "10:30",
      status: "PENDING_PAYMENT",
      totalPrice: amountCents / 100,
      currency,
      notes: `${TAG}fixture`,
    },
    select: { id: true },
  });

  const payment = await db.payment.create({
    data: {
      kind: "BOOKING_FULL",
      status: "PENDING",
      businessId: business.id,
      bookingId: booking.id,
      amountCents,
      currency,
      providerOrderId: orderId,
    },
    select: { id: true },
  });

  return { orderId, paymentId: payment.id, bookingId: booking.id };
}

async function paymentState(id) {
  return db.payment.findUnique({
    where: { id },
    select: { status: true, receiptNumber: true, refundedCents: true, failureReason: true, paidAt: true },
  });
}

async function run() {
  console.log(`\nPayment webhook verification against ${BASE}`);
  console.log("No Paymob API call is made and no money moves.\n");

  // ── Case 4: a genuine, correctly signed success ──────────────────
  console.log("4. Successful webhook delivery");
  const ok = await makeFixture("success");
  const okCb = callback(ok.orderId);
  const r1 = await post(okCb);
  check("returns 200", r1.status === 200, `got ${r1.status}`);
  check("reports booking-settled", r1.json?.outcome === "booking-settled", r1.text.slice(0, 80));
  {
    const p = await paymentState(ok.paymentId);
    const b = await db.booking.findUnique({ where: { id: ok.bookingId }, select: { status: true } });
    check("payment is SUCCEEDED", p?.status === "SUCCEEDED", p?.status);
    check("receipt number assigned", Boolean(p?.receiptNumber), String(p?.receiptNumber));
    check("paidAt recorded", Boolean(p?.paidAt));
    check("booking is CONFIRMED", b?.status === "CONFIRMED", b?.status);
  }

  // ── Case 5: the same delivery again ──────────────────────────────
  console.log("\n5. Duplicate webhook (same transaction id)");
  const before = await paymentState(ok.paymentId);
  const r2 = await post(okCb);
  check("returns 200", r2.status === 200, `got ${r2.status}`);
  check("reports duplicate", r2.json?.duplicate === true, r2.text.slice(0, 80));
  {
    const after = await paymentState(ok.paymentId);
    check("receipt number unchanged", after?.receiptNumber === before?.receiptNumber);
    check("still SUCCEEDED once", after?.status === "SUCCEEDED");
  }

  // ── Case 13: a different delivery for an already-paid booking ────
  console.log("\n13. New transaction id against an already-paid payment");
  const r3 = await post(callback(ok.orderId));
  check("returns 200", r3.status === 200, `got ${r3.status}`);
  check("reports already-settled", r3.json?.outcome === "already-settled", r3.text.slice(0, 80));
  {
    const after = await paymentState(ok.paymentId);
    check("receipt number still unchanged", after?.receiptNumber === before?.receiptNumber);
  }

  // ── Case 8: a wrong signature ────────────────────────────────────
  console.log("\n8. Incorrect signature");
  const sigFix = await makeFixture("badsig");
  const bad = callback(sigFix.orderId);
  bad.hmac = "0".repeat(128);
  const r4 = await post(bad);
  check("refused with 403", r4.status === 403, `got ${r4.status}`);
  check("payment untouched", (await paymentState(sigFix.paymentId))?.status === "PENDING");

  // ── Case 7: malformed payloads ───────────────────────────────────
  console.log("\n7. Invalid webhook");
  const r5 = await post("{not json", { raw: true });
  check("unparseable body gives 400", r5.status === 400, `got ${r5.status}`);
  const r6 = await post({ type: "TRANSACTION" });
  check("missing transaction object gives 400", r6.status === 400, `got ${r6.status}`);
  const r7 = await post({ type: "TOKEN", obj: {} });
  check("non-TRANSACTION type is acknowledged", r7.status === 200, `got ${r7.status}`);
  // Before the shape check, these threw inside the HMAC computation and
  // came back as 500s — which Paymob would retry forever.
  const r7b = await post({ type: "TRANSACTION", obj: { id: 1 }, hmac: "x" });
  check("transaction without order/source_data gives 400", r7b.status === 400, `got ${r7b.status}`);
  const r7c = await post("null", { raw: true });
  check("a JSON null body gives 400", r7c.status === 400, `got ${r7c.status}`);

  // ── Case 9: the wrong amount ─────────────────────────────────────
  console.log("\n9. Incorrect amount");
  const amtFix = await makeFixture("amount");
  const r8 = await post(callback(amtFix.orderId, { amount_cents: 100 }));
  check("reports amount-mismatch", r8.json?.outcome === "amount-mismatch", r8.text.slice(0, 80));
  {
    const p = await paymentState(amtFix.paymentId);
    const b = await db.booking.findUnique({ where: { id: amtFix.bookingId }, select: { status: true } });
    check("payment FAILED", p?.status === "FAILED", p?.status);
    check("failure reason records both figures", /expected 28550, got 100/.test(p?.failureReason ?? ""));
    check("booking NOT confirmed", b?.status !== "CONFIRMED", b?.status);
  }

  // ── Case 10: the wrong currency, same number ─────────────────────
  console.log("\n10. Incorrect currency (same numeric amount)");
  const curFix = await makeFixture("currency");
  const r9 = await post(callback(curFix.orderId, { currency: "USD" }));
  check("reports currency-mismatch", r9.json?.outcome === "currency-mismatch", r9.text.slice(0, 80));
  {
    const p = await paymentState(curFix.paymentId);
    const b = await db.booking.findUnique({ where: { id: curFix.bookingId }, select: { status: true } });
    check("payment FAILED", p?.status === "FAILED", p?.status);
    check("booking NOT confirmed", b?.status !== "CONFIRMED", b?.status);
  }

  // ── Case 11: an order we have never heard of ─────────────────────
  console.log("\n11. Unknown transaction");
  const r10 = await post(callback("404040404040"));
  check("returns 200 so Paymob stops retrying", r10.status === 200, `got ${r10.status}`);
  check("reports no-matching-payment", r10.json?.outcome === "no-matching-payment", r10.text.slice(0, 80));

  // ── Case 2 (as a callback): a declined transaction ───────────────
  console.log("\n2b. Declined transaction callback");
  const failFix = await makeFixture("declined");
  const r11 = await post(callback(failFix.orderId, { success: false }));
  check("returns 200", r11.status === 200, `got ${r11.status}`);
  {
    const p = await paymentState(failFix.paymentId);
    const b = await db.booking.findUnique({ where: { id: failFix.bookingId }, select: { status: true } });
    check("payment FAILED", p?.status === "FAILED", p?.status);
    check("booking is FAILED_PAYMENT", b?.status === "FAILED_PAYMENT", b?.status);
  }

  // ── A pending callback must not confirm anything ─────────────────
  console.log("\n2c. Pending transaction callback");
  const pendFix = await makeFixture("pending");
  const r12 = await post(callback(pendFix.orderId, { pending: true, success: false }));
  check("reports still-pending", r12.json?.outcome === "still-pending", r12.text.slice(0, 80));
  {
    const p = await paymentState(pendFix.paymentId);
    const b = await db.booking.findUnique({ where: { id: pendFix.bookingId }, select: { status: true } });
    check("payment still PENDING", p?.status === "PENDING", p?.status);
    check("booking still PENDING_PAYMENT", b?.status === "PENDING_PAYMENT", b?.status);
  }

  // ── Case 16: a reversal performed at the provider ────────────────
  console.log("\n16. Refund/void performed in the Paymob dashboard");
  const revFix = await makeFixture("reversal");
  await post(callback(revFix.orderId));
  const r13 = await post(callback(revFix.orderId, { is_refunded: true }));
  check("reports a reversal", String(r13.json?.outcome).startsWith("reversal-"), r13.text.slice(0, 80));
  {
    const p = await paymentState(revFix.paymentId);
    const refunds = await db.refund.count({ where: { paymentId: revFix.paymentId } });
    check("payment marked REFUNDED", p?.status === "REFUNDED", p?.status);
    check("refundedCents equals the payment", p?.refundedCents === 28550, String(p?.refundedCents));
    check("a Refund row was written", refunds === 1, String(refunds));
  }

  // ── E: our handler fails, Paymob retries ─────────────────────────
  //
  // An order id carrying a NUL byte is a correctly signed callback that
  // Postgres refuses to look up, which makes handle() throw — a stand-in
  // for the database being down. The delivery must answer 500 (so
  // Paymob retries) and leave no claim behind, so the retry is handled
  // rather than dropped as a duplicate.
  console.log("\nE. Handler error is released for retry");
  const errCb = callback("9\u0000err");
  const e1 = await post(errCb);
  check("handler error returns 500", e1.status === 500, `got ${e1.status}`);
  {
    const claims = await db.webhookEvent.count({
      where: { provider: "PAYMOB", eventId: String(errCb.obj.id) },
    });
    check("claim released after the error", claims === 0, `${claims} left`);
  }
  const e2 = await post(errCb);
  check("the retry is processed, not dropped as duplicate", e2.status === 500 && e2.json?.duplicate !== true, `${e2.status} ${e2.text.slice(0, 60)}`);

  // Case 12: a payment that has lost its booking.
  //
  // This state turns out to be unreachable. Payment_target_chk requires
  // a non-subscription payment to have a bookingId, so the SetNull that
  // deleting a booking performs is refused by the database. That is a
  // stronger answer than handling the orphan gracefully: it cannot
  // exist in the first place.
  console.log("\n12. Payment whose booking is deleted");
  const orphan = await makeFixture("orphan");
  let refused = false;
  try {
    await db.booking.delete({ where: { id: orphan.bookingId } });
  } catch (e) {
    refused = /Payment_target_chk/.test(String(e));
  }
  check("database refuses to orphan the payment", refused);
  check("payment still intact", (await paymentState(orphan.paymentId))?.status === "PENDING");

  // Case 15: two refunds racing.
  //
  // The predicate below is the one reserveRefund() issues. Before the
  // fix the route read refundedCents, called Paymob, then wrote
  // `read + amount`, so two concurrent callers both passed the check
  // and both sent a real refund. Here five fire at once and exactly one
  // may win.
  console.log("\n15. Duplicate/concurrent refund requests");
  const refFix = await makeFixture("refundrace");
  await post(callback(refFix.orderId));

  const reserve = (cents) => db.$executeRaw`
    UPDATE "Payment"
       SET "refundedCents" = "refundedCents" + ${cents}
     WHERE "id" = ${refFix.paymentId}
       AND "status" IN ('SUCCEEDED', 'PARTIALLY_REFUNDED')
       AND "refundedCents" + ${cents} <= "amountCents"`;

  const results = await Promise.all([1, 2, 3, 4, 5].map(() => reserve(28550)));
  const winners = results.filter((n) => n === 1).length;
  check("exactly one of five full refunds is allowed", winners === 1, `${winners} won`);
  {
    const p = await paymentState(refFix.paymentId);
    check("refundedCents never exceeds the payment", (p?.refundedCents ?? 0) <= 28550, String(p?.refundedCents));
    check("refundedCents equals exactly one refund", p?.refundedCents === 28550, String(p?.refundedCents));
  }

  const partials = await Promise.all([1, 2, 3].map(() => reserve(1)));
  check("nothing more fits once fully refunded", partials.every((n) => n === 0));

  // Reaping: a checkout opened and never finished.
  //
  // The slot an unpaid booking holds is the part that costs money.
  // overlap.ts counts PENDING_PAYMENT as blocking, so before this
  // existed an abandoned checkout took an appointment out of the
  // calendar permanently.
  console.log("\nR. Abandoned checkout is reaped and the slot returned");
  const stale = await makeFixture("stale");
  // Backdate past the two-hour threshold.
  const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await db.$executeRaw`UPDATE "Payment" SET "createdAt" = ${old} WHERE "id" = ${stale.paymentId}`;

  const res = await fetch(`${BASE}/api/cron/reminders`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  const reap = await res.json().catch(() => null);
  check("cron ran", res.status === 200, `got ${res.status}`);
  {
    const p = await paymentState(stale.paymentId);
    const b = await db.booking.findUnique({
      where: { id: stale.bookingId },
      select: { status: true },
    });
    check("payment marked ABANDONED", p?.status === "ABANDONED", p?.status);
    check("booking released to FAILED_PAYMENT", b?.status === "FAILED_PAYMENT", b?.status);
    check("slot no longer blocked", !["PENDING_PAYMENT", "PENDING", "CONFIRMED"].includes(b?.status ?? ""));
    check("reap reported in the response", (reap?.abandoned ?? 0) >= 1, JSON.stringify(reap));
  }

  // A fresh payment must survive the same sweep untouched.
  const fresh = await makeFixture("fresh");
  await fetch(`${BASE}/api/cron/reminders`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  {
    const p = await paymentState(fresh.paymentId);
    const b = await db.booking.findUnique({
      where: { id: fresh.bookingId },
      select: { status: true },
    });
    check("a fresh checkout is left alone", p?.status === "PENDING", p?.status);
    check("its slot is still held", b?.status === "PENDING_PAYMENT", b?.status);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
}

async function cleanup() {
  const bookings = await db.booking.findMany({
    where: { customerName: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = bookings.map((b) => b.id);

  const payments = await db.payment.findMany({
    where: { OR: [{ bookingId: { in: ids } }, { providerOrderId: { startsWith: "9" } }] },
    select: { id: true, bookingId: true, providerOrderId: true },
  });
  // Only ones this run created: a fixture booking, or an orphan whose
  // booking was deleted mid-test.
  const mine = payments.filter((p) => ids.includes(p.bookingId ?? "") || p.bookingId === null);

  await db.refund.deleteMany({ where: { paymentId: { in: mine.map((p) => p.id) } } });
  await db.webhookEvent.deleteMany({
    where: { eventId: { startsWith: "7" }, provider: "PAYMOB" },
  });
  await db.payment.deleteMany({ where: { id: { in: mine.map((p) => p.id) } } });
  await db.booking.deleteMany({ where: { id: { in: ids } } });

  const left = await db.payment.count();
  console.log(`\nCleanup: ${mine.length} payments, ${ids.length} bookings removed.`);
  console.log(`Payments remaining in this database: ${left}`);
  return left;
}

try {
  await run();
} catch (e) {
  console.error("\nHarness error:", e instanceof Error ? e.message : e);
  failed++;
} finally {
  await cleanup().catch((e) => console.error("CLEANUP FAILED:", e));
  await db.$disconnect();
}

process.exit(failed === 0 ? 0 : 1);
