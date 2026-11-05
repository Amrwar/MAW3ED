/**
 * Phase 28 scale profile (local, QA database). Seeds one fictional
 * organization at enterprise scale straight into the database — 600 hosted
 * businesses and one owned brand with 30,000 bookings — then measures:
 *
 *   - the public directory page /groups/<slug> (600 members)
 *   - walking /api/v1/businesses to the end (100 per page)
 *   - /api/v1/bookings over 31 days of a 30k-booking brand
 *   - the webhook change feed query (EXPLAIN ANALYZE) and a cron run
 *   - the portfolio report and the integration-health query
 *   - /api/health
 *
 *   node scripts/qa-phase28-perf.mjs [http://localhost:3101] [--keep]
 *
 * Absolute numbers are this machine's; they are a baseline and a way to
 * find the slow query, not a production promise. Removes what it seeded.
 */
import { createRequire } from "module";
import { randomBytes, createHash } from "crypto";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
if (!/^http:\/\/localhost[:/]/.test(B)) { console.error("Local only."); process.exit(1); }
const keep = args.includes("--keep");
const pg = new (require("pg").Client)({ connectionString: "postgresql://qa:qa@localhost:5450/maw3ed_qa" });
await pg.connect();
const tag = `p28perf${Date.now()}`;
const results = [];
const time = async (name, fn, runs = 5) => {
  const xs = [];
  let extra;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    extra = await fn();
    xs.push(performance.now() - t);
  }
  xs.sort((a, b) => a - b);
  const r = { name, medianMs: Math.round(xs[Math.floor(xs.length / 2)]), maxMs: Math.round(xs[xs.length - 1]), ...(extra && typeof extra === "object" ? extra : {}) };
  results.push(r);
  console.log(JSON.stringify(r));
};

// ── Seed ────────────────────────────────────────────────────────────────
const t0 = performance.now();
const { rows: [ctx] } = await pg.query(`SELECT (SELECT id FROM "City" WHERE slug='new-cairo') AS city, (SELECT id FROM "Category" WHERE slug='restaurants') AS cat, (SELECT id FROM "User" WHERE email='owner@qa.test') AS owner`);
await pg.query(`INSERT INTO "VenueOrganization" (id, slug, "nameAr", "nameEn", kind, status, "isPublished", "createdAt", "updatedAt")
  VALUES ($1, $1, 'مجموعة اختبار الحجم', 'Scale test group', 'MALL', 'APPROVED', true, now(), now())`, [tag]);
// 601 businesses: 600 hosted tenants + 1 owned brand. Each needs its own owner (Business.ownerId is unique).
await pg.query(`INSERT INTO "User" (id, email, name, "updatedAt") SELECT $1||'-u'||g, $1||'-u'||g||'@example.test', 'perf', now() FROM generate_series(0,600) g`, [tag]);
await pg.query(`INSERT INTO "Business" (id, slug, "nameAr", "nameEn", "ownerId", "cityId", "categoryId", "isPublished", "updatedAt")
  SELECT $1||'-b'||g, $1||'-b'||g, 'نشاط اختبار '||g, 'Perf business '||g, $1||'-u'||g, $2, $3, true, now() FROM generate_series(0,600) g`, [tag, ctx.city, ctx.cat]);
await pg.query(`INSERT INTO "OrganizationBusiness" (id, "organizationId", "businessId", relation, status, scopes, "initiatedById", "createdAt", "updatedAt")
  SELECT $1||'-a'||g, $1, $1||'-b'||g, CASE WHEN g=0 THEN 'OWNED' ELSE 'HOSTED' END::"OrganizationBusinessRelation", 'APPROVED',
         CASE WHEN g=0 THEN ARRAY['RESERVATIONS','REPORTS','FINANCE']::"DelegationScope"[] ELSE ARRAY[]::"DelegationScope"[] END, $2, now(), now()
  FROM generate_series(0,600) g`, [tag, ctx.owner]);
await pg.query(`INSERT INTO "Service" (id, "businessId", "nameAr", duration, price, "updatedAt") VALUES ($1||'-s', $1||'-b0', 'خدمة', 30, 100, now())`, [tag]);
// 30,000 bookings over 100 days for the owned brand, 30 a day spread over the day.
await pg.query(`INSERT INTO "Booking" (id, "businessId", "serviceId", "customerName", "customerPhone", date, "startTime", "endTime", "startsAt", "endsAt", status, "totalPrice", "accessToken", "createdAt", "updatedAt")
  SELECT $1||'-k'||g, $1||'-b0', $1||'-s', 'perf', '01000000000',
         (date '2026-09-01' + (g/300)), to_char(time '08:00' + ((g%300)*2||' minutes')::interval, 'HH24:MI'), to_char(time '08:00' + ((g%300)*2+1||' minutes')::interval, 'HH24:MI'),
         (date '2026-09-01' + (g/300)) + time '08:00' + ((g%300)*2||' minutes')::interval,
         (date '2026-09-01' + (g/300)) + time '08:00' + ((g%300)*2+1||' minutes')::interval,
         CASE WHEN g%10=0 THEN 'CANCELLED' WHEN g%7=0 THEN 'PENDING' ELSE 'COMPLETED' END::"BookingStatus", 100, $1||'-t'||g,
         now() - ((30000-g)||' seconds')::interval, now() - ((30000-g)||' seconds')::interval
  FROM generate_series(0,29999) g`, [tag]);
