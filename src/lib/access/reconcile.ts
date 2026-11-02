import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { syncBookingAccess } from "./passes";
import { adapterFor } from "./provider";
import { applyIssue, includeFull, replayProvision, runAccessJobs, withdrawCredential, withTimeout, type CredentialFull, type RunResult } from "./sync";

/**
 * The access cron's work (/api/cron/access, every five minutes). Each step
 * takes a bounded batch, so a run has a known cost however much is
 * waiting, and anything left is taken by the next run:
 *
 *   1. passes whose window has ended, or that are due a fresh decision
 *      (oldest-decided first) — a business suspended, a venue notice
 *      starting or ending, a no-show cut-off, a reinstated pass that
 *      needs issuing — are decided again (syncBookingAccess);
 *   2. credentials a provider accepted but never confirmed are asked
 *      about once they are STALE_PENDING_MS old, and failed after
 *      GIVE_UP_PENDING_MS rather than left pending forever;
 *   3. a withdrawal the provider never confirmed is asked again, hourly,
 *      REVOKE_ROUNDS times at most;
 *   4. due provider calls run (lib/access/sync.ts);
 *   5. each provider in use is health-checked, its answer recorded for
 *      the administrators' screen.
 */

export const STALE_PENDING_MS = 10 * 60_000;
/** A withdrawal the provider never confirmed is asked again hourly, this many times, then left to a person. */
export const REVOKE_ROUNDS = 24;
const ROUND_MS = 60 * 60_000;
export const GIVE_UP_PENDING_MS = 24 * 60 * 60_000;

export interface ReconcileResult {
  resynced: number;
  stale: { asked: number; failed: number; recovered: number };
  revokeRounds: number;
  jobs: RunResult;
  health: { slug: string; ok: boolean }[];
}

