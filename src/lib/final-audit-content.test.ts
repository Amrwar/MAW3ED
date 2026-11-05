import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PAYMENT_KIND_LABELS, cairoDay } from "./i18n";
import { buildLocalBusinessJsonLd, type LocalBusinessInput } from "./jsonld";
import robots from "@/app/robots";

/**
 * Website content found by the final audit (docs/release/FINAL_BUG_REGISTER.md,
 * F-30 … F-39). Each test fails on the code as it was.
 */

const root = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

describe("F-30 privacy policy names every payment processor", () => {
  const privacy = read("src", "app", "privacy", "page.tsx");
  it("lists Stripe, which takes plan payments, in both languages", () => {
    expect(privacy.match(/<li>Stripe:/g)?.length).toBe(2);
  });
  it("names Paymob too", () => {
    expect(privacy.match(/<li>Paymob:/g)?.length).toBe(2);
  });
});

describe("F-31 payment return pages", () => {
  const booking = read("src", "app", "payment", "return", "page.tsx");
  const plan = read("src", "app", "payment", "subscription", "return", "page.tsx");
  it("read the visitor's language", () => {
    expect(booking).toContain("getLang()");
    expect(plan).toContain("getLang()");
  });
  it("render something for a booking in any other state", () => {
    expect(booking).toMatch(/isOther\s*&&\s*booking/);
  });
  it("no longer call the business page the home page", () => {
    expect(booking).not.toContain("العودة إلى الصفحة الرئيسية");
  });
});

describe("F-32/F-33 receipts in the visitor's language and Cairo's calendar", () => {
  const schema = read("prisma", "schema.prisma");
  const kinds = /enum PaymentKind \{([^}]*)\}/.exec(schema)![1]
    .split("\n")
    .map((l) => /^\s*([A-Z_]+)\b/.exec(l)?.[1])
    .filter((k): k is string => !!k);

  it("labels every payment kind in both languages", () => {
    expect(kinds.length).toBeGreaterThan(0);
    for (const k of kinds) {
      const label = PAYMENT_KIND_LABELS[k as keyof typeof PAYMENT_KIND_LABELS];
      expect(label?.ar, k).toBeTruthy();
      expect(label?.en, k).toBeTruthy();
    }
  });

  it("dates a payment made at 01:30 Cairo time on the Cairo day, not the UTC one", () => {
    // 2026-11-01 23:30 UTC is 2 November 01:30 in Cairo (UTC+2 in November).
    expect(cairoDay("2026-11-01T23:30:00Z", "en")).toBe("2 Nov 2026");
  });

  it("is used by both pages, which no longer format dates without a zone or print Arabic-only kinds", () => {
    for (const page of [read("src", "app", "account", "payments", "page.tsx"), read("src", "app", "dashboard", "billing", "page.tsx")]) {
      expect(page).toContain("cairoDay(");
      expect(page).not.toMatch(/toLocaleDateString\("ar-EG-u-nu-latn"\)/);
      expect(page).not.toContain("KIND_AR[");
    }
  });
});

describe("F-34 the help centre is reachable from the footer", () => {
  it("links /help", () => {
    expect(read("src", "components", "layout", "Footer.tsx")).toMatch(/href:\s*"\/help"/);
  });
});

describe("F-35 errors reach Sentry", () => {
  it("the route boundary reports, and a root boundary exists with its own document", () => {
    expect(read("src", "app", "error.tsx")).toContain("Sentry.captureException");
    expect(existsSync(join(root, "src", "app", "global-error.tsx"))).toBe(true);
    const global = read("src", "app", "global-error.tsx");
    expect(global).toContain("<html");
    expect(global).toContain("Sentry.captureException");
  });
});

interface LdOut {
  name: string;
  alternateName?: string;
  url: string;
  areaServed: string;
  hasOfferCatalog: { name: string; itemListElement: { itemOffered: { name: string } }[] };
}

describe("F-37 structured data in the page's language", () => {
  const input: LocalBusinessInput = {
    slug: "shop",
    nameAr: "محل",
    nameEn: "Shop",
    about: null,
    taglineAr: null,
    phone: null,
    coverImage: null,
    logoImage: null,
    address: null,
    city: { nameAr: "القاهرة", nameEn: "Cairo" },
    category: { nameAr: "صالون", nameEn: "Salon" },
    availability: [],
    services: [{ nameAr: "قص", nameEn: "Haircut", price: 100, currency: "EGP" }],
  };

  it("is English on /en", () => {
    const j = buildLocalBusinessJsonLd({ ...input, lang: "en" }) as unknown as LdOut;
    expect(j.name).toBe("Shop");
    expect(j.alternateName).toBe("محل");
    expect(j.url).toMatch(/\/en\/company\/shop$/);
    expect(j.areaServed).toBe("Cairo");
    expect(j.hasOfferCatalog.name).toBe("Salon");
    expect(j.hasOfferCatalog.itemListElement[0].itemOffered.name).toBe("Haircut");
  });

  it("stays Arabic by default", () => {
    const j = buildLocalBusinessJsonLd(input) as unknown as LdOut;
    expect(j.name).toBe("محل");
    expect(j.alternateName).toBe("Shop");
    expect(j.url).toMatch(/\/company\/shop$/);
    expect(j.url).not.toContain("/en/");
    expect(j.hasOfferCatalog.itemListElement[0].itemOffered.name).toBe("قص");
  });
});

describe("F-38 the renewal email opens the subscription tab", () => {
  it("links ?tab=subscription", () => {
    expect(read("src", "lib", "notifications", "dispatch.ts")).toContain('renewUrl: siteUrl("/dashboard/settings?tab=subscription")');
  });
});

describe("F-39 private consoles", () => {
  it("are kept from crawlers, in both languages", () => {
    const rules = robots().rules;
    const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow as string[];
    for (const p of ["/org-admin/", "/venue-admin/", "/en/org-admin/", "/en/venue-admin/", "/en/dashboard/", "/en/account/"]) {
      expect(disallow, p).toContain(p);
    }
  });
  it("venue statuses are shown as words", () => {
    expect(read("src", "app", "venue-admin", "page.tsx")).not.toMatch(/\{v\.status\}/);
  });
});
