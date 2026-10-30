import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { log } from "@/lib/logger";
import { MembershipFailure, MEMBERSHIP_MESSAGES } from "./memberships";
import type { VenueCaller } from "./guard";

/**
 * What every venue route shares: one error shape, and an audit entry for
 * every change. Venue managers are not platform administrators, so the
 * audit row records them by user id with the role they acted under.
 */
export async function handle(tag: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof MembershipFailure) {
      const m = MEMBERSHIP_MESSAGES[e.code];
      return err(m.ar, m.status, { code: e.code });
    }
    // Two edits racing on a unique row, or an id that does not exist:
    // the caller's to retry or correct, not a server error.
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return err("حصل تعديل في نفس الوقت — جرّب تاني", 409, { code: "conflict" });
      if (e.code === "P2003" || e.code === "P2025") return err("مرجع غير موجود", 422, { code: "bad-reference" });
    }
    log.error(`[${tag}]`, e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function venueAudit(
  caller: VenueCaller,
  authority: string,
  action: string,
  venueId: string,
  summary: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: caller.userId,
        actorName: caller.name,
        // PLATFORM, ORGANIZATION_ADMIN, COMPOUND_ADMIN or VENUE_MANAGER:
        // the authority the change was made under.
        actorRole: authority,
        action,
        resourceType: "Venue",
        resourceId: venueId,
        summary,
        metadata: { authority, ...(metadata ?? {}) } as object,
      },
    });
  } catch (e) {
    log.error("[venue audit] FAILED TO RECORD", e, { action, venueId });
  }
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}

/**
 * The parsed update narrowed to the fields the caller actually sent. A
 * zod schema made .partial() still fills in its defaults, which would
 * quietly reset (for instance) a deactivated gate to active on a rename.
 */
export function sentOnly<T extends Record<string, unknown>>(raw: unknown, parsed: T): Partial<T> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => k in raw)) as Partial<T>;
}
