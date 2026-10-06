import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import type { AdminActor } from "./guard";

/**
 * The record of what was done.
 *
 * Written for the moment somebody asks "who suspended this business,
 * and why" — which is always asked after the fact, by someone upset,
 * about a decision nobody remembers making.
 *
 * Three rules it follows:
 *
 *   1. The actor's name and role are copied in, not joined. A log that
 *      renders whoever holds an id today rewrites its own history the
 *      moment somebody is promoted or renamed. What it should say is
 *      who they were when they did it.
 *
 *   2. Every entry carries a sentence a person can read. Structured
 *      metadata is for filtering and for detail; "Admin X changed
 *      business Y from pending to approved" is what somebody actually
 *      needs, and reconstructing it from JSON at read time means the
 *      wording drifts.
 *
 *   3. It never throws. An audit write failing must not undo the thing
 *      it was recording — a suspended business that comes back because
 *      the log was unavailable is worse than a gap in the log, and the
 *      gap is reported loudly.
 */

export interface AuditEntry {
  actor: AdminActor | null;
  /** A verb: "business.suspend", "review.hide", "role.grant". */
  action: string;
  resourceType: string;
  resourceId?: string | null;
  /** One sentence, readable on its own. */
  summary: string;
  /**
   * Whatever makes the action understandable later — what changed from
   * and to, the reason given. Never credentials, and never a
   * customer's contact details: this table is read by more people than
   * the records it describes.
   */
  metadata?: Prisma.InputJsonValue;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actor?.id ?? null,
        actorName: entry.actor?.name ?? null,
        actorRole: entry.actor?.role ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        summary: entry.summary,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      },
    });
  } catch (e) {
    // Loud, because a silent gap in an audit trail is the worst kind.
    log.error("[audit] FAILED TO RECORD", e, {
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
    });
  }
}

/** "Amr Hefny (مشرف عام)" — or "النظام" for something nobody did by hand. */
export function actorLabel(actor: AdminActor | null): string {
  if (!actor) return "النظام";
  return actor.name?.trim() || "مشرف";
}

/**
 * Describes a field change in the words the log uses everywhere.
 * Keeping the phrasing in one place is what stops two screens
 * describing the same action differently.
 */
export function describeChange(
  what: string,
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  const a = from ?? "—";
  const b = to ?? "—";
  return `${what} من "${a}" إلى "${b}"`;
}
