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
