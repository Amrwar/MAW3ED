/**
 * Phase 23 post-audit: loop and lifecycle checks in a real browser
 * (Chromium), on a production build against the QA database with
 * ACCESS_SANDBOX=1. Playwright's clock fast-forwards timers; a fake
 * camera and a fake BarcodeDetector stand in for hardware.
 *
 *  P1  a pass the provider never confirms is re-checked at most
 *      POLL_MAX times, then never again, even after an hour;
 *  P2  "check again" starts one more bounded round, not an endless one;
 *  C1  a double click on "scan" leaves one camera stream, and closing
 *      the camera leaves none;
 *  C2  leaving the page while the browser is still opening the camera
 *      leaves no live camera behind;
 *  C3  closing and reopening the camera quickly runs one scan loop;
 *  C4  a code read by the camera is verified once, and the camera stops;
 *  C5  "check in" acts on the booking on screen, not on a code typed
 *      into the field afterwards;
 *  I   idle Phase 23 pages issue no repeated requests;
 *  L1  staff who scan a booking QR and sign in come back to that code;
 *  L2  venue security signing in comes back to their desk;
 *  S1  the security desk says so when a refresh fails, and when an
 *      action cannot reach the server;
 *  H   repeated visits to the booking page do not grow the heap.
 *
 *   CRON_SECRET=p19-local-cron node scripts/qa-phase23-loops.mjs [baseUrl]
 *
 * Local only. Run against `next start`: in development, StrictMode
 * mounts twice on purpose and the counts would double.
 */
import { createRequire } from "module";
import { randomBytes } from "crypto";
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const { chromium } = require("playwright");

const B = process.argv.slice(2).find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
const DB = "postgresql://qa:qa@localhost:5450/maw3ed_qa";
const CRON = process.env.CRON_SECRET ?? "p19-local-cron";
if (!/^http:\/\/localhost[:/]/.test(B)) {
  console.error("Local only.");
  process.exit(1);
}
const POLL_MAX = 10; // src/app/booking/[token]/_components/AccessPanel.tsx
const POLL_MS = 4000;
const SCAN_INTERVAL_MS = 300; // src/components/access/CheckInDesk.tsx

const pg = new Client({ connectionString: DB });
await pg.connect();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const tag = `qa23l-${Date.now()}`;
const cleanup = { bookings: [], venues: [], users: [] };
const cron = { Authorization: `Bearer ${CRON}`, "Content-Type": "application/json" };
const sandbox = (body) => fetch(`${B}/api/dev/access-sandbox`, { method: "POST", headers: cron, body: JSON.stringify(body) });

function cairoWall() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
}
/** A short booking (five minutes), so several fit in one check-in window without overlapping. */
async function booking(offsetMin, name = "سلمى حلقة") {
  const { rows: [b] } = await pg.query(`SELECT b.id, s.id AS "serviceId" FROM "Business" b JOIN "Service" s ON s."businessId" = b.id WHERE b.slug = 'qa-salon' LIMIT 1`);
  const start = new Date(Math.floor((cairoWall().getTime() + offsetMin * 60_000) / 60_000) * 60_000);
  const end = new Date(start.getTime() + 5 * 60_000);
  const lit = (d) => d.toISOString().slice(0, 19).replace("T", " ");
  const token = randomBytes(24).toString("base64url");
  const id = `${tag}-${Math.random().toString(36).slice(2, 10)}`;
  await pg.query(
    `INSERT INTO "Booking" (id, "businessId", "serviceId", "customerName", "customerPhone", date, "startTime", "endTime", "startsAt", "endsAt", status, "totalPrice", "accessToken", "updatedAt")
     VALUES ($1,$2,$3,$4,'01012345678',$5,$6,$7,$8,$9,'CONFIRMED',100,$10,NOW())`,
    [id, b.id, b.serviceId, name, `${start.toISOString().slice(0, 10)} 00:00:00`, start.toISOString().slice(11, 16), end.toISOString().slice(11, 16), lit(start), lit(end), token],
  );
  cleanup.bookings.push(id);
  const codeUrl = (await (await fetch(`${B}/api/booking/${token}/access`)).json()).checkIn.url;
  return { id, token, codeUrl };
}
const firstLine = (e) => (e instanceof Error ? e.message.split(/\r?\n/)[0] : String(e));
const status = async (id) => (await pg.query(`SELECT status FROM "Booking" WHERE id = $1`, [id])).rows[0].status;

