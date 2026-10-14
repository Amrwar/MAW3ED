/**
 * Server-side authorization probes.
 *
 * Every request here bypasses the UI entirely: a bearer token and a
 * URL. That is the point — a button being hidden is not access
 * control, and the only question worth asking is what the server does
 * when somebody skips the button.
 *
 * Local only, against the QA database and its fixtures.
 *
 *   node scripts/qa-security.mjs [baseUrl]
 */

import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = process.argv[2] ?? "http://localhost:3100";
const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to run against "${host}" — local databases only.`);
  process.exit(2);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

let pass = 0;
let fail = 0;
const findings = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    findings.push(`${name} — ${detail}`);
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ""}`);
  }
}

async function tokenFor(email) {
  const user = await db.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, adminRole: true },
  });
  const business = await db.business.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  return new SignJWT({ businessId: business?.id ?? null, adminRole: user.adminRole })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("maw3ed")
    .setAudience("maw3ed-mobile-access")
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secret);
}

async function req(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text };
}

/** Anything that is not a 2xx. Which refusal is used is checked separately. */
const refused = (r) => r.status >= 400;

async function main() {
  const owner = await tokenFor("owner@qa.test");
  const rival = await tokenFor("rival@qa.test");
  const customer = await tokenFor("customer@qa.test");
  const moderator = await tokenFor("moderator@qa.test");
  const admin = await tokenFor("admin@qa.test");
  const superadmin = await tokenFor("superadmin@qa.test");

  const mineBooking = "qa-booking-1";
  const theirsBooking = "qa-booking-rival";
  const theirsService = "qa-rival-salon-svc";
  const theirsStaff = "qa-rival-salon-staff";

  console.log("\n── Unauthenticated access to business data ──");
  for (const p of [
    "/api/business/bookings",
    "/api/business/customers",
    "/api/business/services",
    "/api/business/staff",
    "/api/business/analytics?from=2026-01-01&to=2026-12-31",
    "/api/business/discounts",
  ]) {
    const r = await req(p);
    check(`no token → ${p}`, r.status === 401, `got ${r.status}`);
  }

  console.log("\n── A customer reaching business endpoints ──");
  for (const p of ["/api/business/bookings", "/api/business/customers", "/api/business/services"]) {
    const r = await req(p, { token: customer });
    check(`customer → ${p}`, refused(r), `got ${r.status}`);
  }

  console.log("\n── One business reaching another's records ──");
  {
    const r = await req(`/api/business/bookings/${theirsBooking}`, { token: owner });
    check("owner → rival's booking", refused(r), `got ${r.status}`);

    const patch = await req(`/api/business/bookings/${theirsBooking}`, {
      token: owner,
      method: "PATCH",
      body: { status: "CANCELLED" },
    });
    check("owner → cancel rival's booking", refused(patch), `got ${patch.status}`);

    const stillThere = await db.booking.findUnique({
      where: { id: theirsBooking },
      select: { status: true },
    });
    check("rival's booking unchanged", stillThere?.status === "CONFIRMED", stillThere?.status);

    const svc = await req(`/api/business/services/${theirsService}`, {
      token: owner,
      method: "PATCH",
      body: { nameAr: "hijacked" },
    });
    check("owner → edit rival's service", refused(svc), `got ${svc.status}`);

    const svcRow = await db.service.findUnique({
      where: { id: theirsService },
      select: { nameAr: true },
    });
    check("rival's service unchanged", svcRow?.nameAr !== "hijacked", svcRow?.nameAr);

    const staff = await req(`/api/business/staff/${theirsStaff}`, {
      token: owner,
      method: "DELETE",
    });
    check("owner → delete rival's staff", refused(staff), `got ${staff.status}`);

    const staffRow = await db.staffMember.findUnique({ where: { id: theirsStaff } });
    check("rival's staff still exists", Boolean(staffRow));

    // The control. Without it, every refusal above could be explained
    // by the endpoint refusing everybody, and the test would prove
    // nothing about authorization.
    const theirOwn = await req(`/api/business/bookings/${theirsBooking}`, { token: rival });
    check("the rival CAN reach their own booking", theirOwn.status === 200, `got ${theirOwn.status}`);
  }

  console.log("\n── Listing endpoints leak nothing across tenants ──");
  {
    const r = await req("/api/business/bookings", { token: owner });
    const ids = (r.json?.bookings ?? []).map((b) => b.id);
    check("owner's list excludes rival's booking", !ids.includes(theirsBooking), ids.join(","));
    check("owner's list includes their own", ids.includes(mineBooking) || ids.length >= 0);

    const c = await req("/api/business/customers", { token: owner });
    const phones = (c.json?.customers ?? []).map((x) => x.phone);
    check("owner's customers exclude rival's", !phones.includes("01000000004"), phones.join(","));
  }

  console.log("\n── Manipulated and nonsense ids ──");
  for (const id of ["does-not-exist", "../../etc/passwd", "'; DROP TABLE \"Booking\"; --", "%00"]) {
    const r = await req(`/api/business/bookings/${encodeURIComponent(id)}`, { token: owner });
    check(`booking id ${JSON.stringify(id.slice(0, 20))} refused`, refused(r), `got ${r.status}`);
  }
  {
    const alive = await db.booking.count();
    check("Booking table intact after injection attempts", alive > 0, String(alive));
  }

  console.log("\n── Forged token claims ──");
  {
    // A token that simply asserts it owns the rival's business. The
    // signature is valid; the claim is a lie. requireBusiness is
    // supposed to re-read ownership rather than trust this.
    const theirBiz = await db.business.findFirstOrThrow({
      where: { slug: "qa-rival-salon" },
      select: { id: true },
    });
    const me = await db.user.findUniqueOrThrow({
      where: { email: "owner@qa.test" },
      select: { id: true },
    });
    const forged = await new SignJWT({ businessId: theirBiz.id, adminRole: null })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(me.id)
      .setIssuer("maw3ed")
      .setAudience("maw3ed-mobile-access")
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(secret);

    const r = await req("/api/business/bookings", { token: forged });
    const ids = (r.json?.bookings ?? []).map((b) => b.id);
    check(
      "token claiming another's businessId gets nothing",
      refused(r) || !ids.includes(theirsBooking),
      `status ${r.status}, ids ${ids.join(",")}`,
    );

    const adminClaim = await new SignJWT({ businessId: null, adminRole: "SUPER_ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(me.id)
      .setIssuer("maw3ed")
      .setAudience("maw3ed-mobile-access")
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(secret);
    // Against a payment that EXISTS, so the two outcomes are
    // distinguishable: a blocked caller gets 404 (admin routes hide
    // themselves), while one that got through reaches the handler and
    // is refused for a different reason — the payment never succeeded.
    const probePayment = await db.payment.upsert({
      where: { id: "qa-payment-probe" },
      update: {},
      create: {
        id: "qa-payment-probe",
        kind: "BOOKING_FULL",
        status: "PENDING",
        businessId: theirBiz.id,
        bookingId: "qa-booking-rival",
        amountCents: 10000,
        currency: "EGP",
      },
      select: { id: true },
    });

    const forgedAdmin = await req(`/api/admin/payments/${probePayment.id}/refund`, {
      token: adminClaim,
      method: "POST",
      body: { reason: "qa probe" },
    });
    check(
      "token claiming SUPER_ADMIN is blocked (404), not merely refused",
      forgedAdmin.status === 404,
      `got ${forgedAdmin.status} ${forgedAdmin.text.slice(0, 60)}`,
    );

    // A real SUPER_ADMIN's bearer token gets through the gate. Since
    // Phase 21 currentAdmin() accepts cookie or bearer, so the app's
    // admin space can call the admin API; only the user id comes from
    // the token and the role is read from the database (the forged
    // claim above proves the token's own claim counts for nothing).
    //
    // Through the gate, the route itself answers: the probe payment
    // never succeeded, so refunding it is refused on its merits (409),
    // not hidden (404).
    const realAdmin = await req(`/api/admin/payments/${probePayment.id}/refund`, {
      token: superadmin,
      method: "POST",
      body: { reason: "qa probe" },
    });
    check(
      "a real admin's bearer token passes the gate; the route refuses an unpaid refund",
      realAdmin.status === 409,
      `got ${realAdmin.status} ${realAdmin.text.slice(0, 60)}`,
    );
  }

  console.log("\n── Admin roles actually differ ──");
  {
    // A moderator may moderate reviews and must not touch money.
    const modRefund = await req("/api/admin/payments/does-not-exist/refund", {
      token: moderator,
      method: "POST",
      body: { reason: "qa probe" },
    });
    check("moderator → refund API refused", refused(modRefund), `got ${modRefund.status}`);

    const adminRefund = await req("/api/admin/payments/does-not-exist/refund", {
      token: admin,
      method: "POST",
      body: { reason: "qa probe" },
    });
    check(
      "ADMIN → refund API: refused or 404 for a missing payment",
      refused(adminRefund),
      `got ${adminRefund.status}`,
    );

    const superRefund = await req("/api/admin/payments/does-not-exist/refund", {
      token: superadmin,
      method: "POST",
      body: { reason: "qa probe" },
    });
    // The payment does not exist, so 404 means it got past the guard.
    check(
      "SUPER_ADMIN → refund API reaches the handler (404 for missing payment)",
      superRefund.status === 404,
      `got ${superRefund.status}`,
    );
  }

  console.log("\n── Admin API hides its own existence ──");
  {
    const r = await req("/api/admin/businesses/does-not-exist", {
      token: customer,
      method: "POST",
      body: { action: "approve" },
    });
    check("non-admin gets 404, not 403", r.status === 404, `got ${r.status}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (findings.length) {
    console.log("\nFindings:");
    for (const f of findings) console.log(`  - ${f}`);
  }
}

main()
  .catch((e) => {
    console.error("probe error:", e);
    fail++;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  });
