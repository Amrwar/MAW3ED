/**
 * Phase 17 end to end: the fixes, on a production build, against the
 * QA database and its fixtures (scripts/qa-fixtures.mjs).
 *
 *   "any available" given to free staff, and refused once all are busy;
 *   a booking's email kept on the booking; no unbuilt Premium features,
 *   overstated claims or "0 EGP" on public pages; a 22:30 booking in the
 *   owner's Today list; a manual booking keeps the email typed for it.
 *
 * Local only: it writes bookings and a temporary staff member, and
 * removes them afterwards.
 *
 *   npm run build && npx next start -p 3101
 *   node scripts/qa-phase17.mjs [baseUrl] [databaseUrl]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { Client } = require("pg");

const B = process.argv[2] ?? "http://localhost:3101";
const DB = process.argv[3] ?? "postgresql://qa:qa@localhost:5450/maw3ed_qa";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB) || !/^http:\/\/localhost[:/]/.test(B)) {
  console.error("Local only: this writes bookings.");
  process.exit(1);
}
const pg = new Client({ connectionString: DB });
await pg.connect();
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const created = [];

try {
  // A second member who can take the service: qa-dr-1 is listed only
  // for another business's service, so qa-listing-0 has one otherwise.
  await pg.query(`insert into "StaffMember" (id, "businessId", "nameAr", "workingDays", "updatedAt")
                  select 'p17-staff-3', id, 'P17 مؤقت', '{}', now() from "Business" where slug='qa-listing-0'
                  on conflict (id) do nothing`);

  // ── 1. "Any available" at a business with two staff ─────────────
  const slug = "qa-listing-0";
  const prof = await (await fetch(`${B}/api/public/${slug}`)).json();
  const biz = prof.data ?? prof;
  const service = (biz.services ?? biz.business?.services)[0];
  // Who can be booked for this service: active, and listed for it or for nothing.
  const staffCount = Number((await pg.query(
    `select count(*) from "StaffMember" s join "Business" b on b.id=s."businessId"
      where b.slug=$1 and s."isActive"
        and (not exists (select 1 from "StaffService" x where x."staffMemberId"=s.id)
             or exists (select 1 from "StaffService" x where x."staffMemberId"=s.id and x."serviceId"=$2))`,
    [slug, service.id])).rows[0].count);
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const slots = await (await fetch(`${B}/api/public/${slug}/slots?serviceId=${service.id}&date=${date}`)).json();
  const slotList = (slots.data ?? slots).slots;
  const T = slotList[0];
  check("slots offered for 'anyone'", Array.isArray(slotList) && slotList.length > 0, `${slotList.length} slots, first ${T}, staff ${staffCount}`);

  const post = (i, email) => fetch(`${B}/api/public/${slug}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.17.0.${i}` },
    body: JSON.stringify({ serviceId: service.id, date, startTime: T, customerName: `P17 Test ${i}`, customerPhone: `0100000017${i}`, ...(email ? { customerEmail: email } : {}) }),
  });
  const responses = [];
  for (let i = 0; i <= staffCount; i++) {
    const r = await post(i, i === 0 ? "p17-typed@example.test" : undefined);
    const j = await r.json().catch(() => ({}));
    responses.push({ status: r.status, code: j.code, id: (j.data ?? j).booking?.id ?? (j.data ?? j).id });
  }
  const okCount = responses.filter((r) => r.status === 201 || r.status === 200).length;
  check(`exactly ${staffCount} bookings accepted at ${T}, one per staff member`, okCount === staffCount, JSON.stringify(responses.map((r) => `${r.status}:${r.code ?? ""}`)));

  const rows = (await pg.query(`select id, "staffMemberId", "customerEmail", status from "Booking" where "customerName" like 'P17 Test %' and date=$1::date`, [date])).rows;
  created.push(...rows.map((r) => r.id));
  check("each accepted 'anyone' booking was given a different staff member", new Set(rows.map((r) => r.staffMemberId)).size === rows.length && rows.every((r) => r.staffMemberId), JSON.stringify(rows.map((r) => r.staffMemberId)));
  check("the typed email is stored on the booking", rows.some((r) => r.customerEmail === "p17-typed@example.test"));

  const after = await (await fetch(`${B}/api/public/${slug}/slots?serviceId=${service.id}&date=${date}`)).json();
  check(`${T} is no longer offered once every staff member has it`, !(after.data ?? after).slots.includes(T));

  // ── 2. Public pages ────────────────────────────────────────────
  const home = await (await fetch(`${B}/`)).text();
  check("homepage: no 'verified businesses' / 'completely free' claim", !home.includes("أنشطة متحقّق منها") && !home.includes("الحجز مجاني تمامًا") && home.includes("من غير رسوم حجز"));
  for (const path of ["/pricing", "/en/pricing", "/", "/en"]) {
    const html = await (await fetch(B + path)).text();
    const bad = ["إخفاء شعار موعد", "دعم بأولوية", "تحليلات متقدمة", "وصول للـ API", "Remove Maw3ed branding", "Priority support", "Advanced analytics", "API access"].filter((s) => html.includes(s));
    check(`${path}: no unbuilt Premium feature advertised`, bad.length === 0, bad.join(", "));
  }
  const company = await (await fetch(`${B}/company/${slug}`)).text();
  check("business page JSON-LD has no '0 EGP' price range", !company.includes('"priceRange":"0 EGP"'));

  // ── 3. Owner's Today list holds a late-evening booking ──────────
  const cairoToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const salon = (await pg.query(`select b.id, (select id from "Service" s where s."businessId"=b.id limit 1) sid, (select id from "Customer" c where c."businessId"=b.id limit 1) cid from "Business" b where slug='qa-salon'`)).rows[0];
  const ref = `P17LATE${Date.now() % 100000}`;
  const late = (await pg.query(
    `insert into "Booking" (id, "businessId", "serviceId", "customerId", "customerName", "customerPhone", date, "startTime", "endTime", "startsAt", "endsAt", status, "totalPrice", currency, reference, "updatedAt")
     values ('p17late'||floor(random()*1e9)::text, $1, $2, $3, 'P17 Late', '01000000179', $4::date, '22:30', '23:00', ($4||' 22:30')::timestamp, ($4||' 23:00')::timestamp, 'CONFIRMED', 100, 'EGP', $5, now()) returning id`,
    [salon.id, salon.sid, salon.cid, cairoToday, ref])).rows[0];
  created.push(late.id);

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "owner@qa.test");
  await page.fill('input[type="password"]', "QaPassword123!");
  await Promise.all([page.waitForURL(/dashboard/, { timeout: 60000 }), page.click('button[type="submit"]')]);
  await page.goto(`${B}/dashboard/bookings/today`, { waitUntil: "networkidle" });
  const todayText = await page.textContent("body");
  check("owner's Today list shows a 22:30 booking", todayText.includes("P17 Late"), cairoToday);

  // ── 4. A booking the owner types in keeps the email they typed ──
  const manualDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const res = await page.request.post(`${B}/api/business/bookings`, {
    data: { serviceId: salon.sid, date: manualDate, startTime: "07:00", customerName: "P17 Manual", customerPhone: "01000000178", customerEmail: "p17-manual@example.test" },
  });
  const manual = (await pg.query(`select id, "customerEmail" from "Booking" where "customerName"='P17 Manual'`)).rows;
  created.push(...manual.map((r) => r.id));
  check("manual booking stores the email the owner typed", res.status() === 201 && manual[0]?.customerEmail === "p17-manual@example.test", `status ${res.status()}`);
  await browser.close();
} catch (e) {
  check("script ran", false, String(e?.stack ?? e).slice(0, 400));
} finally {
  if (created.length) {
    await pg.query(`delete from "NotificationDelivery" where "notificationId" in (select id from "Notification" where "bookingId" = any($1))`, [created]).catch(() => {});
    await pg.query(`delete from "Notification" where "bookingId" = any($1)`, [created]).catch(() => {});
    await pg.query(`delete from "Payment" where "bookingId" = any($1)`, [created]).catch(() => {});
    const del = await pg.query(`delete from "Booking" where id = any($1)`, [created]);
    console.log(`cleanup: ${del.rowCount} booking(s) removed`);
  }
  await pg.query(`delete from "StaffMember" where id = 'p17-staff-3'`).catch(() => {});
  await pg.query(`delete from "Customer" where name like 'P17 Test %' or name = 'P17 Manual'`).catch(() => {});
  await pg.end();
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
}
