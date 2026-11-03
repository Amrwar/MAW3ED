/**
 * Phase 24, Part 5 — load and performance against the pilot's target
 * traffic (docs/eterna/PILOT_PLAN.md, "Target traffic"), on a production
 * build against the QA database.
 *
 * What this measures is THIS machine: one `next start` process and a
 * Docker Postgres on the same PC. The numbers are a local baseline and a
 * regression yardstick, not a statement of production capacity (Vercel
 * functions scale out; Neon is a different database). Each scenario runs
 * at the target rate or concurrency for a fixed time and reports
 * throughput, p50/p95/p99 latency and errors; correctness is checked
 * where load could break it (double bookings, duplicate events).
 *
 * Customers are told apart by X-Forwarded-For, as the platform's proxy
 * does, so the per-address rate limits apply per customer as in
 * production.
 *
 *   CRON_SECRET=p19-local-cron node scripts/qa-phase24-load.mjs [baseUrl] [--db url] [--tenants 40] [--seconds 20]
 *
 * Local only; everything it creates is removed.
 */
import {
  B, pg, check, part, send, json, call, sandbox, runAccessCron, tag, made, account, business, organization,
  associate, slotNear, cairoNow, teardown, summary, login,
} from "./qa-phase24-lib.mjs";

const opt = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
/** Pilot size and time per scenario: --tenants 40 --seconds 20 (smaller for a quick check). */
const TENANTS = opt("tenants", 40);
const SECONDS = opt("seconds", 20);
const report = [];

const pct = (xs, p) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : 0);
/** Runs `fn` from `workers` loops for `seconds`, optionally paced to `perWorkerRps`. */
async function run(name, { workers, seconds = SECONDS, perWorkerRps = null }, fn) {
  const lat = [];
  const codes = {};
  const until = Date.now() + seconds * 1000;
  let i = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    while (Date.now() < until) {
      const n = i++;
      const t0 = performance.now();
      let status = 0;
      try { status = await fn(n, w); } catch { status = -1; }
      const ms = performance.now() - t0;
      lat.push(ms);
      codes[status] = (codes[status] ?? 0) + 1;
      if (perWorkerRps) await new Promise((r) => setTimeout(r, Math.max(0, 1000 / perWorkerRps - ms)));
    }
  }));
  lat.sort((a, b) => a - b);
  const r = {
    name, workers, seconds, requests: lat.length, rps: +(lat.length / seconds).toFixed(1),
    p50: Math.round(pct(lat, 50)), p95: Math.round(pct(lat, 95)), p99: Math.round(pct(lat, 99)), max: Math.round(lat.at(-1) ?? 0),
    codes, errors5xx: Object.entries(codes).filter(([c]) => Number(c) >= 500 || Number(c) < 0).reduce((s, [, n]) => s + n, 0),
  };
  report.push(r);
  console.log(`  ${name}: ${r.requests} req, ${r.rps}/s, p50 ${r.p50} ms, p95 ${r.p95} ms, p99 ${r.p99} ms, codes ${JSON.stringify(codes)}`);
  return r;
}
const ip = (n) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
const get = (path, n) => fetch(`${B}${path}`, { headers: { "x-forwarded-for": ip(n) } }).then(async (r) => { await r.arrayBuffer(); return r.status; });

