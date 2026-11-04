/**
 * Phase 28 over HTTP against a running server: two independent enterprise
 * organizations provisioned through the product's own APIs — no code per
 * organization — and kept apart.
 *
 *   A: a mall (fictional) — hosted tenants, a venue with the sandbox access
 *      provider and its own venue credential, an API key, a webhook.
 *   B: a restaurant group (fictional) — owned brands granting reservations,
 *      reports and finance, its own venue and credential, key and webhook.
 *
 *   node scripts/qa-phase28.mjs [http://localhost:3101]
 *
 * The server must run with WEBHOOK_ALLOW_PRIVATE=1 (a local test receiver)
 * and ACCESS_SANDBOX=1. Fictional data, removed at the end.
 */
import { createServer } from "http";
import { createHmac } from "crypto";
import {
  pg, part, check, login, call, send, json, account, business, organization, associate, slotNear, book,
  teardown, summary, made, cronHeaders, tag,
} from "./qa-phase24-lib.mjs";

const svc = (nameAr, nameEn, duration, price) => ({ nameAr, nameEn, duration, price });
const data = (b) => b?.data ?? b;
const bearer = (key) => ({ headers: { Authorization: `Bearer ${key}` } });
let failedHard = 0;

// A local receiver for both organizations' webhooks, by path.
const inbox = { A: [], B: [] };
const receiver = createServer((rq, rs) => {
  let body = "";
  rq.on("data", (c) => (body += c));
  rq.on("end", () => {
    const who = rq.url.endsWith("/a") ? "A" : "B";
    inbox[who].push({ body, sig: String(rq.headers["maw3ed-signature"] ?? "") });
    rs.statusCode = 200;
    rs.end("ok");
  });
});
await new Promise((r) => receiver.listen(0, "127.0.0.1", r));
const hookBase = `http://127.0.0.1:${receiver.address().port}`;
const verify = (body, header, secret) => {
  const parts = header.split(",");
  const t = Number(parts.find((p) => p.startsWith("t="))?.slice(2));
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return parts.some((p) => p === `v1=${expected}`);
};

