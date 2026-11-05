import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * How err() and the other shared refusals pick their language: the
 * header the proxy sets (x-maw3ed-lang), the cookie where the proxy did
 * not run, ?lang= on a request passed in, Arabic otherwise — and Arabic,
 * never a crash, outside a request.
 */

const state = vi.hoisted(() => ({
  header: null as string | null,
  cookie: undefined as string | undefined,
  outsideRequest: false,
}));

vi.mock("next/headers", () => ({
  headers: () => {
    if (state.outsideRequest) throw new Error("`headers` was called outside a request scope");
    return Promise.resolve(new Headers(state.header ? { "x-maw3ed-lang": state.header } : {}));
  },
  cookies: () =>
    Promise.resolve({ get: (name: string) => (name === "maw3ed-lang" && state.cookie ? { value: state.cookie } : undefined) }),
}));

import { errorResponse, localText, requestLang } from "./api-lang";
import { tooManyRequests } from "./rate-limit";

beforeEach(() => {
  state.header = null;
  state.cookie = undefined;
  state.outsideRequest = false;
});

describe("requestLang", () => {
  it("is Arabic by default", async () => {
    expect(await requestLang()).toBe("ar");
  });

  it("follows the header the proxy resolved", async () => {
    state.header = "en";
    expect(await requestLang()).toBe("en");
    state.header = "ar";
    state.cookie = "en";
    expect(await requestLang()).toBe("ar");
  });

  it("falls back to the saved choice where the proxy did not run", async () => {
    state.cookie = "en";
    expect(await requestLang()).toBe("en");
  });

  it("reads ?lang= on a request it is given, ahead of the header", async () => {
    expect(await requestLang(new Request("http://x/api/y?lang=en"))).toBe("en");
    state.header = "en";
    expect(await requestLang(new Request("http://x/api/y?lang=ar"))).toBe("ar");
    expect(await requestLang(new Request("http://x/api/y"))).toBe("en");
  });

  it("is Arabic outside a request, without throwing", async () => {
    state.outsideRequest = true;
    expect(await requestLang()).toBe("ar");
  });
});

describe("errorResponse", () => {
  it("keeps the Arabic and the shape for an Arabic request", async () => {
    const res = errorResponse({ error: "سجّل دخولك الأول", code: "x" }, 401);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toEqual({ error: "سجّل دخولك الأول", code: "x" });
  });

  it("answers in English for an English request, keeping the other fields", async () => {
    state.header = "en";
    const res = errorResponse({ error: "سجّل دخولك الأول", code: "x" }, 401);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Please sign in first.", code: "x" });
  });

  it("never sends Arabic to an English request, even for a sentence it does not know", async () => {
    state.header = "en";
    const res = errorResponse({ error: "جملة لسه محدش ترجمها" }, 404);
    expect((await res.json()).error).toBe("We couldn't find that.");
  });

  it("passes an English message through untouched", async () => {
    state.header = "ar";
    const res = errorResponse({ error: "Booking not found" }, 404);
    expect((await res.json()).error).toBe("Booking not found");
  });

  it("is Arabic outside a request", async () => {
    state.outsideRequest = true;
    expect((await errorResponse({ error: "غير موجود" }, 404).json()).error).toBe("غير موجود");
  });
});

describe("localText", () => {
  it("translates a message for a response body", async () => {
    expect(await localText("الكود ده انتهت صلاحيته")).toBe("الكود ده انتهت صلاحيته");
    state.header = "en";
    expect(await localText("الكود ده انتهت صلاحيته")).toBe("This code has expired.");
  });
});

describe("tooManyRequests", () => {
  it("keeps Retry-After and the code, in the request's language", async () => {
    const ar = tooManyRequests({ ok: false, retryAfter: 30 } as Parameters<typeof tooManyRequests>[0]);
    expect(ar.status).toBe(429);
    expect(ar.headers.get("retry-after")).toBe("30");
    expect(await ar.json()).toEqual({ error: "محاولات كتير. استنى شوية وحاول تاني.", code: "rate-limited" });

    state.header = "en";
    const en = tooManyRequests({ ok: false, retryAfter: 30 } as Parameters<typeof tooManyRequests>[0]);
    expect(en.headers.get("retry-after")).toBe("30");
    expect(await en.json()).toEqual({ error: "Too many attempts. Wait a little and try again.", code: "rate-limited" });
  });
});
