import { describe, expect, it, vi } from "vitest";

import { ApiError, NetworkError, UnauthorizedError } from "@/lib/api/errors";
import type { PublicProfile, PublicResource, PublicStaffMember } from "@/types/api";
import {
  EMPTY_DRAFT,
  canAdvance,
  change,
  depositPreviewCents,
  describeFailure,
  fingerprint,
  firstOpenStep,
  keepsKey,
  mightBeOpen,
  reconcile,
  requestBody,
  stepsFor,
  type Draft,
} from "./flow";
import { notificationLines, outcomeOf, shouldPoll } from "./outcome";

// Hoisted by vitest above the imports; written here to keep imports first.
vi.mock("@/lib/config", () => ({ config: { apiUrl: "https://maw3ed.net" } }));

const hours = [0, 1, 2, 3, 4, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "17:00", isClosed: false }))
  .concat([{ dayOfWeek: 5, openTime: "00:00", closeTime: "00:00", isClosed: true }]);

const member = (id: string, serviceIds: string[] = []): PublicStaffMember => ({
  id,
  nameAr: id,
  nameEn: id,
  role: null,
  photo: null,
  specialties: [],
  serviceIds,
  hours: [],
  nextSlot: null,
});

const table = (id: string, capacity: number | null, branchId: string | null = null): PublicResource => ({
  id,
  kind: "TABLE",
  name: id,
  capacity,
  area: null,
  branchId,
});

type P = Parameters<typeof stepsFor>[0];

function biz(over: Partial<P> = {}): P {
  return {
    services: [
      { id: "s1", nameAr: "قص", nameEn: "Cut", descriptionAr: null, durationMinutes: 30, price: 200, currency: "EGP" },
      { id: "s2", nameAr: "صبغة", nameEn: "Colour", descriptionAr: null, durationMinutes: 60, price: 500, currency: "EGP" },
    ],
    staff: [],
    branches: [],
    resources: [],
    businessType: "GENERAL",
    category: { slug: "salons", nameAr: "", nameEn: "", parentSlug: null },
    policies: { depositPercent: null, minNoticeMinutes: 0, maxAdvanceDays: 30, sameDayCutoff: null, changeCutoffHours: 2 },
    hours,
    ...over,
  } as P;
}

const draft = (over: Partial<Draft> = {}): Draft => ({ ...EMPTY_DRAFT, ...over });

describe("which steps a business asks", () => {
  it("asks only service, time, details and summary when there is nothing else to choose", () => {
    expect(stepsFor(biz(), draft({ serviceId: "s1" }))).toEqual(["service", "when", "details", "summary"]);
  });

  it("asks for a person only when somebody performs the chosen service", () => {
    const p = biz({ staff: [member("a", ["s2"])] });
    expect(stepsFor(p, draft({ serviceId: "s1" }))).not.toContain("staff");
    expect(stepsFor(p, draft({ serviceId: "s2" }))).toContain("staff");
  });

  it("treats a person linked to no services as doing all of them", () => {
    expect(stepsFor(biz({ staff: [member("a")] }), draft({ serviceId: "s1" }))).toContain("staff");
  });

  it("never asks a restaurant about staff", () => {
    const p = biz({ businessType: "RESTAURANT", staff: [member("a")], resources: [table("t1", 4)] });
    expect(stepsFor(p, draft({ serviceId: "s1" }))).toEqual(["service", "resource", "when", "details", "summary"]);
  });

  it("asks for a branch only when there are two or more, before the table", () => {
    const one = biz({ branches: [{ id: "b1", nameAr: "", nameEn: null, address: null, phone: null, location: null }], resources: [table("t", 2)] });
    expect(stepsFor(one, draft())).not.toContain("branch");
    const two = biz({
      branches: [
        { id: "b1", nameAr: "", nameEn: null, address: null, phone: null, location: null },
        { id: "b2", nameAr: "", nameEn: null, address: null, phone: null, location: null },
      ],
      resources: [table("t", 2, "b1")],
    });
    const s = stepsFor(two, draft({ branchId: "b1" }));
    expect(s.indexOf("branch")).toBeLessThan(s.indexOf("resource"));
    // The other branch has no tables of its own, so no table step there.
    expect(stepsFor(two, draft({ branchId: "b2" }))).not.toContain("resource");
  });
});

describe("answers", () => {
  it("allows 'anyone' but requires a table once tables exist", () => {
    const p = biz({ staff: [member("a")], resources: [table("t1", 2)] });
    expect(canAdvance(p, draft({ serviceId: "s1" }), "staff")).toBe(true);
    expect(canAdvance(p, draft({ serviceId: "s1" }), "resource")).toBe(false);
    expect(canAdvance(p, draft({ serviceId: "s1", resourceId: "t1" }), "resource")).toBe(true);
  });

  it("refuses a table too small for the party", () => {
    const p = biz({ resources: [table("t1", 2)] });
    expect(canAdvance(p, draft({ resourceId: "t1", partySize: 3 }), "resource")).toBe(false);
  });

  it("clears the time when anything that shapes availability changes", () => {
    const p = biz({ staff: [member("a"), member("b")] });
    const d = draft({ serviceId: "s1", staffId: "a", date: "2026-10-20", time: "10:00" });
    expect(change(p, d, { staffId: "b" }).time).toBeNull();
    expect(change(p, d, { date: "2026-10-21" }).time).toBeNull();
    expect(change(p, d, { serviceId: "s2" }).time).toBeNull();
    // Typing a name changes nothing about availability.
    expect(change(p, d, { name: "Mona" }).time).toBe("10:00");
  });

  it("drops a person who does not perform the newly chosen service", () => {
    const p = biz({ staff: [member("a", ["s1"])] });
    expect(change(p, draft({ serviceId: "s1", staffId: "a" }), { serviceId: "s2" }).staffId).toBeNull();
  });

  it("opens a preselected service on the first question still unanswered", () => {
    const p = biz({ resources: [table("t1", 4)] });
    expect(firstOpenStep(p, draft({ serviceId: "s1" }))).toBe("resource");
  });
});