try {
  const admin = await login("admin@qa.test");
  const cityId = (await pg.query(`SELECT id FROM "City" WHERE slug = 'new-cairo'`)).rows[0].id;

  // ── Provisioning ─────────────────────────────────────────────────────
  part("provisioning");
  const founderA = await account("p28-a", "Mall operator (test)");
  const founderB = await account("p28-b", "Restaurant group owner (test)");
  const orgA = await organization(founderA, admin, { slug: "p28-mall", kind: "MALL", nameAr: "مول تجريبي ٢٨", nameEn: "Test Mall 28" });
  const orgB = await organization(founderB, admin, { slug: "p28-group", kind: "RESTAURANT_GROUP", nameAr: "مجموعة مطاعم تجريبية ٢٨", nameEn: "Test Restaurant Group 28" });
  check("two independent organizations are registered and approved through the product", !!orgA?.id && !!orgB?.id && orgA.id !== orgB.id);

  const tenant1 = await business("p28-t1", { nameAr: "متجر تجريبي ١", nameEn: "Test Shop 1", category: "salons", services: [svc("خدمة", "Service", 30, 100)] });
  const tenant2 = await business("p28-t2", { nameAr: "متجر تجريبي ٢", nameEn: "Test Shop 2", category: "salons", services: [svc("خدمة", "Service", 30, 100)] });
  const brand1 = await business("p28-r1", { nameAr: "مطعم تجريبي ١", nameEn: "Test Restaurant 1", category: "restaurants", services: [svc("غدا", "Lunch", 60, 300)], plan: "PREMIUM" });
  const brand2 = await business("p28-r2", { nameAr: "مطعم تجريبي ٢", nameEn: "Test Restaurant 2", category: "restaurants", services: [svc("غدا", "Lunch", 60, 300)], plan: "PREMIUM" });
  await associate(founderA, orgA.id, tenant1, "HOSTED");
  await associate(founderA, orgA.id, tenant2, "HOSTED");
  await associate(founderB, orgB.id, brand1, "OWNED", { ask: ["RESERVATIONS", "REPORTS", "FINANCE"] });
  await associate(founderB, orgB.id, brand2, "OWNED", { ask: ["RESERVATIONS", "REPORTS"] });
  // The same tenant can also belong to the group as MANAGED (a second, legitimate relationship).
  const multi = await send(founderB, `/api/organizations/${orgB.id}/businesses`, "POST", { businessSlug: tenant1.slug, relation: "MANAGED", requestedScopes: ["REPORTS"] });
  check("one business can hold relationships with two organizations (HOSTED by A, MANAGED invite from B)", multi.status === 201, multi.status);

  const venues = {};
  for (const [k, o, founder] of [["A", orgA, founderA], ["B", orgB, founderB]]) {
    const v = data(await json(await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-p28v${k.toLowerCase()}`, kind: "MALL", nameAr: `مكان تجريبي ${k}`, nameEn: `Test venue ${k}`, organizationId: o.id, cityId }))).venue;
    made.venues.push(v.id);
    await send(admin, `/api/admin/venues/${v.id}`, "PATCH", { status: "ACTIVE", isPublished: true });
    made.sites.push(`SITE-${tag}-${k}`);
    const prov = await send(admin, `/api/venues/${v.id}/access`, "PUT", { providerSlug: "sandbox", siteRef: `SITE-${tag}-${k}` });
    const on = await send(founder, `/api/venues/${v.id}/access`, "PUT", { accessEnabled: true });
    const cred = await send(admin, `/api/admin/venues/${v.id}/access-credential`, "POST", { action: "set" });
    venues[k] = { id: v.id, ok: prov.status === 200 && on.status === 200 && cred.status === 200 };
  }
  check("each organization's venue has its own provider configuration and its own credential", venues.A.ok && venues.B.ok);
  const credRows = (await pg.query(`SELECT "venueId", "secretSealed" FROM "VenueAccessCredential" WHERE "venueId" = ANY($1)`, [[venues.A.id, venues.B.id]])).rows;
  check("…and the two credentials are different secrets, sealed at rest", credRows.length === 2 && credRows[0].secretSealed !== credRows[1].secretSealed && credRows.every((r) => r.secretSealed.startsWith("v1.")));

  for (const [o, ref, per] of [[orgA, "QA-MALL-28", 10], [orgB, "QA-GROUP-28", 60]]) {
    const c = await send(admin, `/api/admin/organizations/${o.id}/contract`, "PUT", {
      reference: ref, startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: null, maxApiClients: 2, maxWebhooks: 1, apiRequestsPerMinute: per,
    });
    check(`the platform records ${ref}: limits only, no prices`, c.status === 200, c.status);
  }
  const notAdmin = await send(founderA, `/api/admin/organizations/${orgA.id}/contract`, "PUT", { reference: "x", startsAt: new Date().toISOString(), maxApiClients: 20, maxWebhooks: 20, apiRequestsPerMinute: 6000 });
  check("an organization cannot set its own contract", notAdmin.status === 404 || notAdmin.status === 401 || notAdmin.status === 403, notAdmin.status);

  // ── Keys and webhooks ────────────────────────────────────────────────
  part("integrations");
  const keyA = data(await json(await send(founderA, `/api/organizations/${orgA.id}/api-clients`, "POST", { name: "Mall BI", scopes: ["organization:read", "businesses:read", "venues:read", "bookings:read", "reports:read"] })));
  const keyB = data(await json(await send(founderB, `/api/organizations/${orgB.id}/api-clients`, "POST", { name: "Group ERP", scopes: ["organization:read", "businesses:read", "venues:read", "bookings:read", "reports:read"] })));
  check("each owner makes an API key, shown once", /^mw_/.test(keyA?.key ?? "") && /^mw_/.test(keyB?.key ?? ""));
  const stored = (await pg.query(`SELECT "keyHash" FROM "ApiClient" WHERE "organizationId" = ANY($1)`, [[orgA.id, orgB.id]])).rows;
  check("only hashes are stored", stored.length === 2 && stored.every((r) => /^[0-9a-f]{64}$/.test(r.keyHash)) && !JSON.stringify(stored).includes(keyA.key));
  const cross = await send(founderA, `/api/organizations/${orgB.id}/api-clients`, "POST", { name: "x", scopes: ["organization:read"] });
  check("an owner cannot make keys for another organization", cross.status === 404, cross.status);

  const hookA = data(await json(await send(founderA, `/api/organizations/${orgA.id}/webhooks`, "POST", { url: `${hookBase}/a`, events: ["booking.created", "booking.updated", "association.updated"] })));
  const hookB = data(await json(await send(founderB, `/api/organizations/${orgB.id}/webhooks`, "POST", { url: `${hookBase}/b`, events: ["booking.created", "booking.updated", "association.updated"] })));
  check("each owner adds a webhook with its own signing secret", /^whsec_/.test(hookA?.secret ?? "") && /^whsec_/.test(hookB?.secret ?? "") && hookA.secret !== hookB.secret);
  const second = await send(founderB, `/api/organizations/${orgB.id}/webhooks`, "POST", { url: `${hookBase}/b2`, events: ["booking.created"] });
  check("the contract's webhook limit holds", second.status === 409, second.status);

  // ── Isolation through the API ────────────────────────────────────────
  part("isolation");
  const listA = data(await json(await call(null, "/api/v1/businesses", bearer(keyA.key))));
  const listB = data(await json(await call(null, "/api/v1/businesses", bearer(keyB.key))));
  const idsA = (listA ?? []).map((r) => r.business.id).sort();
  const idsB = (listB ?? []).map((r) => r.business.id).sort();
  check("A's key lists exactly A's tenants", JSON.stringify(idsA) === JSON.stringify([tenant1.id, tenant2.id].sort()), JSON.stringify(idsA));
  check("B's key lists exactly B's brands", JSON.stringify(idsB) === JSON.stringify([brand1.id, brand2.id].sort()), JSON.stringify(idsB));
  const vA = data(await json(await call(null, "/api/v1/venues", bearer(keyA.key))));
  check("each key sees only its own venue", vA.length === 1 && vA[0].id === venues.A.id);

  const slotT = await slotNear(tenant1, tenant1.services[0].id, 180);
  const slotR = await slotNear(brand1, brand1.services[0].id, 180);
  const bt = await book(tenant1, { serviceId: tenant1.services[0].id, slot: slotT, name: "Tenant customer (test)" });
  const br = await book(brand1, { serviceId: brand1.services[0].id, slot: slotR, name: "Group customer (test)" });
  check("customers book at a tenant and at a brand", bt.status === 201 && br.status === 201, `${bt.status}/${br.status}`);
  const mallSees = await call(null, `/api/v1/bookings?businessId=${tenant1.id}&from=${slotT.date}`, bearer(keyA.key));
  check("the mall cannot read its tenant's bookings (404, as if it did not exist)", mallSees.status === 404, mallSees.status);
  const groupSees = await call(null, `/api/v1/bookings?businessId=${brand1.id}&from=${slotR.date}`, bearer(keyB.key));
  const gs = await json(groupSees);
  check("the group reads its own brand's bookings", groupSees.status === 200 && (gs.data ?? []).some((b) => b.id === br.booking.id), groupSees.status);
  check("…without the customer's name or phone", !JSON.stringify(gs).includes("Group customer") && !JSON.stringify(gs).includes(br.phone));
  const crossRead = await call(null, `/api/v1/bookings?businessId=${brand1.id}&from=${slotR.date}`, bearer(keyA.key));
  check("A's key cannot read B's brand", crossRead.status === 404, crossRead.status);
  const pa = await call(null, "/api/v1/reports/portfolio?days=30", bearer(keyA.key));
  const pb = await call(null, "/api/v1/reports/portfolio?days=30", bearer(keyB.key));
  check("each organization's report is its own", pa.status === 200 && pb.status === 200 && !JSON.stringify(await json(pa)).includes(brand1.id));
  const noKey = await call(null, "/api/v1/businesses");
  const badKey = await call(null, "/api/v1/businesses", bearer("mw_aaaaaaaaaaaa_" + "x".repeat(32)));
  check("no key or a forged key: 401", noKey.status === 401 && badKey.status === 401, `${noKey.status}/${badKey.status}`);

  // ── Webhooks: separate, signed ───────────────────────────────────────
  part("webhooks");
  await pg.query(`UPDATE "WebhookEndpoint" SET "cursorAt" = now() - interval '10 minutes' WHERE "organizationId" = ANY($1)`, [[orgA.id, orgB.id]]);
  const runCron = await call(null, "/api/cron/integrations", { headers: cronHeaders });
  check("the integrations cron runs", runCron.status === 200, runCron.status);
  await new Promise((r) => setTimeout(r, 500));
  const bodiesB = inbox.B.map((x) => JSON.parse(x.body));
  check("B receives its brand's booking, signed with B's secret", bodiesB.some((b) => b.type === "booking.created" && b.data.id === br.booking.id) && inbox.B.every((x) => verify(x.body, x.sig, hookB.secret)));
  check("A receives no booking events (its businesses are hosted)", !inbox.A.some((x) => JSON.parse(x.body).type.startsWith("booking.")));
  check("no delivery carries a customer's details", !JSON.stringify([...inbox.A, ...inbox.B]).includes(br.phone) && !JSON.stringify(inbox.B).includes("Group customer"));
  check("B's events never verify with A's secret", inbox.B.length > 0 && !inbox.B.some((x) => verify(x.body, x.sig, hookA.secret)));
  const before = inbox.B.length;
  await call(null, "/api/cron/integrations", { headers: cronHeaders });
  await new Promise((r) => setTimeout(r, 300));
  check("a second run sends nothing again", inbox.B.length === before, `${before} → ${inbox.B.length}`);

  // ── Consoles and health ──────────────────────────────────────────────
  part("consoles");
  const hA = data(await json(await call(founderA, `/api/organizations/${orgA.id}/integrations`)));
  const hB = data(await json(await call(founderB, `/api/organizations/${orgB.id}/integrations`)));
  check("each console shows its own contract, venue and webhook", hA.contract?.reference === "QA-MALL-28" && hB.contract?.reference === "QA-GROUP-28" && hA.venues?.[0]?.id === venues.A.id && hB.venues?.[0]?.id === venues.B.id);
  check("plans are visible only for owned brands sharing finance", (hB.subscriptions ?? []).map((s) => s.businessId).join() === brand1.id && (hA.subscriptions ?? []).length === 0);
  const peek = await call(founderA, `/api/organizations/${orgB.id}/integrations`);
  check("one organization cannot open the other's console data", peek.status === 404, peek.status);
  const health = await call(null, "/api/health");
  const hj = await json(health);
  check("the health endpoint answers anonymously with status only", health.status === 200 && Object.keys(hj).join() === "status", JSON.stringify(hj));
  const hd = await json(await call(null, "/api/health", { headers: cronHeaders }));
  check("…and in full with the cron secret", typeof hd.queues?.webhooksRetrying === "number" && typeof hd.jobs === "object");

  // ── Provider isolation ───────────────────────────────────────────────
  part("providers");
  const rev = await send(admin, `/api/admin/venues/${venues.A.id}/access-credential`, "POST", { action: "revoke" });
  const after = (await pg.query(`SELECT "venueId", "revokedAt" IS NOT NULL AS revoked, "keyVersion" FROM "VenueAccessCredential" WHERE "venueId" = ANY($1)`, [[venues.A.id, venues.B.id]])).rows;
  check("revoking venue A's credential leaves venue B's as it was", rev.status === 200 && after.find((r) => r.venueId === venues.A.id)?.revoked === true && after.find((r) => r.venueId === venues.B.id)?.revoked === false);
  const credPeek = await call(founderA, `/api/admin/venues/${venues.A.id}/access-credential`);
  check("an organization cannot read venue credentials (admin only)", credPeek.status === 404 || credPeek.status === 401 || credPeek.status === 403, credPeek.status);

  // ── Limits and hierarchy ─────────────────────────────────────────────
  part("limits");
  const codes = [];
  for (let i = 0; i < 13; i++) codes.push((await call(null, "/api/v1/organization", bearer(keyA.key))).status);
  check("A's key is rate-limited at its contract's 10 a minute", codes.includes(429) && codes.filter((c) => c === 200).length <= 10, codes.join(","));
  const up = await send(founderA, `/api/organizations/${orgA.id}/parent`, "PUT", { parentId: orgB.id });
  const down = await send(founderB, `/api/organizations/${orgB.id}/parent`, "PUT", { parentId: orgA.id });
  check("an organization cannot be put under another without that one's say, and a cycle is refused", !(up.status === 200 && down.status === 200), `${up.status}/${down.status}`);

  // ── Billing ──────────────────────────────────────────────────────────
  part("billing");
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  // Money is the super-admin's: a plain admin is refused.
  const superAdmin = await login("superadmin@qa.test");
  const rec = await call(superAdmin, `/api/admin/payments/reconciliation?from=${from}&to=${to}`);
  check("payment reconciliation runs for a super-admin", rec.status === 200 && Array.isArray(data(await json(rec)).discrepancies), rec.status);
  const recAdmin = await call(admin, `/api/admin/payments/reconciliation?from=${from}&to=${to}`);
  check("…not for an admin without payments.read", recAdmin.status === 404, recAdmin.status);
  const recOrg = await call(founderA, `/api/admin/payments/reconciliation?from=${from}&to=${to}`);
  check("…and is not open to an organization", recOrg.status !== 200, recOrg.status);
  const end = await call(admin, `/api/admin/organizations/${orgA.id}/contract`, { method: "DELETE" });
  const afterEnd = await call(null, "/api/v1/organization", bearer(keyA.key));
  const bStill = await call(null, "/api/v1/organization", bearer(keyB.key));
  check("ending A's contract stops A's key and leaves B's working", end.status === 200 && afterEnd.status === 403 && bStill.status === 200, `${end.status}/${afterEnd.status}/${bStill.status}`);
} catch (e) {
  failedHard = 1;
  console.error("QA aborted:", e);
} finally {
  receiver.close();
  const q = (sql, p) => pg.query(sql, p).catch((e) => console.error("cleanup:", e.message.slice(0, 120)));
  await q(`DELETE FROM "OrganizationBusiness" WHERE "organizationId" = ANY($1)`, [made.orgs]);
  await q(`DELETE FROM "VenueOrganization" WHERE id = ANY($1)`, [made.orgs]);
  await teardown();
  await pg.end();
}
process.exit(summary(true) > 0 || failedHard ? 1 : 0);
