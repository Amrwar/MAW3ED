import { after } from "next/server";
import type { AccessCredential, AccessEntitlement, AccessProvider, AccessSyncJob, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { sealToken, sha256 } from "./crypto";
import {
  adapterFor,
  ProviderUnavailableError,
  TransientProviderError,
  type CallContext,
  type IssueResult,
  type PassRequest,
} from "./provider";

/**
 * Talking to access providers, reliably and boundedly.
 *
 * Every call to a provider is a row first (AccessSyncJob), written in
 * the same transaction as the change that needs it, so a change is
 * never made without its call and a call never made for a change that
 * rolled back. A worker then claims due jobs and makes the calls:
 *
 *   - claimed with a lease (leasedUntil), conditionally, so two workers
 *     never make the same call and a worker that died mid-call releases
 *     it when the lease runs out;
 *   - each call bounded by a timeout (PROVIDER_TIMEOUT_MS), with an
 *     AbortSignal the adapter honours and a race that stops waiting even
 *     if it does not;
 *   - sent with the job's idempotency key, so a retried call is the same
 *     call to the provider;
 *   - retried with exponential backoff on transient failure, and after
 *     MAX_ATTEMPTS marked DEAD — never retried forever. A dead PROVISION
 *     leaves the credential FAILED (the customer sees it and may ask
 *     again); a dead REVOKE raises an ESCALATION event for a person,
 *     because Maw3ed cannot claim a credential is withdrawn until the
 *     provider says so;
 *   - a run stops claiming once its time budget is spent.
 *
 * Nothing loops: work happens when something changes (kickAccessJobs,
 * after the response) and on the cron (/api/cron/access); a run takes at
 * most `limit` jobs.
 *
 * docs/architecture/ACCESS_PROVIDER_INTERFACE.md.
 */

export const PROVIDER_TIMEOUT_MS = 8_000;
export const MAX_ATTEMPTS = 6;
export const LEASE_MS = 60_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60_000;

/** Delay before attempt n+1, after n failed attempts. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

type Tx = Prisma.TransactionClient;

/** Queues a call; the same (credential, kind, version) is queued once. */
export async function enqueueJob(
  tx: Tx,
  credential: Pick<AccessCredential, "id" | "correlationId">,
  kind: "PROVISION" | "UPDATE" | "REVOKE",
  version: number,
): Promise<void> {
  await tx.accessSyncJob.createMany({
    data: [{ credentialId: credential.id, kind, idempotencyKey: `${credential.id}:${kind}:${version}`, correlationId: credential.correlationId }],
    skipDuplicates: true,
  });
}

/**
 * Withdraws a credential the provider may still honour: REVOKE_PENDING,
 * a revocation record, and the REVOKE call. `lastError` marks it as an
 * unhealthy end, which counts toward the per-pass cap (passes.ts), so a
 * provider that keeps failing cannot cause endless re-issue.
 */
export async function withdrawCredential(
  tx: Tx,
  credential: Pick<AccessCredential, "id" | "correlationId" | "version">,
  reason: string,
  lastError: string,
  at: Date,
): Promise<boolean> {
  const n = await tx.accessCredential.updateMany({
    where: { id: credential.id, status: { in: ["ACTIVE", "PENDING_PROVIDER"] } },
    data: { status: "REVOKE_PENDING", revokedAt: at, lastError },
  });
  if (!n.count) return false;
  await tx.accessRevocation.create({ data: { credentialId: credential.id, reason } });
  await enqueueJob(tx, credential, "REVOKE", credential.version);
  return true;
}

/**
 * Asks the provider for a credential again with its ORIGINAL provision
 * idempotency key and request, to learn what it holds (the same pass
 * and token) after an answer was lost. Null when it was never asked.
 */
export async function replayProvision(
  adapter: { provision: (req: PassRequest, ctx: CallContext) => Promise<IssueResult> },
  credential: CredentialFull,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<IssueResult | null> {
  const first = await db.accessSyncJob.findFirst({
    where: { credentialId: credential.id, kind: "PROVISION", attempts: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  });
  if (!first) return null;
  // The original request: the version the first call asked for, so the
  // provider sees the same call it may already have answered.
  const version = Number(first.idempotencyKey.split(":").pop()) || credential.version;
  return withTimeout(
    (signal) => adapter.provision({ ...passRequest(credential), version }, { idempotencyKey: first.idempotencyKey, correlationId: credential.correlationId, signal }),
    timeoutMs,
  );
}

/** Runs due jobs once the response is sent (or at once, outside a request). */
export function kickAccessJobs(): void {
  const run = () => runAccessJobs({ limit: 10, budgetMs: 15_000 }).catch((e) => log.error("[access] job run failed", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** A provider call with a hard timeout. */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = PROVIDER_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TransientProviderError(`provider call timed out after ${ms} ms`));
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export type CredentialFull = AccessCredential & {
  provider: AccessProvider;
  entitlement: AccessEntitlement & {
    visitor: { displayName: string; phoneE164: string | null };
    venue: { accessSiteRef: string | null; policy: { identityRequirement: string } | null; gates: { id: string; code: string | null }[] };
  };
};

/** The only part of a name a provider is sent: the first name, short. */
export function holderLabel(displayName: string): string {
  return (displayName.trim().split(/\s+/)[0] ?? "").slice(0, 40);
}

/** What a credential's entitlement asks the provider for. */
export function passRequest(c: CredentialFull): PassRequest {
  const e = c.entitlement;
  const codes = e.allowedGateIds
    .map((id) => e.venue.gates.find((g) => g.id === id)?.code)
    .filter((x): x is string => !!x);
  return {
    externalRef: c.id,
    siteRef: e.venue.accessSiteRef,
    holderLabel: holderLabel(e.visitor.displayName),
    holderPhone: e.venue.policy?.identityRequirement === "NAME_AND_PHONE" ? e.visitor.phoneE164 : null,
    validFrom: e.validFrom,
    validUntil: e.validUntil,
    entryUntil: e.entryUntil,
    gateCodes: codes,
    reentryAllowed: e.reentryAllowed,
    version: c.version,
  };
}

export const includeFull = {
  provider: true,
  entitlement: {
    include: {
      visitor: { select: { displayName: true, phoneE164: true } },
      venue: { select: { accessSiteRef: true, policy: { select: { identityRequirement: true } }, gates: { select: { id: true, code: true } } } },
    },
  },
} as const;

export interface RunResult {
  claimed: number;
  done: number;
  retried: number;
  dead: number;
}

/** Claims and runs up to `limit` due jobs, within `budgetMs`. */
export async function runAccessJobs(opts: { limit?: number; budgetMs?: number; now?: () => Date; timeoutMs?: number } = {}): Promise<RunResult> {
  const limit = opts.limit ?? 20;
  const now = opts.now ?? (() => new Date());
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  const result: RunResult = { claimed: 0, done: 0, retried: 0, dead: 0 };

  const t = now();
  const due = await db.accessSyncJob.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: t }, OR: [{ leasedUntil: null }, { leasedUntil: { lt: t } }] },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const { id } of due) {
    if (Date.now() >= deadline) break;
    const at = now();
    const claim = await db.accessSyncJob.updateMany({
      where: { id, status: "PENDING", OR: [{ leasedUntil: null }, { leasedUntil: { lt: at } }] },
      data: { leasedUntil: new Date(at.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (claim.count !== 1) continue; // another worker has it
    result.claimed++;
    const job = await db.accessSyncJob.findUnique({ where: { id } });
    if (!job) continue;
    let outcome: "done" | "retried" | "dead";
    try {
      outcome = await runOne(job, now, opts.timeoutMs ?? PROVIDER_TIMEOUT_MS);
    } catch (e) {
      // Not a provider failure (those are handled in runOne): a database
      // error, a bad row. The rest of the run goes on; this job waits its
      // backoff, and is dead-lettered once out of attempts. If even that
      // write fails, its lease runs out and the next claim counts again.
      log.error("[access] a job could not be processed", e, { job: job.id, correlationId: job.correlationId });
      const dead = job.attempts >= MAX_ATTEMPTS;
      outcome = dead ? "dead" : "retried";
      try {
        if (!dead) {
          await db.accessSyncJob.update({
            where: { id: job.id },
            data: { leasedUntil: null, lastError: "could not be processed", nextAttemptAt: new Date(at.getTime() + backoffMs(job.attempts)) },
          });
        } else {
          // Out of attempts: end it as any failure ends (failed, withdrawn
          // or escalated), so the credential is never left in between.
          const credential = (await db.accessCredential.findUnique({ where: { id: job.credentialId }, include: includeFull })) as CredentialFull | null;
          if (credential) await giveUp(job, credential, "could not be processed", now());
          else await finish(job, "DEAD", "could not be processed");
        }
      } catch (again) {
        // Even that failed: dead-letter the job alone, loudly. Its
        // credential is visible to the cron and the venue desk.
        log.error("[access] a job could not be ended cleanly", again, { job: job.id, correlationId: job.correlationId });
        await db.accessSyncJob.update({ where: { id: job.id }, data: { status: "DEAD", leasedUntil: null, lastError: "could not be processed" } }).catch(() => {});
      }
    }
    result[outcome]++;
  }
  return result;
}

async function runOne(job: AccessSyncJob, now: () => Date, timeoutMs: number): Promise<"done" | "retried" | "dead"> {
  const credential = (await db.accessCredential.findUnique({ where: { id: job.credentialId }, include: includeFull })) as CredentialFull | null;
  if (!credential) return finish(job, "DONE", null);
  // Claimed again after its last attempt never finished (the process was
  // stopped mid-call): give it up now rather than call once more.
  if (job.attempts > MAX_ATTEMPTS) return giveUp(job, credential, "interrupted on its last attempt", now());

  const ctx = (signal: AbortSignal): CallContext => ({ idempotencyKey: job.idempotencyKey, correlationId: job.correlationId, signal });
  try {
    const adapter = await adapterFor(credential.provider);
    switch (job.kind) {
      case "PROVISION": {
        // Superseded while waiting: nothing to ask for any more. A REVOKE
        // job (if any) takes care of whatever the provider may hold.
        if (credential.status !== "PENDING_PROVIDER" || credential.providerRef) return finish(job, "DONE", null);
        const r = await withTimeout((signal) => adapter.provision(passRequest(credential), ctx(signal)), timeoutMs);
        await applyIssue(credential, r, now());
        return finish(job, "DONE", null);
      }
      case "UPDATE": {
        if (credential.status !== "ACTIVE" && credential.status !== "PENDING_PROVIDER") return finish(job, "DONE", null);
        if (!credential.providerRef) {
          // The provision is still trying: wait on it (its own attempts
          // bound the wait) without using this job's, so a slow provision
          // is not withdrawn by an update that ran out first.
          const provisioning = await db.accessSyncJob.count({ where: { credentialId: credential.id, kind: "PROVISION", status: "PENDING" } });
          if (provisioning) {
            await db.accessSyncJob.update({
              where: { id: job.id },
              data: { attempts: { decrement: 1 }, leasedUntil: null, lastError: "waiting for the provision", nextAttemptAt: new Date(now().getTime() + backoffMs(1)) },
            });
            return "retried";
          }
          return waitOrGiveUp(job, credential, "waiting for the provider's reference", now());
        }
        // Only the newest version is worth sending.
        if ((credential.confirmedVersion ?? 0) >= credential.version) return finish(job, "DONE", null);
        const r = await withTimeout((signal) => adapter.update(credential.providerRef!, passRequest(credential), ctx(signal)), timeoutMs);
        await applyIssue(credential, r, now());
        return finish(job, "DONE", null);
      }
      case "REVOKE": {
        if (credential.status !== "REVOKE_PENDING") return finish(job, "DONE", null);
        let ref = credential.providerRef;
        if (!ref) {
          const provisioning = await db.accessSyncJob.count({
            where: { credentialId: credential.id, kind: "PROVISION", status: "PENDING", leasedUntil: { gt: now() } },
          });
          if (provisioning) return waitOrGiveUp(job, credential, "a provision call is still in flight", now());
          // The provision may have reached the provider with its answer
          // lost. Asking again with the same idempotency key returns the
          // same pass (or a refusal: nothing exists), so it can be revoked.
          const again = await replayProvision(adapter, credential, timeoutMs);
          ref = again && again.outcome !== "refused" ? again.providerRef : null;
          if (ref) await db.accessCredential.updateMany({ where: { id: credential.id, providerRef: null }, data: { providerRef: ref } });
        }
        if (ref) await withTimeout((signal) => adapter.revoke(ref!, "revoked", ctx(signal)), timeoutMs);
        await confirmRevoked(credential.id, now());
        return finish(job, "DONE", null);
      }
    }
  } catch (e) {
    if (e instanceof ProviderUnavailableError) return giveUp(job, credential, `provider unavailable: ${e.code}`, now());
    const message = e instanceof Error ? e.message : "provider call failed";
    if (!(e instanceof TransientProviderError)) log.error("[access] provider call failed", e, { job: job.id, correlationId: job.correlationId });
    if (job.attempts >= MAX_ATTEMPTS) return giveUp(job, credential, message, now());
    return retryLater(job, message, now());
  }
}

/** Waiting on something else: try later, and once out of attempts end it as a failure would. */
function waitOrGiveUp(job: AccessSyncJob, credential: CredentialFull, why: string, at: Date): Promise<"retried" | "dead"> {
  return job.attempts >= MAX_ATTEMPTS ? giveUp(job, credential, why, at) : retryLater(job, why, at);
}

async function finish(job: AccessSyncJob, status: "DONE" | "DEAD", error: string | null): Promise<"done" | "dead"> {
  await db.accessSyncJob.update({ where: { id: job.id }, data: { status, leasedUntil: null, lastError: error?.slice(0, 500) ?? null } });
  return status === "DONE" ? "done" : "dead";
}

async function retryLater(job: AccessSyncJob, error: string, at: Date): Promise<"retried" | "dead"> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await db.accessSyncJob.update({ where: { id: job.id }, data: { status: "DEAD", leasedUntil: null, lastError: error.slice(0, 500) } });
    return "dead";
  }
  await db.accessSyncJob.update({
    where: { id: job.id },
    data: { leasedUntil: null, lastError: error.slice(0, 500), nextAttemptAt: new Date(at.getTime() + backoffMs(job.attempts)) },
  });
  return "retried";
}

/** Out of attempts (or the provider cannot be used): a terminal state, never a silent one. */
async function giveUp(job: AccessSyncJob, credential: CredentialFull, error: string, at: Date): Promise<"dead"> {
  await db.$transaction(async (tx) => {
    await tx.accessSyncJob.update({ where: { id: job.id }, data: { status: "DEAD", leasedUntil: null, lastError: error.slice(0, 500) } });
    if (job.kind === "PROVISION") {
      // A call that may have reached the provider (it timed out, or the
      // process stopped mid-call) may have created the pass. Withdraw it:
      // the REVOKE job asks again with the original key to learn what the
      // provider holds, and revokes it. Marking it failed would leave a
      // pass valid at the gate that Maw3ed has no record of.
      if (/timed out|interrupted/.test(error)) {
        await withdrawCredential(tx, credential, "provision-uncertain", error.slice(0, 500), at);
      } else {
        await tx.accessCredential.updateMany({
          where: { id: credential.id, status: "PENDING_PROVIDER" },
          data: { status: "FAILED", lastError: error.slice(0, 500) },
        });
      }
      await tx.accessEvent.create({
        data: {
          venueId: credential.entitlement.venueId, providerId: credential.providerId, credentialId: credential.id,
          entitlementId: credential.entitlementId, kind: "CREDENTIAL_FAILED", occurredAt: at, reason: error.slice(0, 200),
          correlationId: credential.correlationId,
        },
      });
    } else if (job.kind === "REVOKE") {
      // Maw3ed has withdrawn it (its own screens and checks refuse it),
      // but cannot say the provider has. The credential stays
      // REVOKE_PENDING; the cron asks again in later rounds
      // (reconcile.ts, REVOKE_ROUNDS), and a person is told once.
      const told = await tx.accessEvent.count({ where: { credentialId: credential.id, kind: "ESCALATION" } });
      if (told) return;
      await tx.accessEvent.create({
        data: {
          venueId: credential.entitlement.venueId, providerId: credential.providerId, credentialId: credential.id,
          entitlementId: credential.entitlementId, kind: "ESCALATION", occurredAt: at,
          reason: "provider did not confirm a revocation", correlationId: credential.correlationId, details: { error: error.slice(0, 200) },
        },
      });
    } else {
      // An UPDATE the provider never took: its pass still carries the OLD
      // window, gates and re-entry. Rather than leave that admitting
      // people, withdraw it; once withdrawn, a new pass is issued for the
      // current rules (syncBookingAccess).
      await tx.accessEvent.create({
        data: {
          venueId: credential.entitlement.venueId, providerId: credential.providerId, credentialId: credential.id,
          entitlementId: credential.entitlementId, kind: "PROVIDER_ERROR", occurredAt: at, reason: error.slice(0, 200),
          correlationId: credential.correlationId,
        },
      });
      await withdrawCredential(tx, credential, "update-not-confirmed", "the provider did not take an update", at);
    }
  });
  log.warn("[access] job dead-lettered", { job: job.id, kind: job.kind, correlationId: job.correlationId });
  return "dead";
}

/**
 * Records the provider's answer to provision or update. Conditional on
 * the credential's state, so an answer arriving after the credential was
 * withdrawn never revives it — the reference is kept so the withdrawal
 * can reach the provider.
 */
export async function applyIssue(credential: Pick<AccessCredential, "id" | "correlationId" | "providerId" | "entitlementId"> & { entitlement: { venueId: string } }, r: IssueResult, at: Date): Promise<void> {
  if (r.outcome === "refused") {
    await db.$transaction(async (tx) => {
      const current = await tx.accessCredential.findUnique({ where: { id: credential.id }, select: { status: true, providerRef: true, version: true } });
      if (!current) return;
      // A refused UPDATE (the provider already issued this pass, or
      // accepted it): the old pass is still valid at the gate with the
      // old window. Withdraw it, as an update that dies is withdrawn,
      // rather than mark it failed and leave it admitting people. A
      // refused first issue has nothing to withdraw.
      const holds = current.status === "ACTIVE" || !!current.providerRef;
      const ended = holds
        ? await withdrawCredential(tx, { id: credential.id, correlationId: credential.correlationId, version: current.version }, "update-refused", r.reason.slice(0, 500), at)
        : (await tx.accessCredential.updateMany({
            where: { id: credential.id, status: { in: ["PENDING_PROVIDER", "ACTIVE"] } },
            data: { status: "FAILED", lastError: r.reason.slice(0, 500) },
          })).count > 0;
      if (ended) {
        await tx.accessEvent.create({
          data: {
            venueId: credential.entitlement.venueId, providerId: credential.providerId, credentialId: credential.id,
            entitlementId: credential.entitlementId, kind: "CREDENTIAL_FAILED", occurredAt: at, reason: r.reason.slice(0, 200),
            correlationId: credential.correlationId,
          },
        });
      }
    });
    return;
  }
  // Keep the reference whatever the state, so a later revoke can name it.
  await db.accessCredential.updateMany({ where: { id: credential.id, providerRef: null }, data: { providerRef: r.providerRef } });
  if (r.outcome === "accepted") return; // confirmation arrives as an event
  await activate(credential, { token: r.token, displayFormat: r.displayFormat, expiresAt: r.expiresAt, version: r.version }, at, null);
}

/** The provider confirmed a credential (at a version). Never moves a withdrawn one. */
export async function activate(
  credential: Pick<AccessCredential, "id" | "correlationId" | "providerId" | "entitlementId"> & { entitlement: { venueId: string } },
  p: { token: string | null; displayFormat: string | null; expiresAt: Date | null; version: number | null },
  at: Date,
  providerEventId: string | null,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const current = await tx.accessCredential.findUnique({ where: { id: credential.id }, select: { status: true, confirmedVersion: true, version: true } });
    if (!current || (current.status !== "PENDING_PROVIDER" && current.status !== "ACTIVE")) return false;
    const version = p.version ?? current.version;
    // Out of order: an older confirmation never replaces a newer one.
    if (current.confirmedVersion !== null && version < current.confirmedVersion) return false;
    const sealed = p.token ? sealToken(p.token) : undefined;
    // Conditional, so a withdrawal that commits between the read above and
    // this write (a cancellation racing a confirmation) is never undone:
    // Postgres re-checks the condition once it holds the row.
    const n = await tx.accessCredential.updateMany({
      where: {
        id: credential.id,
        status: { in: ["PENDING_PROVIDER", "ACTIVE"] },
        OR: [{ confirmedVersion: null }, { confirmedVersion: { lte: version } }],
      },
      data: {
        status: "ACTIVE",
        confirmedVersion: version,
        confirmedAt: at,
        lastError: null,
        ...(p.token ? { tokenHash: sha256(p.token), tokenCiphertext: sealed ?? null } : {}),
        ...(p.displayFormat ? { displayFormat: p.displayFormat } : {}),
        ...(p.expiresAt ? { expiresAt: p.expiresAt } : {}),
      },
    });
    if (!n.count) return false;
    if (!providerEventId) {
      await tx.accessEvent.create({
        data: {
          venueId: credential.entitlement.venueId, providerId: credential.providerId, credentialId: credential.id,
          entitlementId: credential.entitlementId, kind: current.status === "ACTIVE" ? "CREDENTIAL_UPDATED" : "CREDENTIAL_ACTIVE",
          occurredAt: at, correlationId: credential.correlationId, details: { version },
        },
      });
    }
    return true;
  });
}

/** The provider has withdrawn it (or never had it). */
export async function confirmRevoked(credentialId: string, at: Date): Promise<void> {
  await db.$transaction(async (tx) => {
    const c = await tx.accessCredential.findUnique({ where: { id: credentialId }, include: { entitlement: { select: { venueId: true } } } });
    if (!c || c.status === "REVOKED") return;
    await tx.accessCredential.update({ where: { id: credentialId }, data: { status: "REVOKED", revokedAt: c.revokedAt ?? at } });
    await tx.accessRevocation.updateMany({ where: { credentialId, confirmedAt: null }, data: { confirmedAt: at } });
    await tx.accessEvent.create({
      data: {
        venueId: c.entitlement.venueId, providerId: c.providerId, credentialId, entitlementId: c.entitlementId,
        kind: "CREDENTIAL_REVOKED", occurredAt: at, correlationId: c.correlationId,
      },
    });
  });
}
