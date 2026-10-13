import { describe, it, expect, vi, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * The app's own auth and API code against a running Maw3ed backend.
 *
 * Not a mock of the server: the requests are real, to whatever
 * MAW3ED_API_URL points at, and the code under test is the app's —
 * lib/api/client.ts, features/auth/token-store.ts, features/auth/api.ts.
 * Only the device-native modules are stood in for, by an in-memory
 * keychain that outlives a simulated restart.
 *
 * Skipped unless MAW3ED_API_URL is set. Point it at a LOCAL server on
 * the QA fixtures (scripts/qa-fixtures.mjs), never production: it signs
 * in with fixture passwords and writes a login code for the customer
 * fixture through the QA database container (MAW3ED_QA_DB, default
 * "maw3ed-qa").
 *
 *   MAW3ED_API_URL=http://localhost:3100 npx vitest run features/auth/auth.integration.test.ts
 */

const API = process.env.MAW3ED_API_URL;
const DB = process.env.MAW3ED_QA_DB ?? "maw3ed-qa";
const PASSWORD = "QaPassword123!";

const keychain = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItemAsync: async (k: string) => keychain.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void keychain.set(k, v),
  deleteItemAsync: async (k: string) => void keychain.delete(k),
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { appEnv: "development", apiUrl: API ?? "http://localhost:0" } } },
}));
vi.mock("expo-device", () => ({ deviceName: "vitest" }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

/** A fresh copy of the app's modules, as after a cold start; the keychain persists. */
async function coldStart() {
  vi.resetModules();
  const client = await import("@/lib/api/client");
  const auth = await import("./api");
  const store = await import("./token-store");
  return { ...client, ...auth, ...store };
}

function sql(q: string) {
  return execFileSync("docker", ["exec", DB, "psql", "-U", "qa", "-d", "maw3ed_qa", "-At", "-c", q], {
    encoding: "utf8",
  }).trim();
}

describe.skipIf(!API)("auth against the real backend", () => {
  beforeAll(() => keychain.clear());

  it("signs an owner in with email and password and keeps the tokens in the keychain", async () => {
    const app = await coldStart();
    const login = await app.loginWithPassword("owner@qa.test", PASSWORD);
    await app.setTokens(login);

    expect(login.user.businessId).toBeTruthy();
    expect(keychain.get("maw3ed.access")).toBe(login.accessToken);
    expect(keychain.get("maw3ed.refresh")).toBe(login.refreshToken);
  });

  it("is still signed in after a restart", async () => {
    const app = await coldStart();
    const me = await app.fetchMe();
    expect(me.businessId).toBeTruthy();
  });

  it("uses the bearer token on the owner's API", async () => {
    const app = await coldStart();
    const bookings = await app.api.get<{ bookings: unknown[] }>("/api/business/bookings");
    expect(Array.isArray(bookings.bookings)).toBe(true);
  });

  it("refreshes an expired access token once and retries", async () => {
    const app = await coldStart();
    keychain.set("maw3ed.access", "expired-or-garbage");

    const me = await app.fetchMe();
    expect(me.id).toBeTruthy();
    // A new access token was stored and works on its own.
    const fresh = keychain.get("maw3ed.access");
    expect(fresh).not.toBe("expired-or-garbage");
    const direct = await fetch(`${API}/api/auth/mobile/me`, { headers: { Authorization: `Bearer ${fresh}` } });
    expect(direct.status).toBe(200);
  });

  it("signs out on the server, so the refresh token stops working", async () => {
    const app = await coldStart();
    const refresh = keychain.get("maw3ed.refresh")!;
    await app.logout(refresh);
    await app.clearTokens();

    const res = await fetch(`${API}/api/auth/mobile/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    expect(res.status).toBe(401);
  });

  it("refuses a wrong password with the server's own message", async () => {
    const app = await coldStart();
    await expect(app.loginWithPassword("owner@qa.test", "wrong")).rejects.toMatchObject({
      kind: "unauthorized",
      message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    });
  });

  it("signs a customer in with a phone code", async () => {
    const app = await coldStart();
    // A clean slate: the server allows one code a minute per number.
    sql(`delete from "LoginCode" where phone='201000000001'`);
    await app.requestPhoneCode("01000000001");
    // The code goes out by WhatsApp; the QA database stands in for the phone.
    const hash = createHash("sha256").update("424242").digest("hex");
    sql(`update "LoginCode" set "codeHash"='${hash}' where phone='201000000001'`);

    const login = await app.loginWithPhoneCode("01000000001", "424242");
    await app.setTokens(login);
    expect(login.user.id).toBeTruthy();
    expect(login.user.adminRole).toBeNull();

    const notifications = await app.api.get<{ notifications: unknown[]; unread: number }>(
      "/api/account/notifications",
    );
    expect(typeof notifications.unread).toBe("number");
  });

  it("refuses a used or wrong code with one message for both", async () => {
    const app = await coldStart();
    // The code was consumed by the sign-in above.
    await expect(app.loginWithPhoneCode("01000000001", "424242")).rejects.toMatchObject({
      kind: "unauthorized",
      message: "الكود غير صحيح أو انتهت صلاحيته",
    });
  });

  it("lets an admin read the admin overview, and nobody else", async () => {
    const app = await coldStart();
    // The customer from the previous test is still signed in.
    await expect(app.api.get("/api/admin/overview")).rejects.toMatchObject({ status: 404 });

    const admin = await app.loginWithPassword("superadmin@qa.test", PASSWORD);
    await app.setTokens(admin);
    const overview = await app.api.get<{ role: string; paidBookings: number | null }>("/api/admin/overview");
    expect(overview.role).toBe("SUPER_ADMIN");
    expect(typeof overview.paidBookings).toBe("number");

    const moderator = await app.loginWithPassword("moderator@qa.test", PASSWORD);
    await app.setTokens(moderator);
    const limited = await app.api.get<{ role: string; paidBookings: number | null }>("/api/admin/overview");
    expect(limited.role).toBe("MODERATOR");
    expect(limited.paidBookings).toBeNull();
  });

  it("announces a session that ends underneath the app, once", async () => {
    const app = await coldStart();
    let ended = 0;
    app.onSessionExpired(() => ended++);
    // A refresh token the server no longer honours.
    await app.logout(keychain.get("maw3ed.refresh")!);
    keychain.set("maw3ed.access", "expired-or-garbage");

    await expect(app.fetchMe()).rejects.toMatchObject({ kind: "unauthorized" });
    expect(ended).toBe(1);
    expect(keychain.get("maw3ed.access")).toBeUndefined();
  });
});
