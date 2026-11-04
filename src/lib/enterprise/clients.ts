import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { contractInForce } from "./auth";
import { newApiKey } from "./keys";
import { isApiScope } from "./scopes";

/**
 * Managing an organization's API keys and recording each change in the
 * organization's audit trail (the console's Audit section). A key is shown
 * exactly once, when made; nobody — not the platform — can read it later.
 */

export interface Actor {
  id: string;
  name: string | null;
}

/** An organization-trail entry. Never a key, a secret or a customer's details. */
export async function orgAudit(organizationId: string, actor: Actor | null, action: string, summary: string, metadata?: Prisma.InputJsonValue) {
  await db.auditLog
    .create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        actorRole: "organization",
        action,
        resourceType: "Organization",
        resourceId: organizationId,
        summary: summary.slice(0, 500),
        ...(metadata !== undefined ? { metadata } : {}),
      },
    })
    .catch((e) => log.error("[audit] FAILED TO RECORD", e, { action, organizationId }));
}

export type ClientResult =
  | { ok: true; id: string; key: string; prefix: string }
  | { ok: false; why: "no-contract" | "limit" | "bad-scopes" | "not-found" | "revoked" };

/** Live keys count against the contract: ACTIVE and not past their grace. */
async function liveKeys(organizationId: string, now: Date) {
  return db.apiClient.count({
    where: { organizationId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  });
}

export async function createApiClient(
  organizationId: string,
  input: { name: string; scopes: string[] },
  actor: Actor,
  now: Date = new Date(),
): Promise<ClientResult> {
  const scopes = [...new Set(input.scopes)];
  if (scopes.length === 0 || !scopes.every(isApiScope)) return { ok: false, why: "bad-scopes" };
  return db.$transaction(async (tx) => {
    // The organization row is locked so two requests cannot both be the last allowed key.
    await tx.$queryRaw`SELECT "id" FROM "VenueOrganization" WHERE "id" = ${organizationId} FOR UPDATE`;
    const contract = await tx.organizationContract.findUnique({ where: { organizationId } });
    if (!contractInForce(contract, now)) return { ok: false as const, why: "no-contract" as const };
    const live = await tx.apiClient.count({
      where: { organizationId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    });
    if (live >= contract!.maxApiClients) return { ok: false as const, why: "limit" as const };
    const k = newApiKey();
    const row = await tx.apiClient.create({
      data: { organizationId, name: input.name.slice(0, 80), keyPrefix: k.prefix, keyHash: k.hash, scopes, createdById: actor.id },
      select: { id: true },
    });
    await orgAudit(organizationId, actor, "org.api_key.create", `API key "${input.name.slice(0, 80)}" (${k.prefix}) created with ${scopes.join(", ")}`, { prefix: k.prefix, scopes });
    return { ok: true as const, id: row.id, key: k.key, prefix: k.prefix };
  });
}

/**
 * Rotation: a new key with the same name and scopes; the old one keeps
 * working for `graceHours` (default 24, 0 = stop now) so the integration
 * can switch, then is refused. Does not count twice against the limit
 * because the old key's grace is cut to the window.
 */
export async function rotateApiClient(
  organizationId: string,
  clientId: string,
  actor: Actor,
  graceHours = 24,
  now: Date = new Date(),
): Promise<ClientResult> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; name: string; scopes: string[]; status: string; keyPrefix: string; expiresAt: Date | null }[]>`
      SELECT "id", "name", "scopes", "status"::text AS status, "keyPrefix", "expiresAt" FROM "ApiClient"
       WHERE "id" = ${clientId} AND "organizationId" = ${organizationId} FOR UPDATE`;
    const old = rows[0];
    if (!old) return { ok: false as const, why: "not-found" as const };
    if (old.status !== "ACTIVE" || (old.expiresAt && old.expiresAt <= now)) return { ok: false as const, why: "revoked" as const };
    const contract = await tx.organizationContract.findUnique({ where: { organizationId } });
    if (!contractInForce(contract, now)) return { ok: false as const, why: "no-contract" as const };
    const k = newApiKey();
    const fresh = await tx.apiClient.create({
      data: { organizationId, name: old.name, keyPrefix: k.prefix, keyHash: k.hash, scopes: old.scopes, createdById: actor.id },
      select: { id: true },
    });
    const grace = Math.max(0, Math.min(72, graceHours));
    await tx.apiClient.update({
      where: { id: old.id },
      data: { replacedById: fresh.id, expiresAt: new Date(now.getTime() + grace * 3_600_000) },
    });
    await orgAudit(organizationId, actor, "org.api_key.rotate", `API key ${old.keyPrefix} rotated to ${k.prefix}; the old key works for ${grace} more hours`, { from: old.keyPrefix, to: k.prefix, graceHours: grace });
    return { ok: true as const, id: fresh.id, key: k.key, prefix: k.prefix };
  });
}

export async function revokeApiClient(organizationId: string, clientId: string, actor: Actor, now: Date = new Date()): Promise<boolean> {
  const row = await db.apiClient.findFirst({ where: { id: clientId, organizationId }, select: { keyPrefix: true } });
  if (!row) return false;
  const { count } = await db.apiClient.updateMany({
    where: { id: clientId, organizationId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: now },
  });
  if (count === 1) await orgAudit(organizationId, actor, "org.api_key.revoke", `API key ${row.keyPrefix} revoked`, { prefix: row.keyPrefix });
  return count === 1;
}

export { liveKeys };