export async function reconcileAccess(opts: { now?: Date; batch?: number; budgetMs?: number } = {}): Promise<ReconcileResult> {
  const now = opts.now ?? new Date();
  const batch = opts.batch ?? 50;
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);

  // 1. Decide again: ended windows first, then the longest-undecided live ones.
  const ended = await db.accessEntitlement.findMany({
    where: { status: { in: ["ELIGIBLE", "SUSPENDED"] }, validUntil: { lte: now } },
    orderBy: { updatedAt: "asc" },
    select: { bookingId: true },
    take: batch,
  });
  const live = await db.accessEntitlement.findMany({
    where: { status: { in: ["ELIGIBLE", "SUSPENDED"] }, validUntil: { gt: now } },
    orderBy: { updatedAt: "asc" },
    select: { bookingId: true },
    take: batch,
  });
  const bookingIds = [...new Set([...ended, ...live].map((e) => e.bookingId))];
  let resynced = 0;
  for (const id of bookingIds) {
    if (Date.now() >= deadline) break;
    try {
      // Step 4 runs the jobs this queues; no runner per booking.
      await syncBookingAccess(id, { now, kick: false });
      resynced++;
    } catch (e) {
      log.error("[access] reconcile failed for a booking", e, { bookingId: id });
    }
    // Touched either way, so the round-robin moves on when nothing changed
    // and a booking that keeps failing cannot hold the front of the queue.
    await db.accessEntitlement
      .updateMany({ where: { bookingId: id, status: { in: ["ELIGIBLE", "SUSPENDED"] } }, data: { updatedAt: now } })
      .catch((e) => log.error("[access] reconcile could not move a booking on", e, { bookingId: id }));
  }

  // 2. Accepted but never confirmed.
  const stale = { asked: 0, failed: 0, recovered: 0 };
  const pending = await db.accessCredential.findMany({
    where: { status: "PENDING_PROVIDER", providerRef: { not: null }, updatedAt: { lte: new Date(now.getTime() - STALE_PENDING_MS) } },
    include: includeFull,
    orderBy: { updatedAt: "asc" },
    take: Math.min(batch, 20),
  });
  for (const c of pending as CredentialFull[]) {
    if (Date.now() >= deadline) break;
    if (now.getTime() - c.createdAt.getTime() >= GIVE_UP_PENDING_MS) {
      await db.accessCredential.updateMany({
        where: { id: c.id, status: "PENDING_PROVIDER" },
        data: { status: "FAILED", lastError: "the provider never confirmed the pass" },
      });
      stale.failed++;
      continue;
    }
    try {
      const adapter = await adapterFor(c.provider);
      const remote = await withTimeout((signal) => adapter.status(c.providerRef!, { idempotencyKey: `${c.id}:STATUS`, correlationId: c.correlationId, signal }));
      stale.asked++;
      if (!remote.found || remote.status === "REVOKED" || remote.status === "EXPIRED") {
        await db.accessCredential.updateMany({
          where: { id: c.id, status: "PENDING_PROVIDER" },
          data: { status: "FAILED", lastError: `the provider reports the pass ${remote.found ? remote.status.toLowerCase() : "unknown"}` },
        });
        stale.failed++;
      } else if (remote.status === "ACTIVE") {
        // Issued there, but its confirmation never reached us. Asking for
        // it again with the original key and request returns the same pass
        // (and its token), which is then recorded as any answer is.
        const r = await replayProvision(adapter, c);
        if (r?.outcome === "active") {
          await applyIssue(c, r, now);
          stale.recovered++;
        } else if (r?.outcome === "refused") {
          // It holds an active pass it will not describe again: withdraw
          // it rather than mark it failed and leave it valid at the gate.
          await db.$transaction((tx) => withdrawCredential(tx, c, "unconfirmed-pass", "the provider would not confirm a pass it holds", now));
        } else {
          await db.accessCredential.update({ where: { id: c.id }, data: { updatedAt: now } });
        }
      } else {
        // Still pending there: ask again next time (touching moves it to the back).
        await db.accessCredential.update({ where: { id: c.id }, data: { updatedAt: now } });
      }
    } catch (e) {
      log.warn("[access] could not ask a provider about a pending pass", { correlationId: c.correlationId, error: e instanceof Error ? e.message : String(e) });
      await db.accessCredential.update({ where: { id: c.id }, data: { updatedAt: now } });
    }
  }

  // 3. Withdrawals the provider never confirmed: one more round each hour,
  //    REVOKE_ROUNDS at most. Until one succeeds the pass stays withdrawn on
  //    Maw3ed's side and no new one is issued (one live credential each).
  let revokeRounds = 0;
  const stuck = await db.accessCredential.findMany({
    where: {
      status: "REVOKE_PENDING",
      jobs: { none: { status: "PENDING" } },
      updatedAt: { lte: new Date(now.getTime() - ROUND_MS) },
    },
    select: { id: true, correlationId: true, version: true, providerId: true, entitlementId: true, entitlement: { select: { venueId: true } }, _count: { select: { jobs: { where: { kind: "REVOKE" } } } } },
    orderBy: { updatedAt: "asc" },
    take: Math.min(batch, 20),
  });
  for (const c of stuck) {
    if (c._count.jobs > REVOKE_ROUNDS) {
      // A day of asking: stop. It stays withdrawn on Maw3ed's side, and is
      // closed (REVOKED, its revocation still unconfirmed) so the person
      // can be issued a pass again; a person is told to check the gate
      // system by hand. Leaving it pending would block that person forever
      // and keep it in this batch.
      await db.$transaction(async (tx) => {
        const n = await tx.accessCredential.updateMany({
          where: { id: c.id, status: "REVOKE_PENDING" },
          data: { status: "REVOKED", lastError: "the provider never confirmed the withdrawal" },
        });
        if (n.count) {
          await tx.accessEvent.create({
            data: {
              venueId: c.entitlement.venueId, providerId: c.providerId, credentialId: c.id, entitlementId: c.entitlementId,
              kind: "ESCALATION", occurredAt: now, correlationId: c.correlationId,
              reason: "stopped asking the provider to withdraw a pass; check the gate system by hand",
            },
          });
        }
      });
      continue;
    }
    await db.$transaction(async (tx) => {
      await tx.accessSyncJob.createMany({
        data: [{ credentialId: c.id, kind: "REVOKE", idempotencyKey: `${c.id}:REVOKE:${c.version}:r${c._count.jobs}`, correlationId: c.correlationId }],
        skipDuplicates: true,
      });
      await tx.accessCredential.update({ where: { id: c.id }, data: { updatedAt: now } });
    });
    revokeRounds++;
  }

  // 4. Provider calls.
  const remainingMs = Math.max(0, deadline - Date.now());
  const jobs = remainingMs > 0 ? await runAccessJobs({ limit: batch, budgetMs: remainingMs }) : { claimed: 0, done: 0, retried: 0, dead: 0 };

  // 5. Health of the providers venues use.
  const providers = await db.accessProvider.findMany({ where: { isEnabled: true, venues: { some: { accessEnabled: true } } }, take: 10 });
  const health: { slug: string; ok: boolean }[] = [];
  for (const p of providers) {
    if (Date.now() >= deadline) break;
    let ok = false;
    let detail = "";
    try {
      const adapter = await adapterFor(p);
      const h = await withTimeout((signal) => adapter.health(signal), 5_000);
      ok = h.ok;
      detail = h.detail;
    } catch (e) {
      detail = e instanceof Error ? e.message : "unreachable";
    }
    await db.accessProvider.update({ where: { id: p.id }, data: { lastHealthAt: now, lastHealthOk: ok, lastHealthDetail: detail.slice(0, 300) } });
    health.push({ slug: p.slug, ok });
  }

  return { resynced, stale, revokeRounds, jobs, health };
}