describe("a restored draft", () => {
  it("forgets what no longer exists and a day that has passed", () => {
    const p = biz();
    const d = reconcile(p, draft({ serviceId: "gone", date: "2020-01-01", time: "10:00", step: "summary" }), "2026-10-13");
    expect(d.serviceId).toBeNull();
    expect(d.date).toBeNull();
    expect(d.step).toBe("service");
  });

  it("never reopens on the summary with an answer missing", () => {
    const d = reconcile(biz(), draft({ serviceId: "s1", date: "2026-10-20", time: null, step: "summary" }), "2026-10-13");
    expect(d.step).toBe("when");
  });
});

describe("days", () => {
  it("greys out a weekday the business is closed, and trusts the server otherwise", () => {
    // 2026-10-16 is a Friday.
    expect(mightBeOpen("2026-10-16", hours, null)).toBe(false);
    expect(mightBeOpen("2026-10-17", hours, null)).toBe(true);
    expect(mightBeOpen("2026-10-16", [], null)).toBe(true);
  });
});

describe("money", () => {
  it("previews the deposit the way the server charges it", () => {
    // money.ts: ceil(total * percent / 100) in piastres.
    expect(depositPreviewCents(33_333, 30)).toBe(10_000);
    expect(depositPreviewCents(20_000, null)).toBeNull();
    expect(depositPreviewCents(0, 30)).toBeNull();
  });
});

describe("submitting", () => {
  it("sends party size only for a table that counts seats", () => {
    const p = biz({ resources: [table("t1", 4), table("t2", null)] });
    const base = draft({ serviceId: "s1", date: "2026-10-20", time: "10:00", name: "Mona", partySize: 3 });
    expect(requestBody(p, { ...base, resourceId: "t1" }, "201000000000", null)?.partySize).toBe(3);
    expect(requestBody(p, { ...base, resourceId: "t2" }, "201000000000", null)?.partySize).toBeUndefined();
  });

  it("gives the same body the same fingerprint, and a different time a different one", () => {
    const p = biz();
    const d = draft({ serviceId: "s1", date: "2026-10-20", time: "10:00", name: "Mona" });
    const a = requestBody(p, d, "201000000000", null)!;
    expect(fingerprint(a)).toBe(fingerprint({ ...a }));
    expect(fingerprint(a)).not.toBe(fingerprint(requestBody(p, { ...d, time: "10:30" }, "201000000000", null)!));
  });

  it("keeps the key only for a failure that may have succeeded", () => {
    const network = describeFailure(new NetworkError(), "en");
    expect(keepsKey(network.recovery, network.code)).toBe(true);
    const taken = describeFailure(new ApiError(409, "x", { code: "slot-taken" }), "en");
    expect(taken.recovery).toBe("pick-time");
    expect(keepsKey(taken.recovery, taken.code)).toBe(false);
    const pay = describeFailure(new ApiError(502, "x", { code: "payment-unavailable" }), "en");
    expect(keepsKey(pay.recovery, pay.code)).toBe(false);
  });

  it("words every failure in both languages", () => {
    for (const e of [
      new NetworkError(),
      new UnauthorizedError(),
      new ApiError(409, "حد تاني", { code: "slot-taken" }),
      new ApiError(409, "x", { code: "slot-unavailable", reason: "holiday" }),
      new ApiError(429, "x", { code: "limit-reached" }),
      new ApiError(500, "حدث خطأ"),
    ]) {
      const en = describeFailure(e, "en");
      const ar = describeFailure(e, "ar");
      expect(en.title).toMatch(/[a-z]/i);
      expect(ar.title).toMatch(/[؀-ۿ]/);
      // English never shows the server's Arabic sentence.
      expect(en.body).not.toMatch(/[؀-ۿ]/);
    }
  });
});

describe("what the result screen may say", () => {
  it("calls only CONFIRMED (and later) confirmed", () => {
    expect(outcomeOf("CONFIRMED")).toBe("confirmed");
    expect(outcomeOf("PENDING")).toBe("awaiting-business");
    expect(outcomeOf("PENDING_PAYMENT")).toBe("awaiting-payment");
    expect(outcomeOf("FAILED_PAYMENT")).toBe("payment-failed");
  });

  it("polls only while a payment is being confirmed", () => {
    expect(shouldPoll("PENDING_PAYMENT")).toBe(true);
    expect(shouldPoll("CONFIRMED")).toBe(false);
  });

  it("reports only deliveries the server recorded, and never a skip", () => {
    const lines = notificationLines(
      [
        { channel: "WHATSAPP", status: "SENT" },
        { channel: "EMAIL", status: "SKIPPED" },
        { channel: "PUSH", status: "FAILED" },
      ],
      "en",
    );
    expect(lines).toEqual([
      { label: "WhatsApp — sent", ok: true },
      { label: "Push notification — not delivered", ok: false },
    ]);
  });
});

// Typecheck only: the profile fixture satisfies the shape the screens pass.
export const _p: Pick<PublicProfile, "services"> = biz();
