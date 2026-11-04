import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { openWith, sealWith } from "./crypto";

/**
 * A venue's own credential at its access provider (Phase 28,
 * docs/enterprise/ARCHITECTURE.md "Provider isolation").
 *
 * Each venue keeps its own secret, sealed at rest under its own key
 * purpose ("venue-credential"), one row per venue. Every call the sync
 * engine makes for a venue's pass carries that venue's secret and nothing
 * else (CallContext.venueCredential), so venue A's key can never sign or
 * open anything for venue B, and revoking or rotating one venue's key
 * leaves every other venue untouched. A revoked credential stops that
 * venue's provider calls (ProviderUnavailableError "credential-revoked");
 * a venue with no credential row uses the provider's platform-level
 * configuration, as before Phase 28.
 */

export type VenueCredential = { secret: string; keyVersion: number };

/** The venue's credential for this provider: the secret, "revoked", or null (none kept). */
export async function venueCredentialFor(venueId: string, providerId: string): Promise<VenueCredential | "revoked" | null> {
  const row = await db.venueAccessCredential.findUnique({
    where: { venueId },
    select: { providerId: true, secretSealed: true, keyVersion: true, revokedAt: true },
  });
  if (!row) return null;
  // A credential for another provider (the venue switched) is not this one's.
  if (row.providerId !== providerId) return "revoked";
  if (row.revokedAt) return "revoked";
  const secret = openWith("venue-credential", row.secretSealed);
  return secret ? { secret, keyVersion: row.keyVersion } : "revoked";
}

export type SetResult = { ok: true; keyVersion: number } | { ok: false; why: "no-provider" | "no-key" | "not-found" };

/**
 * Stores (or rotates to) a credential the provider issued for this venue.
 * `secret` is what the provider gave the platform administrator; if absent
 * (the sandbox) one is generated. Rotation bumps keyVersion.
 */
export async function setVenueCredential(venueId: string, actorId: string, secret?: string): Promise<SetResult> {
  const venue = await db.venue.findUnique({ where: { id: venueId }, select: { accessProviderId: true } });
  if (!venue) return { ok: false, why: "not-found" };
  if (!venue.accessProviderId) return { ok: false, why: "no-provider" };
  const sealed = sealWith("venue-credential", secret ?? randomBytes(32).toString("base64url"));
  if (!sealed) return { ok: false, why: "no-key" };
  const now = new Date();
  const row = await db.venueAccessCredential.upsert({
    where: { venueId },
    create: { venueId, providerId: venue.accessProviderId, secretSealed: sealed, createdById: actorId },
    update: { providerId: venue.accessProviderId, secretSealed: sealed, keyVersion: { increment: 1 }, rotatedAt: now, revokedAt: null },
    select: { keyVersion: true },
  });
  return { ok: true, keyVersion: row.keyVersion };
}

export async function revokeVenueCredential(venueId: string): Promise<boolean> {
  const { count } = await db.venueAccessCredential.updateMany({ where: { venueId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count === 1;
}
