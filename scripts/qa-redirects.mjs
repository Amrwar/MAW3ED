/**
 * Redirect-loop audit (Phase 22 post-audit): every route a person can
 * land on must end — within a few hops, never revisiting a URL — on a
 * page that answers (2xx) or says it does not exist (404), for every
 * kind of visitor, including the acting states Phase 22 introduced.
 *
 * Follows redirects by hand (max 10 hops) so a loop is caught and
 * reported instead of hanging. Local only.
 *
 *   node scripts/qa-redirects.mjs [baseUrl] [--db url]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const args = process.argv.slice(2);
const B = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const DB = args.includes("--db") ? args[args.indexOf("--db") + 1] : "postgresql://qa:qa@localhost:5450/maw3ed_qa";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB) || !/^http:\/\/localhost[:/]/.test(B)) {
  console.error("Local only.");
  process.exit(1);
}
const MAX_HOPS = 10;
const pg = new Client({ connectionString: DB });
await pg.connect();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  if (!ok) console.log(`FAIL  ${name}${detail ? "  — " + detail : ""}`);
};

async function login(email, password = "QaPassword123!") {
  const jar = new Map();
  const take = (r) => { for (const l of r.headers.getSetCookie?.() ?? []) { const [p] = l.split(";"); const i = p.indexOf("="); jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };
  const c = await fetch(`${B}/api/auth/csrf`); take(c);
  const { csrfToken } = await c.json();
  const H = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  take(await fetch(`${B}/api/auth/callback/credentials`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: H(), Origin: B }, body: new URLSearchParams({ csrfToken, email, password, redirect: "false" }) }));
  return jar;
}

/** Follows the chain; returns it, and whether it ended within the limit without revisiting. */
async function chain(jar, start) {
  const seen = [];
  let url = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    seen.push(url);
    const headers = jar ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {};
    const r = await fetch(`${B}${url}`, { redirect: "manual", headers });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location") ?? "";
      const next = loc.startsWith("http") ? new URL(loc).pathname + new URL(loc).search : loc;
      if (seen.includes(next)) return { seen: [...seen, next], status: r.status, loop: true };
      url = next;
      continue;
    }
    return { seen, status: r.status, loop: false };
  }
  return { seen, status: 0, loop: true };
}

const URLS = [
  "/", "/en", "/dashboard", "/en/dashboard", "/dashboard/billing", "/en/dashboard/billing", "/dashboard/services",
  "/dashboard/settings?tab=subscription", "/dashboard/reports", "/org-admin", "/org-admin/no-such-org",
  "/groups", "/groups/no-such-org", "/en/groups/no-such-org", "/venue-admin", "/onboarding", "/login", "/account",
];

try {
  const salon = (await pg.query(`SELECT id, "ownerId" FROM "Business" WHERE slug='qa-salon'`)).rows[0];
  const rivalId = (await pg.query(`SELECT id FROM "User" WHERE email='rival@qa.test'`)).rows[0].id;
  // A delegation for rival@qa.test over qa-salon (all scopes), and an
  // organization role for the admin account (no business of its own).
  await pg.query(`INSERT INTO "VenueOrganization"(id,slug,"nameAr",kind,status,"isPublished","updatedAt") VALUES ('qa-redir-org','qa-redir-org','redir','BUSINESS_GROUP','APPROVED',false,now()) ON CONFLICT DO NOTHING`);
  await pg.query(`INSERT INTO "VenueRole"(id,"userId",kind,"organizationId","createdAt") VALUES ('qa-redir-role',$1,'ORGANIZATION_ADMIN','qa-redir-org',now()) ON CONFLICT DO NOTHING`, [rivalId]);
  await pg.query(`INSERT INTO "OrganizationBusiness"(id,"organizationId","businessId",relation,status,"initiatedById",scopes,"updatedAt") VALUES ('qa-redir-a','qa-redir-org',$1,'MANAGED','APPROVED',$2,'{RESERVATIONS,CUSTOMERS,SERVICES,STAFF,SCHEDULES,PROFILE,REPORTS}',now()) ON CONFLICT DO NOTHING`, [salon.id, salon.ownerId]);

  const owner = await login("owner@qa.test");
  const delegate = await login("rival@qa.test");
  delegate.set("maw3ed-acting", salon.id);
  const ownerStale = await login("owner@qa.test");
  ownerStale.set("maw3ed-acting", "staleorforgedvalue12345");
  const noBizStale = await login("admin@qa.test");
  noBizStale.set("maw3ed-acting", "staleorforgedvalue12345");
  const orgMember = await login("rival@qa.test"); // has a business AND a role, not acting

  const identities = { anonymous: null, owner, delegate, "owner+stale-cookie": ownerStale, "no-business+stale-cookie": noBizStale, "org-member": orgMember };
  let longest = 0;
  for (const [who, jar] of Object.entries(identities)) {
    for (const u of URLS) {
      const r = await chain(jar, u);
      longest = Math.max(longest, r.seen.length - 1);
      check(`${who} ${u} terminates`, !r.loop && (r.status < 300 || r.status === 404), `${r.status} ${r.seen.join(" → ")}`);
    }
  }
  console.log(`longest chain: ${longest} redirect(s)`);
} catch (e) {
  check("script ran to the end", false, String(e?.stack ?? e));
} finally {
  await pg.query(`DELETE FROM "VenueOrganization" WHERE id='qa-redir-org'`).catch(() => {});
  await pg.query(`DELETE FROM "RateLimit"`).catch(() => {});
  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
