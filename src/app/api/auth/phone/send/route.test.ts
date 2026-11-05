import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in code route answers in the page's language: an English
 * page (/en/account-login) showed "معرفناش نبعت الكود دلوقتي…" when the
 * send failed. err() words it from the language the proxy resolved;
 * the WhatsApp free text follows it too. Nothing is sent for real.
 */

const state = vi.hoisted(() => ({ lang: null as string | null }));
const { sendCode, createLoginCode, rateLimit } = vi.hoisted(() => ({
  sendCode: vi.fn(),
  createLoginCode: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers(state.lang ? { "x-maw3ed-lang": state.lang } : {})),
  cookies: () => Promise.resolve({ get: () => undefined }),
}));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/auth/mobile-token", () => ({ readAccessToken: async () => null }));
vi.mock("@/lib/organizations/delegation", () => ({ isActingElsewhere: async () => false }));
vi.mock("@/lib/auth/login-code", () => ({ createLoginCode }));
vi.mock("@/lib/auth/send-code", () => ({ sendCode }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  rateLimit,
}));
vi.mock("@/lib/logger", () => ({ log: { error: () => undefined, warn: () => undefined, info: () => undefined } }));

import { POST } from "./route";
import { requireSession } from "@/lib/api";

const send = (body: unknown, search = "") =>
  POST(
    new Request(`http://x/api/auth/phone/send${search}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  state.lang = null;
  sendCode.mockReset();
  createLoginCode.mockReset();
  rateLimit.mockReset();
  rateLimit.mockResolvedValue({ ok: true });
  createLoginCode.mockResolvedValue({ ok: true, phone: "+201000000000", code: "123456" });
  sendCode.mockResolvedValue({ ok: false, reason: "not-configured" });
});

describe("POST /api/auth/phone/send — a failed send", () => {
  it("answers 503 send-failed in English for an English request", async () => {
    state.lang = "en";
    const res = await send({ phone: "01000000000" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      code: "send-failed",
      error: "We couldn't send the code right now. Try again in a little while.",
    });
  });

  it("still answers in Arabic by default", async () => {
    const res = await send({ phone: "01000000000" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "send-failed", error: "معرفناش نبعت الكود دلوقتي. جرّب تاني بعد شوية." });
  });
});

describe("POST /api/auth/phone/send — other refusals in English", () => {
  beforeEach(() => {
    state.lang = "en";
  });

  it("an empty number", async () => {
    const res = await send({});
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Enter your mobile number.");
  });

  it("an invalid number", async () => {
    createLoginCode.mockResolvedValue({ ok: false, reason: "invalid-phone" });
    const res = await send({ phone: "12" });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/^That mobile number isn't valid\. Include the country code/);
  });

  it("the cooldown", async () => {
    createLoginCode.mockResolvedValue({ ok: false, reason: "cooldown" });
    const res = await send({ phone: "01000000000" });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("Wait a minute before asking for a new code.");
  });

  it("the rate limiter", async () => {
    rateLimit.mockResolvedValue({ ok: false, retryAfter: 60 });
    const res = await send({ phone: "01000000000" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ code: "rate-limited", error: "Too many attempts. Wait a little and try again." });
  });
});

describe("POST /api/auth/phone/send — the WhatsApp free text", () => {
  beforeEach(() => {
    sendCode.mockResolvedValue({ ok: true });
  });

  it("is English for an English request, for sign-in and for a booking", async () => {
    state.lang = "en";
    expect((await send({ phone: "01000000000" })).status).toBe(200);
    expect(sendCode.mock.calls[0][2]).toMatch(/^Your Maw3ed sign-in code: 123456\n\nThe code is valid for 10 minutes\./);
    await send({ phone: "01000000000", purpose: "booking" });
    expect(sendCode.mock.calls[1][2]).toMatch(/^Your Maw3ed booking confirmation code: 123456/);
  });

  it("is English for ?lang=en, as the app asks", async () => {
    await send({ phone: "01000000000" }, "?lang=en");
    expect(sendCode.mock.calls[0][2]).toMatch(/^Your Maw3ed sign-in code/);
  });

  it("stays Arabic by default", async () => {
    await send({ phone: "01000000000" });
    expect(sendCode.mock.calls[0][2]).toMatch(/^كود الدخول على موعد: 123456/);
  });
});

describe("requireSession", () => {
  it("refuses a signed-out English request in English, Arabic otherwise", async () => {
    state.lang = "en";
    const en = await requireSession().catch((e: unknown) => e);
    expect(en).toBeInstanceOf(Response);
    expect((en as Response).status).toBe(401);
    expect(await (en as Response).json()).toEqual({ error: "Please sign in first." });

    state.lang = null;
    const ar = (await requireSession().catch((e: unknown) => e)) as Response;
    expect(await ar.json()).toEqual({ error: "سجّل دخولك الأول" });
  });
});
