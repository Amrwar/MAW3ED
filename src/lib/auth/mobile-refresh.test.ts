import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A one-row MobileSession table. updateMany and deleteMany are atomic,
 * as a single SQL statement is; findUnique yields first so concurrent
 * refreshes interleave the way parallel requests would.
 */
interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  refreshGeneration: number;
  rotatedAt: Date | null;
  lastUsedAt: Date;
}
let session: Session | null = null;
/** The database before add_mobile_refresh_rotation.sql: asking for its columns fails. */
let columnsMissing = false;
const tick = () => new Promise((r) => setTimeout(r, 0));

vi.mock("@/lib/db", () => ({
  db: {
    mobileSession: {
      findUnique: async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
        if (columnsMissing && select?.refreshGeneration) {
          throw Object.assign(new Error("column does not exist"), { code: "P2022" });
        }
        const snapshot = session && session.id === where.id ? { ...session } : null;
        await tick();
        return snapshot;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; refreshGeneration?: number };
        data: { refreshGeneration?: { increment: number }; rotatedAt?: Date; lastUsedAt?: Date };
      }) => {
        if (!session || session.id !== where.id) return { count: 0 };
        if (where.refreshGeneration !== undefined && session.refreshGeneration !== where.refreshGeneration) {
          return { count: 0 };
        }
        if (data.refreshGeneration) session.refreshGeneration += data.refreshGeneration.increment;
        if (data.rotatedAt) session.rotatedAt = data.rotatedAt;
        if (data.lastUsedAt) session.lastUsedAt = data.lastUsedAt;
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        if (!session || session.id !== where.id) return { count: 0 };
        session = null;
        return { count: 1 };
      },
    },
  },
}));
vi.mock("@/lib/logger", () => ({ log: { warn: () => undefined, info: () => undefined, error: () => undefined } }));

process.env.AUTH_SECRET = "test-secret-for-refresh-rotation-only";

import { readRefreshToken, issueTokens, claimsForUser } from "./mobile-token";
import { REFRESH_GRACE_MS, rotateRefresh } from "./mobile-refresh";

vi.mock("./mobile-token", async (importOriginal) => {
  const real = await importOriginal<typeof import("./mobile-token")>();
  return {
    ...real,
    claimsForUser: vi.fn(async (id: string) => ({ sub: id, businessId: null, adminRole: null })),
  };
});

const CLAIMS = { sub: "u1", businessId: null, adminRole: null };

async function refresh(token: string, now = new Date()) {
  const read = await readRefreshToken(token);
  if (!read) throw new Error("unreadable token");
  return rotateRefresh(read, now);
}

describe("refresh token rotation", () => {
  beforeEach(() => {
    session = {
      id: "s1",
      userId: "u1",
      expiresAt: new Date(Date.now() + 86_400_000),
      refreshGeneration: 0,
      rotatedAt: null,
      lastUsedAt: new Date(),
    };
    vi.mocked(claimsForUser).mockClear();
    columnsMissing = false;
  });

  it("rotates on every refresh and the new token works", async () => {
    const { refreshToken: t0 } = await issueTokens(CLAIMS, "s1", 0);
    const r1 = await refresh(t0);
    if (!r1.ok) throw new Error("first refresh failed");
    expect(session?.refreshGeneration).toBe(1);

    const r2 = await refresh(r1.tokens.refreshToken);
    expect(r2.ok).toBe(true);
    expect(session?.refreshGeneration).toBe(2);
  });

  it("revokes the session when a spent token comes back after the grace", async () => {
    const { refreshToken: t0 } = await issueTokens(CLAIMS, "s1", 0);
    const r1 = await refresh(t0);
    if (!r1.ok) throw new Error("first refresh failed");
    await refresh(r1.tokens.refreshToken);

    // Two generations behind: never within grace.
    expect(await refresh(t0)).toEqual({ ok: false, reason: "reused" });
    expect(session).toBeNull();
  });

  it("revokes when the previous token is replayed once the grace has passed", async () => {
    const { refreshToken: t0 } = await issueTokens(CLAIMS, "s1", 0);
    const start = new Date();
    expect((await refresh(t0, start)).ok).toBe(true);

    const later = new Date(start.getTime() + REFRESH_GRACE_MS + 1);
    expect(await refresh(t0, later)).toEqual({ ok: false, reason: "reused" });
    expect(session).toBeNull();
  });

  it("honours the previous token inside the grace, for a response lost in transit", async () => {
    const { refreshToken: t0 } = await issueTokens(CLAIMS, "s1", 0);
    const start = new Date();
    expect((await refresh(t0, start)).ok).toBe(true);

    const retry = await refresh(t0, new Date(start.getTime() + 5_000));
    if (!retry.ok) throw new Error("retry inside grace failed");
    // Re-issued at the live generation, not advanced again.
    expect(session?.refreshGeneration).toBe(1);
    expect((await readRefreshToken(retry.tokens.refreshToken))?.generation).toBe(1);
  });

  it("lets only one of two concurrent refreshes advance the generation", async () => {
    const { refreshToken: t0 } = await issueTokens(CLAIMS, "s1", 0);
    const [a, b] = await Promise.all([refresh(t0), refresh(t0)]);
    expect(a.ok && b.ok).toBe(true);
    expect(session?.refreshGeneration).toBe(1);
  });

  it("accepts a token from before rotation existed once, then rotates it", async () => {
    // Pre-rotation tokens carried no `gen` claim at all.
    const { SignJWT } = await import("jose");
    const now = Math.floor(Date.now() / 1000);
    const legacy = await new SignJWT({ sid: "s1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuer("maw3ed")
      .setAudience("maw3ed-mobile-refresh")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));

    expect((await readRefreshToken(legacy))?.generation).toBe(0);
    const start = new Date();
    expect((await refresh(legacy, start)).ok).toBe(true);
    expect(session?.refreshGeneration).toBe(1);
    expect(await refresh(legacy, new Date(start.getTime() + REFRESH_GRACE_MS + 1))).toEqual({
      ok: false,
      reason: "reused",
    });
  });

  it("refuses a token for a session that has been revoked or has expired", async () => {
    const { refreshToken } = await issueTokens(CLAIMS, "s1", 0);
    session!.expiresAt = new Date(Date.now() - 1);
    expect(await refresh(refreshToken)).toEqual({ ok: false, reason: "no-session" });
  });

  it("keeps refreshing, without rotating, when the migration has not run yet", async () => {
    // Deployed before the column exists: failing here would sign every
    // app user out within one access-token lifetime.
    columnsMissing = true;
    const { refreshToken } = await issueTokens(CLAIMS, "s1", 0);
    const first = await refresh(refreshToken);
    expect(first.ok).toBe(true);
    expect((await refresh(refreshToken)).ok).toBe(true);
    expect(session?.refreshGeneration).toBe(0);
  });
});