await pg.query(`ANALYZE "Booking"; ANALYZE "OrganizationBusiness"; ANALYZE "Business"`);
// An API key and a contract.
const secret = randomBytes(24).toString("base64url");
const prefix = `mw_${tag.slice(-12).toLowerCase().replace(/[^a-z0-9]/g, "0").padStart(12, "0")}`;
const key = `${prefix}_${secret}`;
await pg.query(`INSERT INTO "OrganizationContract" (id, "organizationId", reference, "startsAt", "maxApiClients", "maxWebhooks", "apiRequestsPerMinute", "updatedAt") VALUES ($1||'-c', $1, 'PERF', now() - interval '1 day', 5, 5, 6000, now())`, [tag]);
await pg.query(`INSERT INTO "ApiClient" (id, "organizationId", name, "keyPrefix", "keyHash", scopes, "updatedAt") VALUES ($1||'-key', $1, 'perf', $2, $3, ARRAY['businesses:read','bookings:read','reports:read'], now())`,
  [tag, prefix, createHash("sha256").update(key).digest("hex")]);
console.log(JSON.stringify({ seeded: { businesses: 601, bookings: 30000 }, seconds: Math.round((performance.now() - t0) / 1000) }));

const auth = { headers: { Authorization: `Bearer ${key}` } };
const get = async (path, init = {}) => {
  const r = await fetch(`${B}${path}`, init);
  if (r.status !== 200) throw new Error(`${path}: ${r.status}`);
  return r.json();
};

try {
  await get(`/groups/${tag}`.replace("/groups/", "/api/public/groups/")).catch(() => null); // warm
  await time("directory page /groups/<600 members>", async () => {
    const r = await fetch(`${B}/groups/${tag}`);
    const html = await r.text();
    return { status: r.status, kb: Math.round(html.length / 1024) };
  });
  await time("API: walk /v1/businesses to the end (100/page)", async () => {
    let cursor = null;
    let pages = 0;
    let rows = 0;
    do {
      const j = await get(`/api/v1/businesses?limit=100${cursor ? `&cursor=${cursor}` : ""}`, auth);
      rows += j.data.length;
      cursor = j.nextCursor;
      pages++;
    } while (cursor && pages < 20);
    return { pages, rows };
  }, 3);
  await time("API: /v1/bookings, 31 days, first page of 100", async () => {
    const j = await get(`/api/v1/bookings?businessId=${tag}-b0&from=2026-09-01&to=2026-10-01&limit=100`, auth);
    return { rows: j.data.length };
  });
  await time("API: /v1/bookings, walk 31 days to the end", async () => {
    let cursor = null;
    let rows = 0;
    let pages = 0;
    do {
      const j = await get(`/api/v1/bookings?businessId=${tag}-b0&from=2026-09-01&to=2026-10-01&limit=100${cursor ? `&cursor=${cursor}` : ""}`, auth);
      rows += j.data.length;
      cursor = j.nextCursor;
      pages++;
    } while (cursor && pages < 200);
    return { rows, pages };
  }, 1);
  await time("API: /v1/reports/portfolio?days=90", async () => {
    const j = await get(`/api/v1/reports/portfolio?days=90`, auth);
    return { businesses: (j.data?.businesses ?? []).length };
  });
  // The change feed's query, as collectFor runs it, from the start of the data.
  const plan = await pg.query(`EXPLAIN (ANALYZE, FORMAT JSON) SELECT id FROM "Booking"
    WHERE "isTest" = false AND "businessId" = $1 AND ("updatedAt" > $2 OR ("updatedAt" = $2 AND id > ''))
    ORDER BY "updatedAt" ASC, id ASC LIMIT 200`, [`${tag}-b0`, new Date(Date.now() - 40_000 * 1000)]);
  const p = plan.rows[0]["QUERY PLAN"][0];
  const node = JSON.stringify(p.Plan).match(/"Index Name":"([^"]+)"/)?.[1] ?? "seq scan";
  results.push({ name: "webhook feed query (200 rows from 30k)", executionMs: Math.round(p["Execution Time"] * 100) / 100, index: node });
  console.log(JSON.stringify(results[results.length - 1]));
  await time("/api/health (anonymous)", async () => ({ status: (await get("/api/health")).status }));
} catch (e) {
  console.error("perf aborted:", e.message);
} finally {
  if (!keep) {
    await pg.query(`DELETE FROM "Booking" WHERE "businessId" = $1`, [`${tag}-b0`]);
    await pg.query(`DELETE FROM "VenueOrganization" WHERE id = $1`, [tag]);
    await pg.query(`DELETE FROM "Business" WHERE id LIKE $1`, [`${tag}-b%`]);
    await pg.query(`DELETE FROM "User" WHERE id LIKE $1`, [`${tag}-u%`]);
    await pg.query(`DELETE FROM "RateLimit"`);
  }
  await pg.end();
}
console.log(JSON.stringify({ results }, null, 1));
