import { describe, it, expect } from "vitest";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { REPORT_REASONS, reportErrorMessage, reportPath } from "./report";

describe("review reports", () => {
  it("offers exactly the reasons the server accepts", () => {
    // src/app/api/public/reviews/[id]/report/route.ts
    expect(REPORT_REASONS.map((r) => r.value).sort()).toEqual(["FAKE", "HARASSMENT", "INAPPROPRIATE", "OTHER", "SPAM"]);
    for (const r of REPORT_REASONS) {
      expect(r.ar.length).toBeGreaterThan(0);
      expect(r.en.length).toBeGreaterThan(0);
    }
  });

  it("builds the endpoint with the id escaped", () => {
    expect(reportPath("abc")).toBe("/api/public/reviews/abc/report");
    expect(reportPath("a/b")).toBe("/api/public/reviews/a%2Fb/report");
  });

  it("explains the daily limit in both languages", () => {
    const e = new ApiError(429, "وصلت للحد الأقصى من البلاغات النهارده");
    expect(reportErrorMessage(e, "ar")).toBe("وصلت للحد الأقصى من البلاغات النهارده");
    expect(reportErrorMessage(e, "en")).toMatch(/limit/);
  });

  it("falls back to a generic message", () => {
    expect(reportErrorMessage(new Error("x"), "en")).toMatch(/Couldn't send/);
    expect(reportErrorMessage(new ApiError(500, "حدث خطأ"), "ar")).toBe("حدث خطأ");
    expect(reportErrorMessage(new NetworkError(), "en")).toMatch(/connection/);
  });
});
