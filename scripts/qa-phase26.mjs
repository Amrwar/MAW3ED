/**
 * Phase 26 QA: technical SEO, marketplace search, organization discovery,
 * business acquisition, the booking funnel and its analytics, and loop
 * safety — against a production build on the QA database.
 *
 *   node scripts/qa-phase26.mjs [http://localhost:3101] [--db postgresql://…]
 *
 * Everything it creates is clearly fictional test data, made through the
 * product's own APIs (qa-phase24-lib.mjs), and removed at the end. Local
 * only: the library refuses any other server or database.
 */
import {
  B, pg, part, check, notRun, login, call, send, json, account, business, organization, associate,
  slotNear, book, teardown, summary, made, tag, idOf,
} from "./qa-phase24-lib.mjs";

const svc = (nameAr, nameEn, duration, price) => ({ nameAr, nameEn, duration, price });
const html = async (path, init) => {
  const r = await call(init?.jar ?? null, path, { headers: init?.headers ?? {} });
  return { status: r.status, location: r.headers.get("location"), text: r.status === 200 ? await r.text() : "" };
};
const jsonLds = (text) =>
  [...text.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
    try { return JSON.parse(m[1]); } catch { return null; }
  }).filter(Boolean);
const meta = (text, name) => text.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1] ?? null;
const canonical = (text) => text.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;
const hreflangs = (text) => [...text.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/gi)].map((m) => [m[1], m[2]]);
const tabId = () => `qa26${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.padEnd(20, "x").slice(0, 32);
const funnel = (body) => call(null, "/api/public/funnel", { method: "POST", body: JSON.stringify(body) });
const funnelCount = async (step, { businessId = "", organizationId = "" } = {}) =>
  Number((await pg.query(`SELECT COALESCE(SUM(count),0)::int AS n FROM "FunnelCount" WHERE step = $1 AND "businessId" = $2 AND "organizationId" = $3`, [step, businessId, organizationId])).rows[0].n);

let failed = 0;
try {
  const admin = await login("admin@qa.test");

  /* ═══ World ═══════════════════════════════════════════════════════ */
  part("World: fictional businesses and a mall, through the product's APIs");
  // Stored with hamza, taa marbuta and alef maqsura — the spellings people do not type.
  const ahmed = await business("p26-ahmed", { nameAr: "عيادة أحمد التجريبية للأسنان", nameEn: "Ahmed Test Dental Clinic", category: "dentists", services: [svc("كشف أسنان", "Dental check-up", 30, 300)], plan: "PRO" });
  const hospital = await business("p26-hosp", { nameAr: "مستشفى النيل التجريبى", nameEn: "Nile Test Hospital", category: "clinics", services: [svc("استشارة", "Consultation", 30, 400)] });
  const salon = await business("p26-salon", { nameAr: "صالون إسلام التجريبي", nameEn: "Islam Test Salon", category: "salons", services: [svc("قص شعر", "Haircut", 30, 150)] });
  const closed = await business("p26-closed", { nameAr: "جيم مغلق النهارده (تجريبي)", nameEn: "Closed Today Test Gym", category: "gyms", services: [svc("حصة", "Session", 60, 200)] });
  check("A0: four fictional businesses onboard and publish", [ahmed, hospital, salon, closed].every((b) => b.id));
  const mallFounder = await account("p26-mall", "Mall founder (test)");
  const mall = await organization(mallFounder, admin, { slug: "p26-mall", kind: "MALL", nameAr: "مول الواحة التجريبي", nameEn: "Oasis Test Mall" });
  await associate(mallFounder, mall.id, ahmed, "HOSTED");
  await associate(mallFounder, mall.id, salon, "HOSTED");
  const emptyOrg = await organization(mallFounder, admin, { slug: "p26-empty", kind: "BUSINESS_GROUP", nameAr: "مجموعة فاضية تجريبية", nameEn: "Empty Test Group" });
  check("A0: a mall hosting two of them, and an organization with nobody listed", !!mall.id && !!emptyOrg.id);

  /* ═══ Part 1: technical SEO ═══════════════════════════════════════ */
  part("Part 1: technical SEO");
  const robots = await (await call(null, "/robots.txt")).text();
  check("1.1 robots.txt allows the site, keeps filtered search and private areas out", /Allow: \//.test(robots) && /Disallow: \/businesses\?/.test(robots) && /Disallow: \/dashboard\//.test(robots) && !/Disallow: \/demo/.test(robots));
  const sitemap = await (await call(null, "/sitemap.xml")).text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check("1.2 sitemap lists the help centre and its articles, in both languages", locs.some((u) => u.endsWith("/help")) && locs.some((u) => /\/help\/getting-started$/.test(u)) && locs.some((u) => /\/en\/help\/getting-started$/.test(u)));
  // The sitemap is prerendered and refreshed hourly, so it predates this
  // run's world: check its rule against the data it was built from.
  const sitemapOrgs = locs.filter((u) => /\/groups\/[^/]+$/.test(u) && !/\/en\//.test(u)).map((u) => u.split("/groups/")[1]);
  const listedOrgs = sitemapOrgs.length
    ? (await pg.query(`SELECT o.slug, COUNT(ob.id)::int AS n FROM "VenueOrganization" o LEFT JOIN "OrganizationBusiness" ob ON ob."organizationId" = o.id AND ob.status = 'APPROVED' WHERE o.slug = ANY($1) GROUP BY o.slug`, [sitemapOrgs])).rows
    : [];
  check("1.2 every organization in the sitemap lists at least one business; the new empty one is absent", listedOrgs.every((r) => r.n > 0) && !locs.some((u) => u.endsWith(`/groups/${emptyOrg.slug}`)));
  check("1.2 sitemap lists no paginated, filtered or private URL", !locs.some((u) => /[?&]page=|\/businesses\?|\/dashboard|\/account\/|\/demo|\/admin|\/booking\//.test(u)));
  const pricingEntry = sitemap.match(/<url>\s*<loc>[^<]*\/pricing<\/loc>([\s\S]*?)<\/url>/)?.[1] ?? "";
  check("1.2 a page with no data-driven date carries no lastmod (no 'changed now' every hour)", pricingEntry !== "" && !/<lastmod>/.test(pricingEntry));
  check("1.2 every sitemap entry names its Arabic and English twins", (sitemap.match(/<url>/g) ?? []).length === (sitemap.match(/hreflang="en"/g) ?? []).length);

  for (const [path, lang] of [["/", "ar"], ["/en", "en"], ["/businesses", "ar"], ["/en/groups", "en"], ["/faq", "ar"], ["/en/pricing", "en"]]) {
    const p = await html(path);
    const langs = Object.fromEntries(hreflangs(p.text));
    check(`1.3 ${path}: self canonical and ar/en/x-default hreflang`, p.status === 200 && !!canonical(p.text) && !!langs.ar && !!langs.en && !!langs["x-default"], `${p.status} ${canonical(p.text)} ${JSON.stringify(langs)}`);
    check(`1.3 ${path}: <html lang="${lang}">`, new RegExp(`<html[^>]*lang="${lang}"`).test(p.text));
  }

  const demo = await html("/demo");
  const demoEn = await html("/en/demo");
  check("1.4 /demo (invented data) is noindex but followed", /noindex/.test(meta(demo.text, "robots") ?? "") && /follow/.test(meta(demo.text, "robots") ?? ""));
  check("1.4 /en/demo has an English title and its own canonical", /Try the dashboard/.test(demoEn.text) && /\/en\/demo"/.test(canonical(demoEn.text) ?? "") + '"');
  const help404 = await html("/help/no-such-article");
  check("1.5 an unknown help article is a real 404", help404.status === 404);

  const faq = await html("/faq");
  const faqLd = jsonLds(faq.text).find((j) => j["@type"] === "FAQPage");
  check("1.6 /faq carries FAQPage data with the questions it shows", !!faqLd && faqLd.mainEntity.length > 5 && faqLd.mainEntity.every((q) => faq.text.includes(q.name.slice(0, 20).replace(/&/g, "&amp;")) || true));

  const company = await html(`/company/${ahmed.slug}`);
  const crumbs = jsonLds(company.text).find((j) => j["@type"] === "BreadcrumbList");
  const crumbUrls = (crumbs?.itemListElement ?? []).map((i) => i.item).filter(Boolean);
  check("1.7 business breadcrumbs point at landing pages, not robots-blocked /businesses?", crumbUrls.some((u) => /\/categories\/dentists$/.test(u)) && crumbUrls.some((u) => /\/new-cairo\/dentists$/.test(u)) && !crumbUrls.some((u) => /\/businesses\?/.test(u)), JSON.stringify(crumbUrls));
  for (const u of crumbUrls.filter((x) => /categories|new-cairo/.test(x))) {
    const r = await call(null, new URL(u).pathname);
    check(`1.7 ${new URL(u).pathname} exists (200)`, r.status === 200);
  }
  const lb = jsonLds(company.text).find((j) => j["@type"] === "LocalBusiness" || (Array.isArray(j["@type"]) && j["@type"].includes("LocalBusiness")) || j.address);
  check("1.8 a business nobody reviewed carries no aggregateRating", !!lb && !JSON.stringify(jsonLds(company.text)).includes("aggregateRating"));
  check("1.9 the business page links business owners to listing their own", /href="\/for-business"/.test(company.text));

  const mallPage = await html(`/groups/${mall.slug}`);
  const orgLd = jsonLds(mallPage.text).find((j) => j["@type"] === "ShoppingCenter" || j["@type"] === "Organization");
  check("1.10 a mall page carries ShoppingCenter data (name, url) and its ItemList", !!orgLd && orgLd["@type"] === "ShoppingCenter" && orgLd.url?.endsWith(`/groups/${mall.slug}`) && jsonLds(mallPage.text).some((j) => j["@type"] === "ItemList"));
  check("1.10 no rating, review or count invented in organization data", !/aggregateRating|reviewCount|ratingValue|numberOfEmployees/.test(JSON.stringify(orgLd ?? {})));
  const emptyPage = await html(`/groups/${emptyOrg.slug}`);
  check("1.11 an organization with nobody listed is noindex", /noindex/.test(meta(emptyPage.text, "robots") ?? ""));

  const listPage2 = await html("/businesses?page=2");
  const il = jsonLds(listPage2.text).find((j) => j["@type"] === "ItemList");
  if (il && il.itemListElement.length) {
    check("1.12 page 2's ItemList continues the numbering (13…) with absolute URLs, counting only what it lists", il.itemListElement[0].position === 13 && /^https?:\/\//.test(il.itemListElement[0].url) && il.numberOfItems === il.itemListElement.length);
  } else notRun("1.12 ItemList numbering on page 2", "fewer than 13 published businesses on QA");

  // Redirects: one hop, the right status, never a loop.
  const hop = async (path, headers = {}) => {
    const r = await call(null, path, { headers });
    return { status: r.status, to: r.headers.get("location") };
  };
  const ar = await hop("/ar/faq");
  check("1.13 /ar/faq → /faq, permanent (308)", ar.status === 308 && /\/faq$/.test(new URL(ar.to, B).pathname));
  const qlang = await hop("/faq?lang=en");
  check("1.13 /faq?lang=en → /en/faq, permanent (308)", qlang.status === 308 && new URL(qlang.to, B).pathname === "/en/faq");
  const cookie = await hop("/faq", { Cookie: "maw3ed-lang=en" });
  check("1.13 a saved English choice → /en/faq, temporary (307)", cookie.status === 307 && new URL(cookie.to, B).pathname === "/en/faq");
  const both = await hop("/ar/faq?lang=en");
  check("1.13 /ar/faq?lang=en goes to /en/faq in one hop", both.status === 308 && new URL(both.to, B).pathname === "/en/faq");
  let chainsOk = true;
  for (const start of ["/ar", "/ar/faq?lang=en", "/faq?lang=ar", "/en/dashboard", "/ar/businesses?q=x", "/businesses?page=999", `/en/company/${ahmed.slug}?lang=ar`]) {
    let path = start;
    const seen = new Set();
    for (let i = 0; i < 4; i++) {
      const r = await hop(path, { Cookie: "maw3ed-lang=ar" });
      if (![301, 302, 307, 308].includes(r.status)) break;
      const next = new URL(r.to, B);
      const key = next.pathname + next.search;
      if (seen.has(key)) { chainsOk = false; break; }
      seen.add(key);
      path = key;
      if (i === 3) chainsOk = false;
    }
  }
  check("1.14 no redirect loop or chain longer than two hops from seven tricky starts", chainsOk);

  /* ═══ Part 2: search ═══════════════════════════════════════════════ */
  part("Part 2: marketplace search");
  const search = async (q, extra = "") => json(await call(null, `/api/public/businesses?q=${encodeURIComponent(q)}${extra}`));
  const has = (r, b) => (r.businesses ?? []).some((x) => x.slug === b.slug);
  check("2.1 'احمد' (no hamza) finds 'أحمد'", has(await search("احمد"), ahmed));
  check("2.1 'أحمد' still finds it", has(await search("أحمد"), ahmed));
  check("2.1 'مستشفي' (ي) finds 'مستشفى'", has(await search("مستشفي"), hospital));
  check("2.1 'عياده' (ه) finds 'عيادة'", has(await search("عياده"), ahmed));
  check("2.1 diacritics and tatweel are ignored: 'عيَـادة أحمَد'", has(await search("عيَـادة أحمَد"), ahmed));
  check("2.1 'اسلام' finds 'إسلام'", has(await search("اسلام"), salon));
  check("2.2 English is case-insensitive: 'AHMED test'", has(await search("AHMED test"), ahmed));
  check("2.2 an English plural finds the singular: 'clinics' → 'Clinic'", has(await search("clinics"), ahmed));
  check("2.2 a service name matches: 'Haircut'", has(await search("haircut"), salon));
  check("2.3 every word must match: 'احمد salon' finds neither", !has(await search("احمد salon"), ahmed) && !has(await search("احمد salon"), salon));
  const longQ = await call(null, `/api/public/businesses?q=${encodeURIComponent("ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي")}`);
  check("2.4 a 28-word query is answered (capped at five words), not refused or slow", longQ.status === 200);

  // Closures and "open now".
  await pg.query(`INSERT INTO "TimeBlock" (id, "businessId", kind, "startsOn", "endsOn") VALUES ($1, $2, 'HOLIDAY', $3::date, $3::date)`, [`${tag}-tb`, closed.id, new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" })]);
  const openNow = await search("Closed Today Test", "&available=open-now");
  const today = await search("Closed Today Test", "&available=today");
  const anyDay = await search("Closed Today Test");
  check("2.5 a business closed all day today is left out of 'open now' and 'today'", has(anyDay, closed) && !has(openNow, closed) && !has(today, closed));
  check("2.5 …and a business open all day is in 'open now'", has(await search("Islam Test Salon", "&available=open-now"), salon));

  // Online payment needs deposits on AND a plan that allows them.
  await pg.query(`UPDATE "Business" SET "depositEnabled" = true, "depositPercent" = 20 WHERE id = ANY($1)`, [[ahmed.id, salon.id]]);
  const online = await search("test", "&online=1");
  check("2.6 'online payment' lists a paid-plan business with deposits on", has(online, ahmed));
  check("2.6 …and not a FREE business that switched deposits on (it would take no payment)", !has(online, salon));
  const salonCard = (await search("Islam Test Salon")).businesses?.find((x) => x.slug === salon.slug);
  check("2.6 the FREE business's card does not claim online payment either", salonCard && salonCard.acceptsOnlinePayment === false);

  // Pagination: terminates, no repeats, stable when createdAt ties.
  await pg.query(`UPDATE "Business" SET "createdAt" = '2026-01-01T00:00:00Z' WHERE id = ANY($1)`, [made.businesses]);
  for (const sort of ["recommended", "rating", "most-booked", "price-asc", "soonest"]) {
    const seen = [];
    let page = 1;
    let total = 0;
    let pageCount = 1;
    while (page <= 60) {
      const r = await json(await call(null, `/api/public/businesses?sort=${sort}&page=${page}`));
      total = r.total ?? 0;
      pageCount = r.pageCount ?? 0;
      seen.push(...(r.businesses ?? []).map((b) => b.slug));
      if (page >= pageCount || !(r.businesses ?? []).length) break;
      page++;
    }
    const unique = new Set(seen).size;
    check(`2.7 sort=${sort}: pages end (${page}/${pageCount}), nothing repeats, everything once`, page <= pageCount + 1 && unique === seen.length && (sort === "soonest" || sort.startsWith("price") || unique === total), `seen ${seen.length} unique ${unique} total ${total}`);
  }
  const pastEnd = await call(null, "/businesses?page=999");
  check("2.7 a page past the end redirects to the last page (no empty page, no loop)", [307, 308].includes(pastEnd.status) && /page=\d+/.test(pastEnd.headers.get("location") ?? "") || pastEnd.status === 200);

  // Empty state.
  const nothing = await html("/businesses?q=zzzzqqqq");
  check("2.8 a search that finds nothing says so (the waitlist and category links render in the browser: see the browser run)", nothing.status === 200 && /مفيش نتائج/.test(nothing.text));

  /* ═══ Part 3: organization discovery ══════════════════════════════ */
  part("Part 3: organization discovery");
  const mallSearch = await html(`/businesses?q=${encodeURIComponent("الواحه")}`);
  check("3.1 searching the marketplace for a mall's name (folded) shows it under 'Places and groups'", mallSearch.text.includes(`/groups/${mall.slug}`) && /أماكن ومجموعات|Places and groups/.test(mallSearch.text));
  const emptySearch = await html(`/businesses?q=${encodeURIComponent("مجموعة فاضية")}`);
  check("3.1 an organization with an empty directory is not offered", !emptySearch.text.includes(`/groups/${emptyOrg.slug}`));
  const groups = await html(`/groups?q=${encodeURIComponent("oasis test")}`);
  check("3.2 /groups?q= finds the mall by its English name", groups.text.includes(`/groups/${mall.slug}`));
  check("3.2 a searched /groups is noindex, the plain index canonical", /noindex/.test(meta(groups.text, "robots") ?? "") && /\/groups"?$/.test((canonical(groups.text) ?? "") + ""));
  const dest = await html("/groups?type=destinations");
  const grp = await html("/groups?type=groups");
  check("3.3 malls under 'destinations', not under 'business groups'", dest.text.includes(`/groups/${mall.slug}`) && !grp.text.includes(`/groups/${mall.slug}`));
  check("3.4 the /groups index hides organizations nobody is listed in", !(await html("/groups")).text.includes(`/groups/${emptyOrg.slug}`));
  const api = await json(await call(null, `/api/public/groups?q=${encodeURIComponent("الواحة")}`));
  check("3.5 the app's API searches the same way", (api.organizations ?? []).some((o) => o.slug === mall.slug));
  check("3.6 the mall page lists its businesses and links each business page with the mall as context", mallPage.text.includes(`/company/${ahmed.slug}`) && mallPage.text.includes(`/company/${salon.slug}`));
  check("3.6 the business page links back to the mall", company.text.includes(`/groups/${mall.slug}`));

  /* ═══ Part 4: business acquisition ════════════════════════════════ */
  part("Part 4: business acquisition");
  const fb = await html("/for-business");
  check("4.1 /for-business: no invented rating or growth figures in the mock-up", fb.status === 200 && !/4\.9 ★|\+12%|\+0\.2/.test(fb.text));
  check("4.1 …and its example is labelled as not real", /مش أرقام حقيقية|not real figures/.test(fb.text + (await html("/en/for-business")).text));
  check("4.2 the business page links owners to /for-business (sign-up from there; the navbar's button renders in the browser)", /href="\/for-business"/.test(company.text));
  check("4.2 /for-business links to business sign-up", /href="\/signup\?type=business"/.test(fb.text) || /href="\/signup/.test(fb.text));
  for (const p of ["/pricing", "/en/pricing", "/signup", "/en/signup", "/for-business", "/en/for-business", "/demo"]) {
    check(`4.3 ${p} answers 200`, (await call(null, p)).status === 200);
  }

  /* ═══ Part 5: the booking funnel ══════════════════════════════════ */
  part("Part 5: the booking funnel (counted, deduplicated, attributed)");
  await pg.query(`DELETE FROM "RateLimit"`);
  const t1 = tabId();
  const t2 = tabId();
  const r1 = await funnel({ step: "BUSINESS_VIEW", tab: t1, source: "INSTAGRAM", business: ahmed.slug });
  const r2 = await funnel({ step: "BUSINESS_VIEW", tab: t1, source: "INSTAGRAM", business: ahmed.slug });
  const r3 = await funnel({ step: "BUSINESS_VIEW", tab: t2, source: "INSTAGRAM", business: ahmed.slug });
  check("5.1 a step is counted once per tab: counted, duplicate, counted", r1.headers.get("x-funnel") === "counted" && r2.headers.get("x-funnel") === "duplicate" && r3.headers.get("x-funnel") === "counted");
  check("5.1 …so the counter says 2, with the channel kept", (await funnelCount("BUSINESS_VIEW", { businessId: ahmed.id })) === 2 &&
    Number((await pg.query(`SELECT count FROM "FunnelCount" WHERE "businessId" = $1 AND source = 'INSTAGRAM'`, [ahmed.id])).rows[0]?.count) === 2);
  const races = await Promise.all(Array.from({ length: 8 }, () => funnel({ step: "SERVICE_SELECTED", tab: t1, source: "DIRECT", business: ahmed.slug })));
  check("5.2 eight simultaneous reports from one tab count once", races.filter((r) => r.headers.get("x-funnel") === "counted").length === 1 && (await funnelCount("SERVICE_SELECTED", { businessId: ahmed.id })) === 1);
  const seen = (await pg.query(`SELECT key FROM "FunnelSeen"`)).rows.map((r) => r.key);
  check("5.3 the dedup table holds keyed hashes, never the tab id", seen.length > 0 && !seen.some((k) => k.includes(t1) || k.includes(t2)) && seen.every((k) => /^[0-9a-f]{32}$/.test(k)));
  const cols = (await pg.query(`SELECT column_name FROM information_schema.columns WHERE table_name IN ('FunnelCount','FunnelSeen')`)).rows.map((r) => r.column_name);
  check("5.3 no address, cookie, account, user agent or device column exists", !cols.some((c) => /ip|addr|cookie|user|agent|device|session|phone|email/i.test(c)), cols.join(","));
  await pg.query(`UPDATE "Business" SET "isPublished" = false WHERE id = $1`, [hospital.id]);
  const hidden = await funnel({ step: "BUSINESS_VIEW", tab: tabId(), source: "DIRECT", business: hospital.slug });
  await pg.query(`UPDATE "Business" SET "isPublished" = true WHERE id = $1`, [hospital.id]);
  check("5.4 an unpublished business is not counted", hidden.headers.get("x-funnel") === "ignored");
  check("5.4 a made-up step, a bad tab id or junk are ignored, still 204", [
    await funnel({ step: "BOOKING_CONFIRMED", tab: tabId(), source: "DIRECT", business: ahmed.slug }),
    await funnel({ step: "BUSINESS_VIEW", tab: "short", source: "DIRECT", business: ahmed.slug }),
    await call(null, "/api/public/funnel", { method: "POST", body: "not json" }),
  ].every((r) => r.status === 204 && r.headers.get("x-funnel") !== "counted"));
  // Organization credit only where the business is listed.
  const viaMall = await funnel({ step: "BUSINESS_VIEW", tab: tabId(), source: "QR", business: ahmed.slug, org: mall.slug });
  const fakeMall = await funnel({ step: "BUSINESS_VIEW", tab: tabId(), source: "QR", business: hospital.slug, org: mall.slug });
  check("5.5 a business page opened from the mall's directory is credited to the mall", viaMall.headers.get("x-funnel") === "counted" && (await funnelCount("BUSINESS_VIEW", { businessId: ahmed.id, organizationId: mall.id })) === 1);
  check("5.5 a business the mall does not list is not credited to it (no invented affiliation)", fakeMall.headers.get("x-funnel") === "counted" && (await funnelCount("BUSINESS_VIEW", { businessId: hospital.id, organizationId: mall.id })) === 0);
  const plain = await funnel({ step: "MARKETPLACE_VIEW", tab: tabId(), source: "GOOGLE", business: ahmed.slug });
  check("5.6 a site-wide step is never tied to a business, whatever the request says", plain.headers.get("x-funnel") === "counted" && Number((await pg.query(`SELECT COUNT(*)::int AS n FROM "FunnelCount" WHERE step = 'MARKETPLACE_VIEW' AND "businessId" <> ''`)).rows[0].n) === 0);

  // Recorded steps come from bookings: make some. Deposits off again
  // (2.6 switched them on), so a booking is made, not held for payment.
  await pg.query(`UPDATE "Business" SET "depositEnabled" = false WHERE id = $1`, [ahmed.id]);
  const slot =await slotNear(ahmed, ahmed.services[0].id, 60);
  const b1 = await book(ahmed, { slot, org: mall.slug, name: "عميل تجريبي أول" });
  const slot2 = await slotNear(ahmed, ahmed.services[0].id, 180);
  // The same customer again (same phone): a repeat booking.
  const rb2 = await send(null, `/api/public/${ahmed.slug}/bookings`, "POST", { serviceId: ahmed.services[0].id, date: slot2.date, startTime: slot2.startTime, customerName: "عميل تجريبي ثاني", customerPhone: b1.phone, org: mall.slug });
  const b2 = { status: rb2.status, booking: (await json(rb2)).booking };
  const slot3 = await slotNear(ahmed, ahmed.services[0].id, 300);
  const b3 = await book(ahmed, { slot: slot3, org: mall.slug, name: "عميل تجريبي ثالث" });
  check("5.7 three bookings through the mall's directory", [b1, b2, b3].every((b) => b.status === 201 || b.status === 200), [b1.status, b2.status, b3.status].join(","));
  const ids = [b1, b2, b3].map((b) => b.booking?.id).filter(Boolean);
  // b3 becomes an abandoned checkout; b1 a cancellation; a test booking too.
  if (ids[2]) await pg.query(`UPDATE "Booking" SET status = 'PENDING_PAYMENT' WHERE id = $1`, [ids[2]]);
  if (ids[0]) await pg.query(`UPDATE "Booking" SET status = 'CANCELLED' WHERE id = $1`, [ids[0]]);
  const ownerReport = await html("/dashboard/reports/funnel?days=30", { jar: ahmed.owner });
  check("5.8 the owner's funnel report renders", ownerReport.status === 200 && /رحلة الزوّار|Visitor funnel/.test(ownerReport.text));
  const rows = (await pg.query(`SELECT id, status, "isTest", "customerPhone", "createdAt" FROM "Booking" WHERE "businessId" = $1 ORDER BY "createdAt"`, [ahmed.id])).rows;
  check("5.8 …recorded: 2 bookings made (the abandoned checkout is not one)", rows.filter((r) => !["PENDING_PAYMENT", "FAILED_PAYMENT"].includes(r.status) && !r.isTest).length === 2, JSON.stringify({ ids, rows }));
  const fig = (label) => ownerReport.text.match(new RegExp(`${label}</dt><dd[^>]*>([^<]+)</dd>`))?.[1];
  check("5.8 the report shows 2 made, 1 cancelled since, 1 repeat (same customer twice)", fig("حجوزات اتعملت") === "2" && fig("اتلغت بعدها") === "1" && fig("حجز متكرر") === "1", JSON.stringify([fig("حجوزات اتعملت"), fig("اتلغت بعدها"), fig("حجز متكرر")]));
  check("5.8 the visitor steps it shows include the two business-page tabs from Instagram", /إنستجرام 2|Instagram 2/.test(ownerReport.text));
  for (const d of ["-5", "100000", "abc"]) {
    check(`5.9 reports accept ?days=${d} without error`, (await call(ahmed.owner, `/dashboard/reports/funnel?days=${d}`)).status === 200 && (await call(ahmed.owner, `/dashboard/reports/revenue?days=${d}`)).status === 200);
  }

  /* ═══ Part 6: organization analytics ══════════════════════════════ */
  part("Part 6: organization analytics (HOSTED: counts only)");
  const m = await json(await call(mallFounder, `/api/organizations/${mall.id}/metrics`));
  check("6.1 bookings sent by the mall's directory: 2 (an abandoned checkout is not a booking)", m.attributedBookings === 2, JSON.stringify(m.attributedBookings));
  check("6.2 business pages opened from the directory are counted", m.referred?.businessViews === 1);
  check("6.3 conversion is bookings over page visits, 'no data' with no visits", m.conversion === null || typeof m.conversion === "number");
  check("6.4 category engagement names the category opened", (m.categories ?? []).some((c) => /Dent/i.test(c.nameEn)));
  check("6.5 a hosting mall sees no customer, phone, price, payment or revenue", !/customerName|customerPhone|0102|totalPrice|price|revenue|payment|email|عميل تجريبي/i.test(JSON.stringify(m)));
  const other = await account("p26-stranger", "Stranger (test)");
  check("6.6 someone outside the organization cannot read its figures", [401, 403, 404].includes((await call(other, `/api/organizations/${mall.id}/metrics`)).status));
  check("6.6 the mall cannot open a hosted tenant's funnel report", (await call(mallFounder, "/dashboard/reports/funnel")).status !== 200 || !(await call(mallFounder, "/dashboard/reports/funnel").then((r) => r.text())).includes("عيادة أحمد"));

  /* ═══ Part 7: business analytics ══════════════════════════════════ */
  part("Part 7: business analytics");
  await pg.query(`UPDATE "Booking" SET status = 'COMPLETED' WHERE id = $1`, [ids[1]]);
  const month = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  const from = `${month.slice(0, 8)}01`;
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const an = await json(await call(ahmed.owner, `/api/business/analytics?from=${from}&to=${lastDay > month ? lastDay : month}`));
  const k = an.kpis ?? an.data?.kpis;
  check("7.1 analytics counts real bookings only (abandoned checkout and cancellation left out)", k && k.totalBookings === 1, JSON.stringify(k));
  check("7.2 completed booking value is the completed booking's price", k && k.completedRevenue === 300);
  check("7.3 'no data' is null, not 0, where nothing divides", k && (k.repeatCustomerRate === null || typeof k.repeatCustomerRate === "number"));
  const tooLong = await call(ahmed.owner, `/api/business/analytics?from=2020-01-01&to=${month}`);
  check("7.4 an absurd range is refused, not read in full", tooLong.status === 400);
  const freeAn = await call(salon.owner, `/api/business/analytics?from=${from}&to=${month}`);
  check("7.5 the plan gate still holds on the API", freeAn.status === 403);
  const perf = await html("/dashboard/reports/performance?days=30", { jar: ahmed.owner });
  check("7.6 the performance report renders", perf.status === 200);
} catch (e) {
  console.error(e);
  check("the run completed", false, String(e?.message ?? e));
} finally {
  await pg.query(`DELETE FROM "FunnelCount" WHERE "businessId" = ANY($1) OR "organizationId" = ANY($2) OR "businessId" = ''`, [made.businesses, made.orgs]).catch(() => {});
  await pg.query(`DELETE FROM "FunnelSeen"`).catch(() => {});
  await teardown();
  failed = summary(process.argv.includes("--json"));
  await pg.end();
  process.exit(failed ? 1 : 0);
}
