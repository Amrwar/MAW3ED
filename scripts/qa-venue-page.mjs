// Axe (WCAG 2.1 A/AA) and overflow on a filled venue page, ar/en, phone and desktop.
// Creates a temporary published venue listing qa-salon, then removes it.
// Local only (server on :3101 against the QA DB): node scripts/qa-venue-page.mjs
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { Client } = require("pg");
const B = "http://localhost:3101";
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const pg = new Client({ connectionString: "postgresql://qa:qa@localhost:5450/maw3ed_qa" });
await pg.connect();
const slug = `axe-venue-${Date.now()}`;
const city = (await pg.query(`SELECT id FROM "City" LIMIT 1`)).rows[0].id;
const biz = (await pg.query(`SELECT id, "ownerId" FROM "Business" WHERE slug='qa-salon'`)).rows[0];
const v = (await pg.query(
  `INSERT INTO "Venue"(id, slug, "nameAr", "nameEn", "cityId", status, "isPublished", "descriptionAr", "descriptionEn", latitude, longitude, "updatedAt")
   VALUES ($1,$1,'مول للفحص','Check mall',$2,'ACTIVE',true,'وصف','Description',30.0,31.4,now()) RETURNING id`, [slug, city])).rows[0].id;
await pg.query(`INSERT INTO "VenueZone"(id,"venueId","nameAr","nameEn",level) VALUES ($1||'-z',$1,'الدور الأرضي','Ground',0)`, [v]);
await pg.query(`INSERT INTO "VenueGate"(id,"venueId","nameAr","nameEn",kind,latitude,longitude) VALUES ($1||'-g',$1,'البوابة','Gate','PEDESTRIAN',30.0,31.4)`, [v]);
await pg.query(`INSERT INTO "VenuePolicy"(id,"venueId","visitorEligibility","maxGuestsPerBooking","accessInstructionsAr","accessInstructionsEn","updatedAt") VALUES ($1||'-p',$1,'BOOKING_REQUIRED',2,'تعليمات','Instructions',now())`, [v]);
for (let d = 0; d < 7; d++) await pg.query(`INSERT INTO "VenueHours"(id,"venueId","dayOfWeek","openTime","closeTime") VALUES ($1||'-h'||$2::text,$1,$2::int,'10:00','22:00')`, [v, d]);
await pg.query(`INSERT INTO "VenueException"(id,"venueId",kind,"startsOn","endsOn","noteAr") VALUES ($1||'-e',$1,'SPECIAL_HOURS',current_date+3,current_date+3,'عيد')`, [v]);
await pg.query(`INSERT INTO "VenueMembership"(id,"venueId","businessId","zoneId",unit,status,"requestedById","updatedAt") VALUES ($1||'-m',$1,$2,$1||'-z','G-1','APPROVED',$3,now())`, [v, biz.id, biz.ownerId]);

const browser = await chromium.launch();
let bad = 0;
try {
  for (const lang of ["ar", "en"]) {
    for (const width of [375, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const url = `${B}${lang === "en" ? "/en" : ""}/venues/${slug}`;
      const res = await page.goto(url, { waitUntil: "networkidle" });
      await page.addScriptTag({ content: AXE });
      const violations = await page.evaluate(async () =>
        (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }))
          .violations.filter((x) => x.impact === "serious" || x.impact === "critical")
          .map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const ok = res.status() === 200 && violations.length === 0 && overflow <= 0;
      if (!ok) bad++;
      console.log(`${ok ? "ok" : "!!"} ${lang} ${width} status=${res.status()} overflow=${overflow} axe=${violations.join("; ") || "-"}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await pg.query(`DELETE FROM "Venue" WHERE id=$1`, [v]);
  await pg.end();
}
console.log(bad ? `${bad} problem page(s)` : "all clean");
process.exit(bad ? 1 : 0);
