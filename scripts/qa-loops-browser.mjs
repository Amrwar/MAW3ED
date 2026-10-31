/**
 * Browser loop audit (Phase 22 post-audit). In a real browser, with
 * Playwright's clock fast-forwarding timers:
 *
 *  1. a bookings page holds exactly one live stream (it used to hold two);
 *  2. a stream that keeps failing stops reconnecting at the cap, even
 *     after hours of simulated time;
 *  3. the acting banner's self-heal sends its DELETE once, even when the
 *     server keeps failing it;
 *  4. idle pages issue no repeated requests (render/refetch loops);
 *  5. repeated navigation does not grow the JS heap without bound.
 *
 * Local only.  node scripts/qa-loops-browser.mjs [baseUrl]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const B = process.argv.slice(2).find((a) => /^https?:/.test(a)) ?? "http://localhost:3101";
if (!/^http:\/\/localhost[:/]/.test(B)) {
  console.error("Local only.");
  process.exit(1);
}
const MAX_CONSECUTIVE_FAILURES = 8; // src/lib/realtime/booking-stream.ts
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch();
async function signedIn(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${B}/login`, { waitUntil: "networkidle" });
  await p.fill("#login-email", email);
  await p.fill("#login-password", "QaPassword123!");
  await Promise.all([p.waitForURL(/\/(dashboard|admin|org-admin)/, { timeout: 60000 }), p.click('button[type="submit"]')]);
  await p.close();
  return ctx;
}

try {
  // 1. One stream per tab.
  {
    const ctx = await signedIn("owner@qa.test");
    const page = await ctx.newPage();
    let streams = 0;
    page.on("request", (r) => { if (r.url().includes("/api/realtime/bookings")) streams++; });
    await page.goto(`${B}/dashboard/bookings`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    check("1: the bookings page (header + page both listening) opens exactly one stream", streams === 1, `${streams} stream request(s)`);
    await ctx.close();
  }

  // 2. A permanently failing stream stops at the cap.
  {
    const ctx = await signedIn("owner@qa.test");
    const page = await ctx.newPage();
    await page.clock.install();
    let attempts = 0;
    await page.route("**/api/realtime/bookings", (route) => {
      attempts++;
      return route.fulfill({ status: 401, body: "Unauthorized" });
    });
    await page.goto(`${B}/dashboard/bookings`, { waitUntil: "domcontentloaded" });
    for (let i = 0; i < 40; i++) {
      await page.clock.runFor(60_000); // 40 simulated minutes, a minute at a time
      await page.waitForTimeout(50);
    }
    const afterCap = attempts;
    await page.clock.runFor(6 * 60 * 60_000); // and six more hours
    await page.waitForTimeout(300);
    check(
      `2: a stream refused every time stops after ${MAX_CONSECUTIVE_FAILURES} attempts, and stays stopped for 6+ simulated hours`,
      afterCap === MAX_CONSECUTIVE_FAILURES && attempts === afterCap,
      `${afterCap} attempts by 40 min, ${attempts} after 6 h more`,
    );
    await ctx.close();
  }

  // 3. The banner self-heal is attempted once even when it keeps failing.
  {
    const ctx = await signedIn("owner@qa.test");
    await ctx.addCookies([{ name: "maw3ed-acting", value: "forgedcookievalue123", url: B }]);
    const page = await ctx.newPage();
    let deletes = 0;
    await page.route("**/api/organizations/acting", (route) => {
      if (route.request().method() === "DELETE") {
        deletes++;
        return route.fulfill({ status: 500, body: "{}" });
      }
      return route.continue();
    });
    await page.goto(`${B}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(8000);
    check("3: a failing self-heal is sent once, not retried in a loop", deletes === 1, `${deletes} DELETE(s)`);
    await ctx.close();
  }

  // 4. Idle pages are quiet.
  for (const [email, path] of [["owner@qa.test", "/dashboard"], ["owner@qa.test", "/dashboard/organizations"], ["owner@qa.test", "/dashboard/settings"], [null, "/groups"]]) {
    const ctx = email ? await signedIn(email) : await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${B}${path}`, { waitUntil: "networkidle" });
    let after = 0;
    const seen = new Map();
    page.on("request", (r) => {
      if (!["fetch", "xhr", "document"].includes(r.resourceType())) return;
      if (r.url().includes("/api/realtime/bookings")) return; // the one long-lived stream
      after++;
      seen.set(r.url(), (seen.get(r.url()) ?? 0) + 1);
    });
    await page.waitForTimeout(15000);
    check(`4: ${path} issues no repeated requests while idle (15 s)`, after === 0, after ? JSON.stringify([...seen]) : "0 requests");
    await ctx.close();
  }

  // 5. Heap after repeated navigation.
  {
    const ctx = await signedIn("owner@qa.test");
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const heap = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      return (await page.evaluate(() => performance.memory.usedJSHeapSize)) / 1048576;
    };
    const route = ["/dashboard", "/dashboard/bookings", "/dashboard/customers", "/dashboard/services", "/dashboard/organizations"];
    await page.goto(`${B}/dashboard`, { waitUntil: "networkidle" });
    const nav = async () => {
      for (const r of route) {
        await page.evaluate((href) => {
          const a = document.querySelector(`a[href="${href}"]`);
          if (a) a.click();
        }, r);
        await page.waitForTimeout(600);
      }
    };
    await nav();
    const first = await heap();
    for (let i = 0; i < 6; i++) await nav();
    const last = await heap();
    check("5: 35 client-side navigations do not grow the heap by more than 25%", last <= first * 1.25, `${first.toFixed(1)} MB → ${last.toFixed(1)} MB`);
    await ctx.close();
  }
} catch (e) {
  check("script ran to the end", false, String(e?.stack ?? e));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
