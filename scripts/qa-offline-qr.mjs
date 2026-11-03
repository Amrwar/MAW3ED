/**
 * The booking page's QR without a connection, in real browsers, on a
 * production build against the QA database (the service worker registers
 * in production builds only):
 *
 *   - the phone keeps the customer's own booking page; offline, a reload
 *     shows that copy: the QR, the booking, and a note saying it is a copy;
 *   - back online the note goes after one refresh; offline the page does
 *     not keep asking;
 *   - "Save QR as image" saves a real PNG, online and offline, in Chromium,
 *     WebKit (Safari's engine) and Firefox;
 *   - nothing else is kept: a cancelled booking's copy is deleted, an
 *     expired copy is not served, an owner's dashboard is never kept.
 *
 *   CRON_SECRET=p19-local-cron node scripts/qa-offline-qr.mjs [baseUrl] [--db url]
 *
 * Local only; everything it creates is removed.
 */
import { createRequire } from "module";
import {
  B, pg, check, part, send, json, business, slotNear, book, teardown, summary,
} from "./qa-phase24-lib.mjs";
const require = createRequire(import.meta.url);
const pw = require("playwright");

const cookiesOf = (jar) => [...jar.cookies].map(([name, value]) => ({ name, value, url: B }));
const qrCount = (page) => page.locator('section[aria-labelledby="checkin-h"] [role="img"] svg').count();
const keptKeys = (page) => page.evaluate(async () => (await (await caches.open("maw3ed-bookings-v1")).keys()).map((r) => new URL(r.url).pathname));