const browser = await chromium.launch();
async function login(page, email) {
  await page.fill("#login-email", email);
  await page.fill("#login-password", "QaPassword123!");
  await page.click('button[type="submit"]');
}
async function signedIn(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${B}/login`, { waitUntil: "networkidle" });
  await login(p, email);
  await p.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 60000 });
  await p.close();
  return ctx;
}

/** A camera that is a canvas, and a QR reader that reads what window.__qr says. */
const FAKE_CAMERA = () => {
  window.__streams = [];
  window.__detects = 0;
  window.__gumDelay = 200;
  navigator.mediaDevices.getUserMedia = async () => {
    await new Promise((r) => setTimeout(r, window.__gumDelay));
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    c.getContext("2d").fillRect(0, 0, 32, 32);
    const s = c.captureStream(5);
    window.__streams.push(s);
    return s;
  };
  window.BarcodeDetector = class {
    async detect() {
      window.__detects++;
      const v = window.__qr;
      if (v) {
        window.__qr = null;
        return [{ rawValue: v }];
      }
      return [];
    }
  };
  window.__live = () => window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length;
};

try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const prov = await (await sandbox({ action: "ensure-provider" })).json();
  await sandbox({ action: "mode", mode: "NORMAL" });
  const { rows: [{ id: cityId }] } = await pg.query(`SELECT id FROM "City" LIMIT 1`);
  const { rows: [salon] } = await pg.query(`SELECT id, "ownerId" FROM "Business" WHERE slug = 'qa-salon'`);
  const venueId = `${tag}-venue`;
  await pg.query(`INSERT INTO "Venue" (id, slug, "nameAr", "cityId", status, "isPublished", "accessEnabled", "accessProviderId", "accessSiteRef", "updatedAt") VALUES ($1,$1,'مول الحلقات',$2,'ACTIVE',true,true,$3,'SITE-QA23L',NOW())`, [venueId, cityId, prov.provider.id]);
  cleanup.venues.push(venueId);
  await pg.query(`INSERT INTO "VenuePolicy" (id, "venueId", "visitorEligibility", "accessBeforeMinutes", "maxGuestsPerBooking", "updatedAt") VALUES ($1,$2,'BOOKING_REQUIRED',240,2,NOW())`, [`${tag}-pol`, venueId]);
  await pg.query(`INSERT INTO "VenueMembership" (id, "venueId", "businessId", status, "requestedById", "updatedAt") VALUES ($1,$2,$3,'APPROVED',$4,NOW())`, [`${tag}-mem`, venueId, salon.id, salon.ownerId]);
  const secEmail = `${tag}-sec@qa.test`;
  const { rows: [sec] } = await pg.query(`INSERT INTO "User" (id, email, name, password, "emailVerified", "updatedAt") SELECT $1,$2,'أمن الحلقات',password,NOW(),NOW() FROM "User" WHERE email='owner@qa.test' RETURNING id`, [`${tag}-sec`, secEmail]);
  cleanup.users.push(sec.id);
  await pg.query(`INSERT INTO "VenueRole" (id, "userId", kind, "venueId") VALUES ($1,$2,'VENUE_SECURITY',$3)`, [`${tag}-role`, sec.id, venueId]);

  // ── P1/P2: a pass the provider never confirms ────────────────────────
  {
    await sandbox({ action: "mode", mode: "NO_CONFIRM" });
    const b = await booking(90);
    const asked = await fetch(`${B}/api/booking/${b.token}/access/pass`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: "سلمى حلقة" }) });
    // Let the provider accept it (it stays pending: NO_CONFIRM).
    await fetch(`${B}/api/cron/access`, { headers: cron });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.clock.install();
    let gets = 0;
    page.on("request", (r) => { if (r.url().endsWith(`/api/booking/${b.token}/access`) && r.method() === "GET") gets++; });
    await page.goto(`${B}/booking/${b.token}`, { waitUntil: "networkidle" });
    const pendingShown = await page.getByText(/مستني|بيستنى|قيد/).count() > 0;
    for (let i = 0; i < POLL_MAX + 5; i++) {
      await page.clock.runFor(POLL_MS + 100);
      await page.waitForTimeout(250);
    }
    const atCap = gets;
    await page.clock.runFor(60 * 60_000);
    await page.waitForTimeout(500);
    check(`P1: a never-confirmed pass is re-checked at most ${POLL_MAX} times, then not at all for an hour`, asked.ok && atCap <= 1 + POLL_MAX && gets === atCap,
      `pass asked ${asked.status}, pending shown ${pendingShown}; ${atCap} GETs (1 load + ≤${POLL_MAX}), ${gets} after one more simulated hour`);
    const again = page.getByRole("button", { name: "شوف الحالة تاني" });
    if (await again.count()) {
      await again.click();
      for (let i = 0; i < POLL_MAX + 5; i++) {
        await page.clock.runFor(POLL_MS + 100);
        await page.waitForTimeout(250);
      }
      await page.clock.runFor(60 * 60_000);
      await page.waitForTimeout(500);
      check("P2: 'check again' starts one more bounded round", gets - atCap <= 1 + POLL_MAX, `${gets - atCap} more GETs`);
    } else {
      check("P2: 'check again' starts one more bounded round", false, "no check-again button found");
    }
    await ctx.close();
    await sandbox({ action: "mode", mode: "NORMAL" });
  }

  // ── The check-in desk's camera ───────────────────────────────────────
  const owner = await signedIn("owner@qa.test");
  await owner.addInitScript(FAKE_CAMERA);
  // Each check has a fresh desk, and a failure in one does not hide the others.
  async function desk(name, fn) {
    const page = await owner.newPage();
    try {
      await page.goto(`${B}/dashboard/check-in`, { waitUntil: "networkidle" });
      await fn(page, page.getByRole("button", { name: "امسح بالكاميرا" }));
    } catch (e) {
      check(name, false, firstLine(e));
    } finally {
      await page.close();
    }
  }
  const closeIfOpen = async (page) => {
    const close = page.getByRole("button", { name: "اقفل الكاميرا" });
    if (await close.count()) await close.click();
    await page.waitForTimeout(300);
  };

  const C1 = "C1: a double click leaves one live camera, and closing it leaves none";
  await desk(C1, async (page, scan) => {
    await scan.evaluate((el) => { el.click(); el.click(); }); // two clicks in the same instant
    await page.waitForTimeout(1500);
    const opened = await page.evaluate(() => window.__streams.length);
    const liveBoth = await page.evaluate(() => window.__live());
    await closeIfOpen(page);
    const liveAfter = await page.evaluate(() => window.__live());
    check(C1, liveBoth === 1 && liveAfter === 0, `${opened} opened, ${liveBoth} live, ${liveAfter} after close`);
  });

  const C3 = "C3: a quick close/reopen runs a single scan loop";
  await desk(C3, async (page, scan) => {
    await scan.click();
    await page.getByRole("button", { name: "اقفل الكاميرا" }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "اقفل الكاميرا" }).click();
    await scan.click();
    await page.getByRole("button", { name: "اقفل الكاميرا" }).waitFor({ timeout: 10000 });
    const d0 = await page.evaluate(() => window.__detects);
    await page.waitForTimeout(3000);
    const reads = (await page.evaluate(() => window.__detects)) - d0;
    const oneLoop = Math.ceil(3000 / SCAN_INTERVAL_MS) + 2;
    check(C3, reads <= oneLoop, `${reads} reads in 3 s (one loop ≤ ${oneLoop})`);
    await closeIfOpen(page);
  });

  const C4 = "C4: a code read by the camera is verified once and the camera stops";
  await desk(C4, async (page, scan) => {
    const b = await booking(-28, "قارئ الكاميرا");
    let verifies = 0;
    page.on("request", (r) => { if (r.url().endsWith("/api/business/check-in") && r.method() === "POST") verifies++; });
    await scan.click();
    await page.getByRole("button", { name: "اقفل الكاميرا" }).waitFor({ timeout: 10000 });
    await page.evaluate((u) => { window.__qr = u; }, b.codeUrl);
    await page.getByText("الكود سليم").waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const live = await page.evaluate(() => window.__live());
    check(C4, verifies === 1 && live === 0, `${verifies} verify request(s), ${live} live track(s)`);
  });

  const C5 = "C5: 'check in' acts on the booking on screen, not a code typed afterwards";
  await desk(C5, async (page) => {
    const a = await booking(-21, "حجز ظاهر");
    const other = await booking(-14, "حجز مكتوب");
    await page.fill("#checkin-code", a.codeUrl);
    await page.getByRole("button", { name: "اتحقق" }).click();
    await page.getByText("حجز ظاهر").waitFor({ timeout: 10000 });
    await page.fill("#checkin-code", other.codeUrl);
    await page.getByRole("button", { name: "سجّل الوصول" }).click();
    await page.getByText("اتسجّل وصوله قبل كده").waitFor({ timeout: 10000 });
    check(C5, (await status(a.id)) === "ARRIVED" && (await status(other.id)) === "CONFIRMED", `shown ${await status(a.id)}, typed ${await status(other.id)}`);
  });

  const C2 = "C2: leaving while the camera opens leaves no live camera";
  await desk(C2, async (page, scan) => {
    await page.evaluate(() => { window.__gumDelay = 2000; });
    await scan.click();
    await page.evaluate(() => { const a = document.querySelector('a[href="/dashboard"]'); if (a) a.click(); });
    await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 15000 });
    await page.waitForTimeout(3000);
    const live = await page.evaluate(() => window.__live?.() ?? -1);
    check(C2, live === 0, `${live} live track(s)`);
  });

  // ── Idle Phase 23 pages ──────────────────────────────────────────────
  {
    const b = await booking(100, "صفحة هادية");
    const security = await signedIn(secEmail);
    for (const [ctx, path] of [[owner, "/dashboard/check-in"], [owner, `/c/${b.codeUrl.split("/c/")[1]}`], [security, `/venue-admin/${venueId}/access`], [null, `/booking/${b.token}`]]) {
      const c = ctx ?? await browser.newContext();
      const page = await c.newPage();
      await page.clock.install();
      await page.goto(`${B}${path}`, { waitUntil: "networkidle" });
      let after = 0;
      const seen = new Map();
      page.on("request", (r) => {
        if (!["fetch", "xhr", "document"].includes(r.resourceType())) return;
        if (r.url().includes("/api/realtime/bookings")) return; // the dashboard's one long-lived stream
        after++;
        seen.set(r.url(), (seen.get(r.url()) ?? 0) + 1);
      });
      for (let i = 0; i < 10; i++) {
        await page.clock.runFor(60_000);
        await page.waitForTimeout(100);
      }
      check(`I: ${path.replace(/\/c\/.+/, "/c/<code>").replace(/booking\/.+/, "booking/<token>")} issues no repeated requests while idle (10 simulated min)`, after === 0, after ? JSON.stringify([...seen]) : "0 requests");
      await page.close();
      if (!ctx) await c.close();
    }

    // S1: the security desk reports a failed refresh and an unreachable server.
    const sp = await security.newPage();
    try {
    await sp.goto(`${B}/venue-admin/${venueId}/access`, { waitUntil: "networkidle" });
    await sp.route(`**/api/venues/${venueId}/access**`, (route) => route.abort());
    await sp.getByRole("button", { name: "حدّث" }).click();
    const refreshShown = await sp.getByText("مقدرناش نحدّث").waitFor({ timeout: 10000 }).then(() => true, () => false);
    await sp.getByPlaceholder("اللي حصل").fill("فحص انقطاع");
    await sp.getByRole("button", { name: "سجّل", exact: true }).click();
    const offlineShown = await sp.getByText("تعذّر الاتصال، ومحصلش أي تغيير").waitFor({ timeout: 10000 }).then(() => true, () => false);
    check("S1: the desk says when a refresh fails and when an action cannot reach the server", refreshShown && offlineShown, `refresh ${refreshShown}, action ${offlineShown}`);
    } catch (e) {
      check("S1: the desk says when a refresh fails and when an action cannot reach the server", false, firstLine(e));
    }
    await sp.close();
    await security.close();
  }

  // ── L1/L2: signing in returns to where the person was going ──────────
  {
    const b = await booking(-7, "رجوع بعد الدخول");
    const code = b.codeUrl.split("/c/")[1];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${B}/c/${code}`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /سجّل دخولك/ }).click();
    await page.waitForURL(/\/login/);
    await login(page, "owner@qa.test");
    await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 60000 });
    const back = new URL(page.url()).pathname;
    const desk = await page.getByText("رجوع بعد الدخول").waitFor({ timeout: 15000 }).then(() => true, () => false);
    check("L1: staff who scan a booking QR and sign in come back to that code's desk", back === `/c/${code}` && desk, `landed on ${back}`);
    await ctx.close();

    const sctx = await browser.newContext();
    const sp = await sctx.newPage();
    await sp.goto(`${B}/venue-admin/${venueId}/access`, { waitUntil: "networkidle" });
    await login(sp, secEmail);
    await sp.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 60000 });
    const sback = new URL(sp.url()).pathname;
    check("L2: venue security signing in comes back to their desk", sback === `/venue-admin/${venueId}/access`, `landed on ${sback}`);
    await sctx.close();
  }

  // ── H: heap across repeated visits to the booking page ───────────────
  {
    const b = await booking(110, "ذاكرة");
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const heap = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      return (await page.evaluate(() => performance.memory.usedJSHeapSize)) / 1048576;
    };
    await page.goto(`${B}/booking/${b.token}`, { waitUntil: "networkidle" });
    const first = await heap();
    for (let i = 0; i < 15; i++) await page.reload({ waitUntil: "networkidle" });
    const last = await heap();
    check("H: 15 reloads of the booking page do not grow the heap by more than 25%", last <= first * 1.25, `${first.toFixed(1)} MB → ${last.toFixed(1)} MB`);
    await ctx.close();
  }
  await owner.close();
} catch (e) {
  check("script ran to completion", false, e instanceof Error ? e.stack : String(e));
} finally {
  await sandbox({ action: "mode", mode: "NORMAL" }).catch(() => {});
  await browser.close();
  await pg.query(`DELETE FROM "AuditLog" WHERE "resourceId" = ANY($1) OR "resourceId" = ANY($2)`, [cleanup.bookings, cleanup.venues]).catch(() => {});
  await pg.query(`DELETE FROM "Venue" WHERE id = ANY($1)`, [cleanup.venues]).catch((e) => console.error(e.message));
  const { rows: vis } = await pg.query(`SELECT "visitorId" FROM "BookingGuest" WHERE "bookingId" = ANY($1)`, [cleanup.bookings]).catch(() => ({ rows: [] }));
  await pg.query(`DELETE FROM "Booking" WHERE id = ANY($1)`, [cleanup.bookings]).catch((e) => console.error(e.message));
  await pg.query(`DELETE FROM "Visitor" WHERE id = ANY($1)`, [vis.map((v) => v.visitorId)]).catch(() => {});
  await pg.query(`DELETE FROM "SandboxAccessPass" WHERE "siteRef" = 'SITE-QA23L'`).catch(() => {});
  await pg.query(`DELETE FROM "User" WHERE id = ANY($1)`, [cleanup.users]).catch((e) => console.error(e.message));
  await pg.query(`DELETE FROM "RateLimit"`).catch(() => {});
  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
