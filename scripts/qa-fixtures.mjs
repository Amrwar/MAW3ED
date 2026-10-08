/**
 * Test accounts and data for the QA pass.
 *
 * Only ever run against a LOCAL database — it refuses to run against
 * anything else, because it creates accounts with known passwords and
 * an account with a known password on a production host is a way in,
 * not a fixture.
 *
 * Everything it writes is obviously synthetic: names say "QA", phones
 * are in the 0100000000x block, emails are @qa.test. Nothing here is
 * meant to look like a real customer, and nothing here should ever
 * appear in a count of real businesses.
 *
 *   node scripts/qa-fixtures.mjs
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();

if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to run: DATABASE_URL points at "${host}", not a local database.`);
  console.error("These fixtures create accounts with known passwords.");
  process.exit(2);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/** One password for every fixture account. Local only, by the guard above. */
const PASSWORD = "QaPassword123!";

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const category = await db.category.findFirstOrThrow({ where: { slug: "salons" } });
  const city = await db.city.findFirstOrThrow({ where: { slug: "cairo" } });

  // ── People ──────────────────────────────────────────────────────
  const customer = await db.user.upsert({
    where: { email: "customer@qa.test" },
    update: {},
    create: {
      email: "customer@qa.test",
      name: "QA Customer",
      password: hash,
      // Canonical form: accountForVerifiedPhone stores the normalised
      // number, and the account pages match it against the booking's
      // generated customerPhoneE164 column.
      phone: "201000000001",
      phoneVerifiedAt: new Date(),
      emailVerified: new Date(),
    },
  });

  const owner = await db.user.upsert({
    where: { email: "owner@qa.test" },
    update: {},
    create: {
      email: "owner@qa.test",
      name: "QA Owner",
      password: hash,
      phone: "201000000002",
      phoneVerifiedAt: new Date(),
      emailVerified: new Date(),
    },
  });

  // A second owner, so cross-tenant access can actually be attempted.
  const rival = await db.user.upsert({
    where: { email: "rival@qa.test" },
    update: {},
    create: {
      email: "rival@qa.test",
      name: "QA Rival Owner",
      password: hash,
      phone: "201000000003",
      phoneVerifiedAt: new Date(),
      emailVerified: new Date(),
    },
  });

  // One account per admin role, so "permissions actually differ" is
  // something that can be tested rather than assumed.
  const admins = {};
  for (const [key, role] of [
    ["moderator", "MODERATOR"],
    ["admin", "ADMIN"],
    ["superadmin", "SUPER_ADMIN"],
  ]) {
    admins[key] = await db.user.upsert({
      where: { email: `${key}@qa.test` },
      update: { adminRole: role },
      create: {
        email: `${key}@qa.test`,
        name: `QA ${role}`,
        password: hash,
        adminRole: role,
        emailVerified: new Date(),
      },
    });
  }

  // ── Two businesses, so one can try to reach the other ───────────
  async function makeBusiness(ownerUser, slug, nameAr) {
    const business = await db.business.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        nameAr,
        nameEn: nameAr,
        ownerId: ownerUser.id,
        categoryId: category.id,
        cityId: city.id,
        isPublished: true,
        plan: "PRO",
        subscriptionStatus: "ACTIVE",
        phone: "01000000009",
        address: "QA address",
      },
    });

    // No user.businessId column: a user owns a business through
    // Business.ownerId, and the session derives businessId from that.

    const service = await db.service.upsert({
      where: { id: `${slug}-svc` },
      update: {},
      create: {
        id: `${slug}-svc`,
        businessId: business.id,
        nameAr: "قص شعر",
        nameEn: "Haircut",
        duration: 30,
        price: 100,
        currency: "EGP",
        isAvailable: true,
      },
    });

    const staff = await db.staffMember.upsert({
      where: { id: `${slug}-staff` },
      update: {},
      create: {
        id: `${slug}-staff`,
        businessId: business.id,
        nameAr: "موظف تجريبي",
        isActive: true,
        workingDays: [0, 1, 2, 3, 4, 5, 6],
      },
    });

    // Open every day, so availability never depends on which day the
    // QA pass happens to run. The model is AvailabilityRule, and it
    // records isClosed rather than isOpen.
    for (let day = 0; day < 7; day++) {
      await db.availabilityRule.upsert({
        where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek: day } },
        update: { isClosed: false, openTime: "09:00", closeTime: "21:00" },
        create: {
          businessId: business.id,
          dayOfWeek: day,
          isClosed: false,
          openTime: "09:00",
          closeTime: "21:00",
        },
      });
    }

    return { business, service, staff };
  }

  const mine = await makeBusiness(owner, "qa-salon", "صالون كيو إيه");
  const theirs = await makeBusiness(rival, "qa-rival-salon", "صالون المنافس");

  // ── A booking for the customer, to exercise the account area ────
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const date = new Date(tomorrow.toISOString().slice(0, 10) + "T00:00:00Z");

  const booking = await db.booking.upsert({
    where: { id: "qa-booking-1" },
    update: {},
    create: {
      id: "qa-booking-1",
      businessId: mine.business.id,
      serviceId: mine.service.id,
      staffMemberId: mine.staff.id,
      customerName: "QA Customer",
      customerPhone: "01000000001",
      date,
      startTime: "10:00",
      endTime: "10:30",
      status: "CONFIRMED",
      totalPrice: 100,
      currency: "EGP",
    },
  });

  // A booking belonging to the OTHER business, for cross-tenant tests.
  const rivalBooking = await db.booking.upsert({
    where: { id: "qa-booking-rival" },
    update: {},
    create: {
      id: "qa-booking-rival",
      businessId: theirs.business.id,
      serviceId: theirs.service.id,
      customerName: "QA Rival Customer",
      customerPhone: "01000000004",
      date,
      startTime: "12:00",
      endTime: "12:30",
      status: "CONFIRMED",
      totalPrice: 100,
      currency: "EGP",
    },
  });

  console.log(
    JSON.stringify(
      {
        password: PASSWORD,
        customer: { email: customer.email, phone: customer.phone, id: customer.id },
        owner: { email: owner.email, businessId: mine.business.id, slug: "qa-salon" },
        rival: { email: rival.email, businessId: theirs.business.id, slug: "qa-rival-salon" },
        admins: Object.fromEntries(
          Object.entries(admins).map(([k, v]) => [k, { email: v.email, role: v.adminRole }]),
        ),
        bookings: { mine: booking.id, theirs: rivalBooking.id },
        services: { mine: mine.service.id, theirs: theirs.service.id },
        staff: { mine: mine.staff.id, theirs: theirs.staff.id },
      },
      null,
      1,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
