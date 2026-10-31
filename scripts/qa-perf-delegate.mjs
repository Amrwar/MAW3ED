/**
 * Performance check (Phase 22 post-audit): server response time of the
 * same dashboard pages for the owner and for a delegate operating the
 * business — the delegate path adds per-request delegation resolution
 * (cached once per request). Median of 5 warm requests each. Local only.
 *
 *   node scripts/qa-perf-delegate.mjs [baseUrl]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const B = process.argv.slice(2).find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const pg = new Client({ connectionString: "postgresql://qa:qa@localhost:5450/maw3ed_qa" });
await pg.connect();

async function login(email) {
  const jar = new Map();
  const take = (r) => { for (const l of r.headers.getSetCookie?.() ?? []) { const [p] = l.split(";"); const i = p.indexOf("="); jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const c = await fetch(`${B}/api/auth/csrf`); take(c);
  const { csrfToken } = await c.json();
  const H = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  take(await fetch(`${B}/api/auth/callback/credentials`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: H(), Origin: B }, body: new URLSearchParams({ csrfToken, email, password: "QaPassword123!", redirect: "false" }) }));
  return jar;
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
async function time(jar, path) {
  const H = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  await fetch(`${B}${path}`, { headers: { Cookie: H } }); // warm
  const xs = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    const r = await fetch(`${B}${path}`, { headers: { Cookie: H } });
    await r.text();
    xs.push(performance.now() - t);
  }
  return median(xs);
}

const salon = (await pg.query(`SELECT id, "ownerId" FROM "Business" WHERE slug='qa-salon'`)).rows[0];
const rivalId = (await pg.query(`SELECT id FROM "User" WHERE email='rival@qa.test'`)).rows[0].id;
await pg.query(`INSERT INTO "VenueOrganization"(id,slug,"nameAr",kind,status,"isPublished","updatedAt") VALUES ('qa-perf-org','qa-perf-org','perf','BUSINESS_GROUP','APPROVED',false,now()) ON CONFLICT DO NOTHING`);
await pg.query(`INSERT INTO "VenueRole"(id,"userId",kind,"organizationId","createdAt") VALUES ('qa-perf-role',$1,'ORGANIZATION_ADMIN','qa-perf-org',now()) ON CONFLICT DO NOTHING`, [rivalId]);
await pg.query(`INSERT INTO "OrganizationBusiness"(id,"organizationId","businessId",relation,status,"initiatedById",scopes,"updatedAt") VALUES ('qa-perf-a','qa-perf-org',$1,'OWNED','APPROVED',$2,'{RESERVATIONS,CUSTOMERS,SERVICES,STAFF,SCHEDULES,PROFILE,REPORTS,FINANCE}',now()) ON CONFLICT DO NOTHING`, [salon.id, salon.ownerId]);
try {
  const owner = await login("owner@qa.test");
  const delegate = await login("rival@qa.test");
  delegate.set("maw3ed-acting", salon.id);
  console.log("page".padEnd(34), "owner ms", "delegate ms", "delta");
  for (const p of ["/dashboard", "/dashboard/bookings", "/dashboard/customers", "/dashboard/services", "/dashboard/reports/performance", "/api/business/bookings?limit=20"]) {
    const o = await time(owner, p);
    const d = await time(delegate, p);
    console.log(p.padEnd(34), o.toFixed(0).padStart(8), d.toFixed(0).padStart(11), `${(d - o >= 0 ? "+" : "")}${(d - o).toFixed(0)}`);
  }
} finally {
  await pg.query(`DELETE FROM "VenueOrganization" WHERE id='qa-perf-org'`);
  await pg.end();
}