try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const admin = await login("admin@qa.test");
  const prov = await json(await sandbox({ action: "ensure-provider" }));
  await sandbox({ action: "mode", mode: "NORMAL" });

  /* ── The pilot-sized world: one mall, TENANTS tenants, one group owning them ── */
  part("setup");
  const t0 = Date.now();
  const mallFounder = await account("l-mall", "Mall operator (test)");
  const mall = await organization(mallFounder, admin, { slug: "lmall", kind: "MALL", nameAr: "مول تجريبي للحمل (بيانات تجريبية)", nameEn: "Load-test mall (fictional)" });
  const mallSlug = `${tag}-lmall`;
  const groupFounder = await account("l-grp", "Group (test)");
  const group = await organization(groupFounder, admin, { slug: "lgrp", kind: "BUSINESS_GROUP", nameAr: "مجموعة تجريبية للحمل", nameEn: "Load-test group (fictional)" });
  const cityId = (await pg.query(`SELECT id FROM "City" WHERE slug = 'new-cairo'`)).rows[0].id;
  const venue = (await json(await send(admin, "/api/admin/venues", "POST", { slug: `${tag}-lv`, nameAr: "مول الحمل", organizationId: mall.id, cityId }))).venue;
  made.venues.push(venue.id);
  await send(admin, `/api/admin/venues/${venue.id}`, "PATCH", { status: "ACTIVE", isPublished: true });
  const gate = (await json(await send(mallFounder, `/api/venues/${venue.id}/gates`, "POST", { nameAr: "بوابة", kind: "PEDESTRIAN", code: `${tag}-G` }))).gate;
  await send(mallFounder, `/api/venues/${venue.id}/policy`, "PUT", { visitorEligibility: "BOOKING_REQUIRED", accessBeforeMinutes: 240, accessAfterMinutes: 60, maxGuestsPerBooking: 0, reentryAllowed: true, allowedGateIds: [gate.id], accessInstructionsAr: null, accessInstructionsEn: null });
  const site = `SITE-${tag}`;
  made.sites.push(site);
  await send(admin, `/api/venues/${venue.id}/access`, "PUT", { providerSlug: prov.provider.slug, siteRef: site });
  await send(mallFounder, `/api/venues/${venue.id}/access`, "PUT", { accessEnabled: true });
  const cats = ["restaurants", "salons", "clinics", "spas", "gyms", "beauty-centers", "dentists", "photography"];
  const tenants = [];
  for (let k = 0; k < TENANTS; k++) {
    const biz = await business(`l${k}`, { nameAr: `نشاط تجريبي ${k + 1}`, nameEn: `Test tenant ${k + 1}`, category: cats[k % cats.length], services: [{ nameAr: "خدمة", nameEn: "Service", duration: 30, price: 100 + k }], plan: "PREMIUM" });
    await associate(mallFounder, mall.id, biz, "HOSTED", { section: ["المطاعم", "التجميل", "العيادات", "الرياضة"][k % 4] });
    await associate(groupFounder, group.id, biz, "MANAGED", { ask: ["RESERVATIONS", "REPORTS"] });
    const m = (await json(await send(biz.owner, "/api/business/venues/memberships", "POST", { venueId: venue.id }))).membership;
    await send(mallFounder, `/api/venues/${venue.id}/memberships/${m.id}`, "PATCH", { decision: "approve" });
    tenants.push(biz);
  }
  check(`setup: a mall with ${TENANTS} tenants built through the APIs in ${Math.round((Date.now() - t0) / 1000)} s`, tenants.length === TENANTS);

  // History for the analytics: 20,000 past bookings across the tenants
  // (ended statuses, so they hold no time), seeded in SQL.
  const ids = tenants.map((b) => b.id);
  await pg.query(
    `INSERT INTO "Booking" (id, "businessId", "serviceId", "customerName", "customerPhone", date, "startTime", "endTime", "startsAt", "endsAt", status, "totalPrice", "accessToken", "updatedAt")
     SELECT 'l24-' || g || '-' || $3, b.id, s.id, 'عميل تاريخي', '0100' || lpad((g % 10000000)::text, 7, '0'),
            date_trunc('day', now() - make_interval(days => g % 30)), lpad((8 + g % 12)::text, 2, '0') || ':00', lpad((8 + g % 12)::text, 2, '0') || ':30',
            date_trunc('day', now() - make_interval(days => g % 30)) + make_interval(hours => 8 + g % 12),
            date_trunc('day', now() - make_interval(days => g % 30)) + make_interval(hours => 8 + g % 12, mins => 30),
            (ARRAY['COMPLETED','COMPLETED','COMPLETED','NO_SHOW','CANCELLED'])[1 + g % 5]::"BookingStatus", 100 + g % 400, md5(random()::text || g), now()
     FROM generate_series(1, 20000) g
     JOIN LATERAL (SELECT id FROM "Business" WHERE id = ($1::text[])[1 + g % $2]) b ON true
     JOIN LATERAL (SELECT id FROM "Service" WHERE "businessId" = b.id LIMIT 1) s ON true`,
    [ids, ids.length, tag],
  );
  check("setup: 20,000 past bookings seeded for the analytics", (await pg.query(`SELECT count(*)::int AS n FROM "Booking" WHERE "businessId" = ANY($1)`, [ids])).rows[0].n >= 20000);

  /* ── 1. Organization directories ── */
  part("5.1 Organization directory");
  const dirHtml = await run("directory page (SSR)", { workers: 20 }, (n) => get(`/groups/${mallSlug}`, n));
  const dirApi = await run("directory public API", { workers: 20 }, (n) => get(`/api/public/groups/${mallSlug}`, n));
  check("5.1: directory page at 20 concurrent visitors — p95 under 1,000 ms, no server error", dirHtml.p95 < 1000 && dirHtml.errors5xx === 0, `p95 ${dirHtml.p95}`);
  check("5.1: directory API — p95 under 500 ms, no server error", dirApi.p95 < 500 && dirApi.errors5xx === 0, `p95 ${dirApi.p95}`);

  /* ── 2. Business filtering ── */
  part("5.2 Filtering");
  const terms = ["تجريبي", "Test tenant 1", "zzz", "نشاط", "tenant 3"];
  const filt = await run("directory search and sections", { workers: 10 }, (n) => get(`/groups/${mallSlug}?q=${encodeURIComponent(terms[n % terms.length])}${n % 3 === 0 ? "&page=2" : ""}`, n));
  check("5.2: filtering at 10 concurrent — p95 under 1,000 ms, no server error", filt.p95 < 1000 && filt.errors5xx === 0, `p95 ${filt.p95}`);

  /* ── 3. Booking availability ── */
  part("5.3 Availability");
  const { date } = cairoNow(24 * 60);
  const avail = await run("time slots across tenants", { workers: 20 }, (n) => {
    const b = tenants[n % tenants.length];
    return get(`/api/public/${b.slug}/slots?serviceId=${b.services[0].id}&date=${date}`, n);
  });
  check("5.3: availability at 20 concurrent — p95 under 800 ms, no server error", avail.p95 < 800 && avail.errors5xx === 0, `p95 ${avail.p95}`);

  /* ── 4. Concurrent reservations ── */
  part("5.4 Concurrent reservations");
  let doubles = 0;
  let wrong5xx = 0;
  const burstLat = [];
  for (let burst = 0; burst < 10; burst++) {
    const b = tenants[burst];
    const slot = await slotNear(b, b.services[0].id, 24 * 60 + burst * 60);
    const shots = await Promise.all(Array.from({ length: 30 }, async (_, k) => {
      const t1 = performance.now();
      const r = await fetch(`${B}/api/public/${b.slug}/bookings`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: B, "x-forwarded-for": ip(100000 + burst * 100 + k) },
        body: JSON.stringify({ serviceId: b.services[0].id, date: slot.date, startTime: slot.startTime, customerName: `زحمة ${k}`, customerPhone: `0111${String(burst).padStart(2, "0")}${String(k).padStart(5, "0")}` }),
      });
      burstLat.push(performance.now() - t1);
      return r.status;
    }));
    const live = (await pg.query(`SELECT count(*)::int AS n FROM "Booking" WHERE "businessId" = $1 AND date = $2::date AND "startTime" = $3 AND status::text NOT IN ('CANCELLED','FAILED_PAYMENT')`, [b.id, slot.date, slot.startTime])).rows[0].n;
    if (live !== 1) doubles += 1;
    wrong5xx += shots.filter((s) => s >= 500 && s !== 503).length;
  }
  burstLat.sort((a, b) => a - b);
  report.push({ name: "30 simultaneous bookings for one time, ×10", requests: burstLat.length, p50: Math.round(pct(burstLat, 50)), p95: Math.round(pct(burstLat, 95)), p99: Math.round(pct(burstLat, 99)), doubles, errors5xx: wrong5xx });
  console.log(`  bursts: p95 ${Math.round(pct(burstLat, 95))} ms, double bookings ${doubles}, unexpected 5xx ${wrong5xx}`);
  check("5.4: 10 bursts of 30 customers racing for one time — exactly one booking each time, no unexpected server error", doubles === 0 && wrong5xx === 0, `doubles ${doubles}, 5xx ${wrong5xx}`);
  check("5.4: …every customer answered within 5 s (p99)", pct(burstLat, 99) < 5000, `p99 ${Math.round(pct(burstLat, 99))}`);

  /* ── 5. Booking QR verification ── */
  part("5.5 QR verification");
  const desks = tenants.slice(0, 20);
  const codes = [];
  for (const b of desks) {
    const slot = await slotNear(b, b.services[0].id, 5);
    const r = await json(await send(null, `/api/public/${b.slug}/bookings`, "POST", { serviceId: b.services[0].id, date: slot.date, startTime: slot.startTime, customerName: "مسح", customerPhone: `0122${String(codes.length).padStart(7, "0")}` }));
    const acc = await json(await call(null, `/api/booking/${r.booking?.accessToken}/access`));
    if (!acc.checkIn?.url) console.log("  setup: no code", JSON.stringify(r).slice(0, 160), JSON.stringify(acc).slice(0, 160));
    codes.push(acc.checkIn?.url ?? "");
  }
  await pg.query(`DELETE FROM "RateLimit"`);
  const scans = await run("desk scans (20 desks, one scan a second each)", { workers: 20, perWorkerRps: 1 }, (n, w) =>
    send(desks[w].owner, "/api/business/check-in", "POST", { code: codes[w] }).then((r) => r.status));
  check("5.5: 20 desks scanning once a second — every scan answered (200), p95 under 300 ms", scans.p95 < 300 && scans.codes[200] === scans.requests, `p95 ${scans.p95} ${JSON.stringify(scans.codes)}`);

  /* ── 6. Event processing ── */
  part("5.6 Event processing");
  const passBookings = [];
  for (let k = 0; k < 60; k++) {
    const b = tenants[k % tenants.length];
    const slot = await slotNear(b, b.services[0].id, 30 + (k % 6) * 30);
    const r = await json(await send(null, `/api/public/${b.slug}/bookings`, "POST", { serviceId: b.services[0].id, date: slot.date, startTime: slot.startTime, customerName: "زائر", customerPhone: `0123${String(k).padStart(7, "0")}` }));
    if (r.booking?.accessToken) {
      const pr = await send(null, `/api/booking/${r.booking.accessToken}/access/pass`, "POST", { displayName: "زائر" });
      if (pr.status !== 200) console.log("  setup: pass", pr.status, JSON.stringify(await json(pr)).slice(0, 160));
      passBookings.push(r.booking.accessToken);
    }
  }
  const c0 = performance.now();
  let rounds = 0;
  let active = 0;
  while (rounds < 10) {
    rounds += 1;
    await runAccessCron();
    const st = await Promise.all(passBookings.map((tk) => call(null, `/api/booking/${tk}/access`).then(json)));
    active = st.filter((s) => s.visitorAccess?.holder?.state === "active").length;
    if (active === passBookings.length) break;
  }
  const issueMs = Math.round(performance.now() - c0);
  report.push({ name: `issue ${passBookings.length} passes through the provider queue`, ms: issueMs, cronRuns: rounds, active });
  check(`5.6: ${passBookings.length} pass requests issued by the provider queue — all active within 3 cron runs`, active === passBookings.length && rounds <= 3, `${active}/${passBookings.length} after ${rounds} runs, ${issueMs} ms`);
  const tokens = (await Promise.all(passBookings.map((tk) => call(null, `/api/booking/${tk}/access`).then(json)))).map((s) => s.visitorAccess?.holder?.pass?.token).filter(Boolean);
  const events = [];
  for (const tk of tokens) {
    const g = await json(await sandbox({ action: "gate", token: tk, gate: `${tag}-G`, site, deliver: false }));
    if (g.event) events.push(g.event);
  }
  let e = 0;
  const evRun = await run("signed provider callbacks (each delivered 3×)", { workers: 20, seconds: 10 }, async () => {
    const ev = events[Math.floor(e++ / 3) % events.length];
    const r = await fetch(`${B}/api/access/providers/sandbox/events`, { method: "POST", body: ev.raw, headers: ev.headers });
    await r.arrayBuffer();
    return r.status;
  });
  const entries = (await pg.query(
    `SELECT count(*)::int AS n FROM "AccessEvent" e WHERE e.kind::text = 'ENTRY_GRANTED' AND e."venueId" = $1`, [venue.id])).rows[0].n;
  check("5.6: callbacks at 20 concurrent — p95 under 300 ms, no server error, each entry recorded once however often it is delivered", evRun.p95 < 300 && evRun.errors5xx === 0 && entries === events.length, `p95 ${evRun.p95}, entries ${entries}/${events.length}`);

  /* ── 7. Dashboard analytics ── */
  part("5.7 Dashboard analytics");
  const pf = await run(`group portfolio over ${TENANTS} businesses / 20k bookings`, { workers: 5 }, () => call(groupFounder, `/api/organizations/${group.id}/portfolio?days=30`).then(async (r) => { await r.arrayBuffer(); return r.status; }));
  const om = await run("mall page metrics", { workers: 5 }, () => call(mallFounder, `/api/organizations/${mall.id}/metrics`).then(async (r) => { await r.arrayBuffer(); return r.status; }));
  const vm = await run("venue metrics", { workers: 5 }, () => call(mallFounder, `/api/venues/${venue.id}/metrics`).then(async (r) => { await r.arrayBuffer(); return r.status; }));
  const pfBody = await json(await call(groupFounder, `/api/organizations/${group.id}/portfolio?days=30`));
  check("5.7: the group's portfolio at 5 concurrent — p95 under 1,000 ms, and it counts every seeded booking", pf.p95 < 1000 && pf.errors5xx === 0 && pfBody.totals?.bookings + pfBody.totals?.cancelled >= 20000, `p95 ${pf.p95}, counted ${pfBody.totals?.bookings}+${pfBody.totals?.cancelled}`);
  check("5.7: mall and venue metrics — p95 under 1,000 ms, no server error", om.p95 < 1000 && vm.p95 < 1000 && om.errors5xx + vm.errors5xx === 0, `p95 ${om.p95}/${vm.p95}`);

  console.log("\nREPORT " + JSON.stringify(report));
} catch (err) {
  check("script ran to completion", false, err instanceof Error ? err.stack : String(err));
} finally {
  await sandbox({ action: "mode", mode: "NORMAL" }).catch(() => {});
  await teardown();
  await pg.end();
  process.exit(summary(true) ? 1 : 0);
}
