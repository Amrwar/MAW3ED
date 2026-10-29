import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * An audit entry for something an account holder did to their own
 * account — a deletion, a password reset, a mass sign-out. One helper
 * so the three places that record one agree on shape, and so the role
 * is read from the account rather than assumed: a password reset is an
 * owner's action as often as a customer's.
 *
 * `tx` lets the entry be written inside the caller's transaction (the
 * deletion must record itself in the same transaction that removes the
 * account). Outside one, a failure to write is logged and swallowed:
 * the action it describes has happened and must not be rolled back by
 * its own bookkeeping.
 */
export type AccountRole = "owner" | "admin" | "staff" | "customer";

export async function roleOfUser(client: Pick<Prisma.TransactionClient, "user">, userId: string): Promise<AccountRole> {
  const u = await client.user.findUnique({
    where: { id: userId },
    select: { adminRole: true, business: { select: { id: true } }, staffMember: { select: { id: true } } },
  });
  if (u?.adminRole) return "admin";
  if (u?.business) return "owner";
  if (u?.staffMember) return "staff";
  return "customer";
}

export async function recordAccountEvent(
  entry: {
    userId: string;
    action: "account.deleted" | "account.password_reset" | "account.sessions_revoked";
    summary: string;
    role?: AccountRole;
    metadata?: Prisma.InputJsonValue;
  },
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? db;
  const role = entry.role ?? (await roleOfUser(client, entry.userId));
  const data = {
    // The deletion removes the row this would point at.
    actorId: entry.action === "account.deleted" ? null : entry.userId,
    actorName: "Account holder",
    actorRole: role,
    action: entry.action,
    resourceType: "User",
    resourceId: entry.userId,
    summary: entry.summary,
    ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
  };
  if (tx) {
    await tx.auditLog.create({ data });
    return;
  }
  await db.auditLog.create({ data }).catch((e) => log.error("[audit] could not record account event", e, { action: entry.action }));
}