/** Opens the booking page until the service worker controls it and has kept a copy. */
async function openControlled(page, url, path) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  for (let i = 0; i < 10; i++) {
    await page.reload({ waitUntil: "networkidle" });
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    if (controlled && (await keptKeys(page)).includes(path)) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

try {
  await pg.query(`DELETE FROM "RateLimit"`);
  const biz = await business("oq", { nameAr: "صالون الاختبار (تجريبي)", nameEn: "Test Salon (test)", category: "salons", services: [{ nameAr: "قص", nameEn: "Cut", duration: 30, price: 100 }] });
  const b1 = (await book(biz, { slot: await slotNear(biz, biz.services[0].id, 10), name: "عميل أوفلاين" })).booking;
  const path = `/booking/${b1.accessToken}`;

  /* ── Chromium: the whole story ── */
  part("Chromium (Android-like phone)");
  {
    const browser = await pw.chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await ctx.addCookies([{ name: "maw3ed-lang", value: "ar", url: B }]);
    const page = await ctx.newPage();
    const html = await (await fetch(`${B}${path}`)).text();
    check("the page itself carries the QR (rendered on the server) and how long it may be kept", /aria-labelledby="checkin-h"[\s\S]*<svg/.test(html) && /name="maw3ed-offline-until"/.test(html));
    check("the phone keeps this booking page once it is opened online", await openControlled(page, `${B}${path}`, path));

    let accessCalls = 0;
    page.on("request", (r) => { if (r.url().includes("/access")) accessCalls += 1; });
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    check("offline, a reload shows the kept page with its QR", (await qrCount(page)) === 1 && (await page.textContent("main"))?.includes("عميل أوفلاين"));
    const note = await page.getByRole("status").filter({ hasText: "مفيش اتصال" }).count();
    check("…and says it is a saved copy, with when it was saved", note === 1);
    const before = accessCalls;
    await page.waitForTimeout(15000);
    check("offline, the page does not keep asking (no new request in 15 s)", accessCalls - before === 0, `${accessCalls - before} requests`);

    // Save QR, offline: drawn in the browser.
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.getByRole("button", { name: "احفظ الكود كصورة" }).click()]);
    const file = await dl.path();
    const bytes = (await import("fs")).readFileSync(file);
    check("Save QR works offline: a real PNG, named after the booking", bytes.subarray(1, 4).toString() === "PNG" && bytes.length > 2000 && /^maw3ed-check-in-[A-Za-z0-9-]+\.png$/.test(dl.suggestedFilename()), `${dl.suggestedFilename()} ${bytes.length} bytes`);

    // The browser fires "online" itself when the connection returns.
    await ctx.setOffline(false);
    await page.waitForTimeout(2500);
    check("back online, one refresh and the note goes", (await page.getByRole("status").filter({ hasText: "مفيش اتصال" }).count()) === 0 && accessCalls - before === 1, `${accessCalls - before} requests`);

    // A query string or a trailing slash reaches the same copy.
    await ctx.setOffline(true);
    await page.goto(`${B}${path}?src=whatsapp`, { waitUntil: "domcontentloaded" }).catch(() => {});
    check("the same copy answers a link with a query string", (await qrCount(page)) === 1);
    await ctx.setOffline(false);

    // An expired copy is not served.
    await page.goto(`${B}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(async (p) => {
      const cache = await caches.open("maw3ed-bookings-v1");
      const key = new URL(p, location.origin).href;
      const res = await cache.match(key);
      const h = new Headers(res.headers);
      h.set("x-maw3ed-offline-until", new Date(Date.now() - 60_000).toISOString());
      await cache.put(key, new Response(await res.text(), { headers: h }));
    }, path);
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    const expiredText = (await page.textContent("body").catch(() => "")) ?? "";
    check("an expired copy is not served: the offline notice instead", (await qrCount(page)) === 0 && /مفيش اتصال/.test(expiredText));
    await ctx.setOffline(false);
    await page.goto(`${B}${path}`, { waitUntil: "networkidle" });
    check("…and was deleted; opening online keeps a fresh copy", (await keptKeys(page)).includes(path));

    // Cancelled: the copy goes on the next online visit.
    await send(biz.owner, `/api/business/bookings/${b1.id}`, "PATCH", { status: "CANCELLED" });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    check("a cancelled booking's copy is deleted the next time the page is opened", !(await keptKeys(page)).includes(path));
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    check("…so offline it shows the offline notice, no QR", (await qrCount(page)) === 0);
    await ctx.setOffline(false);

    // The owner's dashboard is never kept.
    const owner = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await owner.addCookies([{ name: "maw3ed-lang", value: "en", url: B }, ...cookiesOf(biz.owner)]);
    const op = await owner.newPage();
    await op.goto(`${B}/en/dashboard`, { waitUntil: "networkidle" });
    await op.evaluate(() => navigator.serviceWorker.ready);
    await op.reload({ waitUntil: "networkidle" });
    const keys = await keptKeys(op);
    await owner.setOffline(true);
    await op.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    const dashOffline = (await op.textContent("body").catch(() => "")) ?? "";
    check("an owner's dashboard is never kept: offline it is the offline notice", keys.every((k) => /^\/(en\/)?booking\//.test(k)) && /مفيش اتصال|offline/i.test(dashOffline) && !/Bookings today|حجوزات النهارده/.test(dashOffline));
    await browser.close();
  }

  /* ── Save QR in WebKit (Safari's engine) and Firefox ── */
  const b2 = (await book(biz, { slot: await slotNear(biz, biz.services[0].id, 40), name: "عميل سفاري" })).booking;
  for (const [label, engine] of [["WebKit", pw.webkit], ["Firefox", pw.firefox]]) {
    part(`Save QR — ${label}`);
    const browser = await engine.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await ctx.addCookies([{ name: "maw3ed-lang", value: "en", url: B }]);
    // Test environment only: the CSP's upgrade-insecure-requests sends
    // WebKit's requests for http://localhost to https (Chromium and Firefox
    // exempt localhost), so its scripts never load here. maw3ed.net is
    // https, where the directive changes nothing. Removed for this local
    // server only.
    await ctx.route(`${B}/**`, async (route) => {
      const res = await route.fetch();
      const headers = { ...res.headers() };
      if (headers["content-security-policy"]) headers["content-security-policy"] = headers["content-security-policy"].replace(/;\s*upgrade-insecure-requests/, "");
      await route.fulfill({ response: res, headers });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${B}/en/booking/${b2.accessToken}`, { waitUntil: "networkidle" });
    check(`${label}: the booking page shows the QR`, (await qrCount(page)) === 1);
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.getByRole("button", { name: "Save QR as image" }).click()]);
    const bytes = (await import("fs")).readFileSync(await dl.path());
    check(`${label}: Save QR gives a real PNG`, bytes.subarray(1, 4).toString() === "PNG" && bytes.length > 2000, `${bytes.length} bytes`);
    check(`${label}: no script error`, errors.length === 0, errors.join(" | "));
    await browser.close();
  }

  // The PNG holds a QR that decodes to the booking's check-in link.
  part("The saved image scans");
  {
    const browser = await pw.chromium.launch();
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    await page.goto(`${B}/en/booking/${b2.accessToken}`, { waitUntil: "networkidle" });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save QR as image" }).click()]);
    const buf = (await import("fs")).readFileSync(await dl.path());
    const expected = (await json(await fetch(`${B}/api/booking/${b2.accessToken}/access`))).checkIn?.url;
    // The QR the server makes for that link (same options as lib/access/customer.ts),
    // compared module by module with the pixels of the saved image.
    const QRCode = require("qrcode");
    const { PNG } = require("pngjs");
    const qr = QRCode.create(expected, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const img = PNG.sync.read(buf);
    const PAD = 48, SIZE = 720, MARGIN = 2;
    const cell = SIZE / (n + 2 * MARGIN);
    let wrong = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = Math.floor(PAD + (c + MARGIN + 0.5) * cell);
      const y = Math.floor(PAD + (r + MARGIN + 0.5) * cell);
      const dark = img.data[(y * img.width + x) * 4] < 128;
      if (dark !== !!qr.modules.get(r, c)) wrong += 1;
    }
    check("the saved image is the booking's check-in QR, module for module", !!expected && wrong === 0, `${wrong} of ${n * n} modules differ`);
    await browser.close();
  }
} catch (e) {
  check("script ran to completion", false, e instanceof Error ? e.stack : String(e));
} finally {
  await teardown();
  await pg.end();
  process.exit(summary(true) ? 1 : 0);
}
