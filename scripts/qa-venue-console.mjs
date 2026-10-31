// Venue console in a real browser: axe + overflow (ar/en × 375/1440), the
// attention panel, a gate toggle that persists, and access revoked mid-
// session. Creates a temporary manager and venue and removes them.
// Local only (server on :3101 against the QA DB): node scripts/qa-venue-console.mjs
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { Client } = require("pg");
const B = "http://localhost:3101";
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const pg = new Client({ connectionString: "postgresql://qa:qa@localhost:5450/maw3ed_qa" });
await pg.connect();
const stamp = Date.now();
const email = `probe-mgr-${stamp}@example.test`;
const PASSWORD = "QaPassword123!";
let bad = 0;
const report = (ok, line) => { if (!ok) bad++; console.log(`${ok ? "ok" : "!!"} ${line}`); };

await fetch(`${B}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify({ name: "Probe Manager", email, password: PASSWORD }) });
const userId = (await pg.query(`UPDATE "User" SET "emailVerified"=now() WHERE email=$1 RETURNING id`, [email])).rows[0].id;
const city = (await pg.query(`SELECT id FROM "City" LIMIT 1`)).rows[0].id;
const v = (await pg.query(`INSERT INTO "Venue"(id,slug,"nameAr","nameEn","cityId",status,"isPublished","updatedAt") VALUES ($1,$1,'مول الفحص','Probe mall',$2,'ACTIVE',true,now()) RETURNING id`, [`probe-venue-${stamp}`, city])).rows[0].id;
await pg.query(`INSERT INTO "VenueZone"(id,"venueId","nameAr","nameEn",level) VALUES ($1||'-z',$1,'الدور الأرضي','Ground',0)`, [v]);
await pg.query(`INSERT INTO "VenueGate"(id,"venueId","nameAr","nameEn",kind) VALUES ($1||'-g',$1,'البوابة','Gate','PEDESTRIAN')`, [v]);
await pg.query(`INSERT INTO "VenuePolicy"(id,"venueId","visitorEligibility","updatedAt") VALUES ($1||'-p',$1,'BOOKING_REQUIRED',now())`, [v]);
await pg.query(`INSERT INTO "VenueRole"(id,"userId",kind,"venueId") VALUES ($1||'-r',$2,'VENUE_MANAGER',$1)`, [v, userId]);

const browser = await chromium.launch();
try {
  for (const lang of ["ar", "en"]) {
    for (const width of [375, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      await ctx.addCookies([{ name: "maw3ed-lang", value: lang, url: B }]);
      const p = await ctx.newPage();
      await p.goto(`${B}/login`, { waitUntil: "networkidle" });
      await p.fill("#login-email", email);
      await p.fill("#login-password", PASSWORD);
      await Promise.all([p.waitForURL(/org-admin|venue-admin/, { timeout: 60000 }), p.click('button[type="submit"]')]);
      await p.goto(`${B}/venue-admin/${v}`, { waitUntil: "networkidle" });
      await p.getByText(lang === "en" ? "Needs your attention" : "محتاج انتباهك").waitFor({ timeout: 20000 });
      const flagged = await p.getByText(lang === "en" ? "no access instructions are published" : "مفيش تعليمات دخول منشورة", { exact: false }).count();
      await p.addScriptTag({ content: AXE });
      const violations = await p.evaluate(async () =>
        (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }))
          .violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`));
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const enumLeak = await p.evaluate(() => /\b(VENUE_MANAGER|PEDESTRIAN|ACTIVE|FLOOR)\b/.test(document.body.innerText));
      report(violations.length === 0 && overflow <= 0 && flagged > 0 && !enumLeak,
        `${lang} ${width} axe=${violations.join("; ") || "-"} overflow=${overflow} attention-flag=${flagged > 0} raw-enum-shown=${enumLeak}`);

      if (lang === "en" && width === 1440) {
        await p.getByRole("button", { name: "Turn off" }).first().click();
        await p.getByText("Saved.").waitFor({ timeout: 15000 });
        // Wait for the console to finish reloading before the role goes.
        await p.getByRole("button", { name: "Turn on" }).first().waitFor({ timeout: 15000 });
        const g = (await pg.query(`SELECT "isActive", kind FROM "VenueGate" WHERE id=$1`, [`${v}-g`])).rows[0];
        report(g.isActive === false && g.kind === "PEDESTRIAN", `gate toggle persisted (isActive=${g.isActive}, kind=${g.kind})`);
        // The role is taken away while the console is open.
        await pg.query(`DELETE FROM "VenueRole" WHERE id=$1`, [`${v}-r`]);
        await p.getByRole("button", { name: "Turn on" }).first().click();
        await p.getByText("You no longer have access to this venue.").waitFor({ timeout: 15000 }).then(
          () => report(true, "access revoked mid-session shows a clear message, not an endless load"),
          () => report(false, "access revoked mid-session: no clear message"),
        );
        const after = (await pg.query(`SELECT "isActive" FROM "VenueGate" WHERE id=$1`, [`${v}-g`])).rows[0];
        report(after.isActive === false, `the revoked manager's change was refused (isActive=${after.isActive})`);
      }
      await ctx.close();
    }
  }
} catch (e) {
  report(false, `probe crashed: ${e.message}`);
} finally {
  await browser.close();
  await pg.query(`DELETE FROM "AuditLog" WHERE "resourceId"=$1`, [v]);
  await pg.query(`DELETE FROM "Venue" WHERE id=$1`, [v]);
  await pg.query(`DELETE FROM "LifecycleEvent" WHERE "userId"=$1`, [userId]);
  await pg.query(`DELETE FROM "User" WHERE id=$1`, [userId]);
  await pg.end();
}
console.log(bad ? `${bad} problem(s)` : "all clean");
process.exit(bad ? 1 : 0);
