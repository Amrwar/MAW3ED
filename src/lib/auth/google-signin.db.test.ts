import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * The pre-registered account, on a real Postgres (lib/auth/google-signin.ts,
 * rule 3). Somebody signs up with a victim's address and a password of
 * their own and never verifies it; the victim's first "Continue with
 * Google" must not leave that password working. An account whose owner
 * verified the address is linked as it is.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/auth/google-signin.db.test.ts
 *
 * Only the browser's cookies are faked (nobody is signed in). Everything
 * created is tagged gsign- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

vi.mock("@/lib/auth/oauth-guard", () => ({
  sessionCookieUser: async () => null,
  signInDestination: async () => null,
}));

describe.skipIf(!local)("Google meets an account pre-registered under its address", () => {
  let db: PrismaClient;
  let decideGoogleSignIn: typeof import("./google-signin").decideGoogleSignIn;
  const tag = `gsign-${Date.now()}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ decideGoogleSignIn } = await import("./google-signin"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
  });

  it("disarms one whose address was never verified: password gone, web and app sessions ended", async () => {
    const email = `${tag}-squat@example.test`;
    const squatted = await db.user.create({
      data: {
        email,
        password: "$2a$10$abcdefghijklmnopqrstuuJ6d3S6sDq6qH8bDqk1rXyQe4r9eW1uK",
        mobileSessions: { create: { expiresAt: new Date(Date.now() + 86_400_000) } },
      },
    });
    const before = Date.now();

    expect(await decideGoogleSignIn({ providerAccountId: `${tag}-g1` }, { email: email.toUpperCase(), email_verified: true })).toBe(true);

    const after = await db.user.findUniqueOrThrow({ where: { id: squatted.id } });
    expect(after.password).toBeNull();
    expect(after.sessionsRevokedAt!.getTime()).toBeGreaterThanOrEqual(before);
    // The session about to be minted starts no earlier, so it survives.
    expect(after.sessionsRevokedAt!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(await db.mobileSession.count({ where: { userId: squatted.id } })).toBe(0);
  });

  it("links one whose owner verified the address without touching it", async () => {
    const email = `${tag}-owner@example.test`;
    const password = "$2a$10$abcdefghijklmnopqrstuuJ6d3S6sDq6qH8bDqk1rXyQe4r9eW1uK";
    const owner = await db.user.create({
      data: {
        email,
        password,
        emailVerified: new Date(),
        mobileSessions: { create: { expiresAt: new Date(Date.now() + 86_400_000) } },
      },
    });

    expect(await decideGoogleSignIn({ providerAccountId: `${tag}-g2` }, { email, email_verified: true })).toBe(true);

    const after = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(after.password).toBe(password);
    expect(after.sessionsRevokedAt).toBeNull();
    expect(await db.mobileSession.count({ where: { userId: owner.id } })).toBe(1);
  });
});
