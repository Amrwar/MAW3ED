import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Layout and focus rules found by driving the site on emulated phones
 * (WebKit for iPhone, Chromium for Android) in Arabic and English.
 *
 * Each of these was a real defect on a phone that no unit test saw,
 * because the cause was in how a component is put together rather than
 * in what it computes. The tests hold the construction. The browser
 * check that found them is scripts/qa-responsive.mjs.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("Modal", () => {
  const source = read("src/components/ui/Modal.tsx");

  // Callers pass `onClose={() => setOpen(false)}`, a new function every
  // render. With it as a dependency, every re-render of the page behind
  // an open filter sheet re-ran setup: focus went back to the opener,
  // then to the close button. On a phone, Enter in the price box closed
  // the keyboard and parked focus on "Close".
  it("sets up once per opening, not once per parent render", () => {
    expect(source).toMatch(/\},\s*\[open\]\);/);
    expect(source).not.toMatch(/\[open,\s*onClose\]/);
  });

  it("reads onClose through a ref so Escape still uses the latest one", () => {
    expect(source).toContain("onCloseRef.current()");
  });
});

describe("the price filter", () => {
  const source = read("src/app/businesses/_components/FilterPanel.tsx");

  // key={value} remounted the input on every commit, and a remounted
  // input has lost focus.
  it("does not remount its input when the committed value changes", () => {
    expect(source).not.toMatch(/key=\{String\(value\)\}/);
  });
});

describe("Table", () => {
  const source = read("src/components/ui/Table.tsx");

  // An sr-only label in an actions column is absolutely positioned. It
  // is clipped by this scroll box only if the box is its containing
  // block; otherwise it widened the page — /dashboard/branches was 549px
  // wide on a 375px phone in Arabic.
  it("scroll box is also the containing block for positioned content", () => {
    const wrapper = source.match(/className=\{cn\(\s*"([^"]+)"/)?.[1] ?? "";
    expect(wrapper.split(" ")).toEqual(expect.arrayContaining(["relative", "overflow-x-auto"]));
  });

  // A box that scrolls must be reachable by keyboard (WCAG 2.1.1).
  it("scroll box can take keyboard focus", () => {
    expect(source).toMatch(/tabIndex=\{0\}/);
  });
});

describe("the booking date strip", () => {
  const source = read("src/features/company/BookingWidget.tsx");
  const short = source.match(/const AR_DAYS_SHORT = \[([\s\S]*?)\];/)?.[1] ?? "";
  const days = [...short.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  // Three characters of الأحد and الأربعاء are both "الأ".
  it("labels all seven weekdays distinctly", () => {
    expect(days).toHaveLength(7);
    expect(new Set(days).size).toBe(7);
  });

  it("does not cut day names to a prefix", () => {
    expect(source).not.toMatch(/dayAr\.slice\(/);
  });

  it("gives each day button its full date as an accessible name", () => {
    expect(source).toMatch(/aria-label=\{formatDateAr\(d\.iso\)\}/);
  });
});

describe("rescheduling", () => {
  const source = read("src/app/booking/[token]/_components/RescheduleFlow.tsx");

  // The booking keeps its staff, resource and branch; slots fetched
  // without them included times the server then refused with 409.
  // The flow now asks the booking's own slots endpoint, which reads all
  // three from the booking itself (and leaves the booking out).
  it("asks for slots for the booking's own staff, resource and branch", () => {
    expect(source).toContain("/api/public/booking/${token}/slots");
    const route = read("src/app/api/public/booking/[token]/slots/route.ts");
    for (const key of [
      "staffMemberId: booking.staffMemberId",
      "resourceId: booking.resourceId",
      "branchId: booking.branchId",
      "excludeBookingId: booking.id",
    ]) {
      expect(route).toContain(key);
    }
  });
});

describe("the sticky booking bar", () => {
  const page = read("src/app/company/[slug]/page.tsx");

  // Once the visitor is in the widget the bar only covers the form — a
  // fifth of the screen on a phone held sideways.
  it("stands aside while the booking widget is on screen", () => {
    expect(page).toMatch(/watchIds=\{\[[^\]]*"booking"[^\]]*\]\}/);
  });
});

describe("the booking page", () => {
  const source = read("src/app/booking/[token]/page.tsx");

  // A missing status was a 500 for exactly the customers whose payment
  // had failed. The type now refuses an incomplete map.
  it("maps every booking status", () => {
    expect(source).toMatch(/satisfies Record<BookingStatus,/);
  });

  // The account pages link to these sections.
  it("has the sections the account pages link to", () => {
    for (const id of ["review", "reschedule", "cancel"]) {
      expect(source).toContain(`id="${id}"`);
    }
  });

  // <Logo> is itself a link; wrapping it in another was invalid HTML and
  // threw away the server render on every load.
  it("does not nest the logo link inside another link", () => {
    expect(source).not.toMatch(/<Link[^>]*>\s*<Logo/);
  });
});

describe("the dashboard's mobile menu", () => {
  const source = read("src/components/dashboard/DashboardHeader.tsx");

  // Closed, it is only translated off-screen; without inert its links
  // were 25 invisible tab stops ahead of the page.
  it("is inert while closed", () => {
    expect(source).toMatch(/inert=\{!mobileOpen\}/);
  });

  // The drawer is white; these are the dark sidebar's colours.
  it("does not use the dark sidebar's link colour on a white drawer", () => {
    expect(source).not.toMatch(/text-\[#BACBC4\]/i);
  });

  it("follows the page's direction rather than forcing RTL", () => {
    expect(source).not.toMatch(/\n\s*dir="rtl"\n\s*>/);
  });
});

describe("image upload controls", () => {
  const source = read("src/components/shared/ImageUpload.tsx");

  // Hover-only controls do not exist on a touch screen.
  it("are visible without hover", () => {
    expect(source).toContain("[@media(hover:none)]:opacity-100");
    expect(source).toContain("focus-within:opacity-100");
  });
});

describe("the profile's section tabs", () => {
  const source = read("src/features/company/ProfileNav.tsx");

  // scrollIntoView scrolls the window as well as the bar: the profile
  // jumped ~120px on load and the first Tab skipped the header.
  it("scroll only their own bar", () => {
    expect(source).not.toMatch(/scrollIntoView\(/);
  });
});

describe("the account's booking cards", () => {
  const card = read("src/app/account/_components/AccountBookingCard.tsx");
  const queries = read("src/lib/account/queries.ts");

  // They offered reschedule and cancel on every upcoming booking; inside
  // the two-hour window the link led to a page without either.
  it("offer reschedule and cancel only when the booking page will", () => {
    expect(queries).toMatch(/canChange: customerMayChange\(/);
    expect(card.match(/b\.canChange &&/g)?.length).toBe(2);
  });
});
