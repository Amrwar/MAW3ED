import { createHmac, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { purposeKey, sha256, signMessage, verifyMessage } from "./crypto";
import {
  sandboxAllowed,
  TransientProviderError,
  type AccessProviderAdapter,
  type CallContext,
  type IssueResult,
  type PassRequest,
  type ProviderEvent,
} from "./provider";

/**
 * THE SANDBOX ACCESS PROVIDER — an imitation of an external gate system,
 * for development and QA. Not a real provider, not valid at any gate.
 *
 * It keeps its own store (SandboxAccessPass), which nothing else in
 * Maw3ed reads: Maw3ed learns about it only through the adapter calls
 * and the signed events it sends, exactly as it would from a real one.
 * Its failure modes (SandboxProviderState.mode) let tests and QA drive
 * every path a real provider can take:
 *
 *   NORMAL      issues and confirms at once
 *   NO_CONFIRM  accepts, and confirms only when told (confirmPendingSandboxPasses)
 *   DOWN        every call fails (retried with backoff, then dead-lettered)
 *   TIMEOUT     every call hangs until the caller's timeout aborts it
 *   REFUSE      refuses every new pass
 *
 * Refused wherever customers are (lib/access/provider.ts sandboxAllowed);
 * every entry point checks again. Its codes start "SANDBOX-" so nobody
 * can mistake one for a real pass.
 */

export const SANDBOX_MODES = ["NORMAL", "NO_CONFIRM", "DOWN", "TIMEOUT", "REFUSE"] as const;
export type SandboxMode = (typeof SANDBOX_MODES)[number];

function guard() {
  if (!sandboxAllowed()) throw new Error("the sandbox access provider is disabled here");
}

async function mode(): Promise<SandboxMode> {
  const row = await db.sandboxProviderState.findUnique({ where: { id: "default" } });
  return (SANDBOX_MODES as readonly string[]).includes(row?.mode ?? "") ? (row!.mode as SandboxMode) : "NORMAL";
}

export async function setSandboxMode(m: SandboxMode): Promise<void> {
  guard();
  await db.sandboxProviderState.upsert({ where: { id: "default" }, create: { id: "default", mode: m }, update: { mode: m } });
}

/** Waits like a slow network, but gives up the moment the caller aborts. */
function hang(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => reject(new TransientProviderError("sandbox: timed out"));
    if (signal.aborted) return fail();
    signal.addEventListener("abort", fail, { once: true });
  });
}

async function behave(signal: AbortSignal): Promise<SandboxMode> {
  guard();
  const m = await mode();
  if (m === "DOWN") throw new TransientProviderError("sandbox: provider unavailable (503)");
  if (m === "TIMEOUT") await hang(signal);
  return m;
}

/** The sandbox's token for a pass: derivable again, so a retried call returns the same one. */
function tokenFor(providerRef: string): string {
  const key = purposeKey("sandbox-webhook") ?? Buffer.from("sandbox");
  return `SANDBOX-${createHmac("sha256", key).update(`token:${providerRef}`).digest("base64url").slice(0, 32)}`;
}

function issued(pass: { providerRef: string; validUntil: Date; version: number }): IssueResult {
  return { outcome: "active", providerRef: pass.providerRef, token: tokenFor(pass.providerRef), displayFormat: "QR", expiresAt: pass.validUntil, version: pass.version };
}

export const sandboxAdapter: AccessProviderAdapter = {
  kind: "SANDBOX",

  async provision(req: PassRequest, ctx: CallContext): Promise<IssueResult> {
    const m = await behave(ctx.signal);
    // Idempotent: the same credential asked twice gets the same pass.
    const existing = await db.sandboxAccessPass.findFirst({ where: { externalRef: req.externalRef } });
    if (existing) {
      return existing.status === "PENDING" ? { outcome: "accepted", providerRef: existing.providerRef } : issued(existing);
    }
    if (m === "REFUSE") return { outcome: "refused", reason: "sandbox: refused by provider policy" };
    const providerRef = `sbx_${randomBytes(9).toString("base64url")}`;
    const pass = await db.sandboxAccessPass.create({
      data: {
        providerRef,
        externalRef: req.externalRef,
        siteRef: req.siteRef,
        tokenHash: sha256(tokenFor(providerRef)),
        holderLabel: req.holderLabel.slice(0, 80),
        validFrom: req.validFrom,
        validUntil: req.validUntil,
        entryUntil: req.entryUntil,
        gateCodes: req.gateCodes,
        reentry: req.reentryAllowed,
        status: m === "NO_CONFIRM" ? "PENDING" : "ACTIVE",
        version: req.version,
      },
    });
    return m === "NO_CONFIRM" ? { outcome: "accepted", providerRef } : issued(pass);
  },

  async update(providerRef: string, req: PassRequest, ctx: CallContext): Promise<IssueResult> {
    await behave(ctx.signal);
    const pass = await db.sandboxAccessPass.findUnique({ where: { providerRef } });
    if (!pass || pass.status === "REVOKED") return { outcome: "refused", reason: "sandbox: no such live pass" };
    // An older version arriving late never overwrites a newer one.
    if (req.version < pass.version) return issued(pass);
    const next = await db.sandboxAccessPass.update({
      where: { providerRef },
      data: {
        validFrom: req.validFrom, validUntil: req.validUntil, entryUntil: req.entryUntil,
        gateCodes: req.gateCodes, reentry: req.reentryAllowed, version: req.version, holderLabel: req.holderLabel.slice(0, 80),
      },
    });
    return next.status === "PENDING" ? { outcome: "accepted", providerRef } : issued(next);
  },

  async revoke(providerRef: string, _reason: string, ctx: CallContext) {
    await behave(ctx.signal);
    // Idempotent: revoking a revoked or unknown pass is a success.
    await db.sandboxAccessPass.updateMany({ where: { providerRef }, data: { status: "REVOKED", inside: false } });
    return { revoked: true as const };
  },

  async status(providerRef: string, ctx: CallContext) {
    await behave(ctx.signal);
    const pass = await db.sandboxAccessPass.findUnique({ where: { providerRef } });
    if (!pass) return { found: false as const };
    const expired = pass.status === "ACTIVE" && pass.validUntil < new Date();
    const status = expired ? "EXPIRED" : (pass.status as "ACTIVE" | "REVOKED" | "PENDING");
    return { found: true as const, status, version: pass.version };
  },

  parseEvent(rawBody: string, headers: Headers): ProviderEvent | null {
    if (!sandboxAllowed()) return null;
    const key = purposeKey("sandbox-webhook");
    const ts = Number(headers.get("x-sandbox-timestamp"));
    const sig = headers.get("x-sandbox-signature") ?? "";
    if (!key || !verifyMessage(key, rawBody, ts, sig)) return null;
    return parseEventBody(rawBody);
  },

  async health(signal: AbortSignal) {
    try {
      const m = await behave(signal);
      return { ok: true, detail: `sandbox (${m}) — not valid at any gate` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "sandbox: unreachable" };
    }
  },
};

const EVENT_KINDS = new Set<ProviderEvent["kind"]>([
  "CREDENTIAL_ACTIVE", "CREDENTIAL_UPDATED", "CREDENTIAL_REVOKED", "CREDENTIAL_FAILED", "ENTRY_GRANTED", "ENTRY_DENIED", "EXIT",
]);

/** The shape check, separate from the signature so it is tested on its own. */
export function parseEventBody(rawBody: string): ProviderEvent | null {
  let j: unknown;
  try {
    j = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const str = (v: unknown, max = 200) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined);
  const id = str(o.id, 100);
  const kind = str(o.type, 40) as ProviderEvent["kind"] | undefined;
  const ref = str(o.ref, 100);
  const at = str(o.at, 40);
  if (!id || !kind || !EVENT_KINDS.has(kind) || !ref || !at) return null;
  const occurredAt = new Date(at);
  if (Number.isNaN(occurredAt.getTime())) return null;
  const version = typeof o.version === "number" && Number.isInteger(o.version) && o.version > 0 ? o.version : undefined;
  return {
    providerEventId: id,
    kind,
    providerRef: ref,
    token: str(o.token, 200),
    version,
    gateCode: str(o.gate, 100),
    reason: str(o.reason, 200),
    occurredAt,
  };
}

/** A signed sandbox event, as the sandbox would POST it to Maw3ed. */
export function signedSandboxEvent(body: Record<string, unknown>, nowSeconds = Math.floor(Date.now() / 1000)) {
  guard();
  const raw = JSON.stringify(body);
  const key = purposeKey("sandbox-webhook");
  if (!key) throw new Error("no key configured");
  const headers = new Headers({
    "content-type": "application/json",
    "x-sandbox-timestamp": String(nowSeconds),
    "x-sandbox-signature": signMessage(key, raw, nowSeconds),
  });
  return { raw, headers };
}

function eventId(): string {
  return `sbxevt_${randomBytes(12).toString("base64url")}`;
}

/**
 * The sandbox's gate: someone presents a code at a gate. Decides by the
 * sandbox's own store, as an external system would, and reports the
 * outcome as a signed event. Returns what the gate decided.
 */
export async function sandboxGateScan(
  token: string,
  gateCode: string | null,
  now: Date = new Date(),
  siteRef: string | null = null,
): Promise<{ granted: boolean; reason: string; event: { raw: string; headers: Headers } | null }> {
  guard();
  const pass = await db.sandboxAccessPass.findUnique({ where: { tokenHash: sha256(token.trim()) } });
  if (!pass) return { granted: false, reason: "unknown-code", event: null };
  const deny = (reason: string) => ({
    granted: false,
    reason,
    event: signedSandboxEvent({ id: eventId(), type: "ENTRY_DENIED", ref: pass.providerRef, gate: gateCode ?? undefined, reason, at: now.toISOString() }),
  });
  if (pass.status !== "ACTIVE") return deny(pass.status === "REVOKED" ? "revoked" : "not-active");
  // A pass for one venue opens nothing at another's gates.
  if (pass.siteRef && siteRef !== pass.siteRef) return deny("wrong-site");
  if (now < pass.validFrom) return deny("too-early");
  if (now >= pass.validUntil) return deny("expired");
  if (pass.entryUntil && now > pass.entryUntil && !pass.inside) return deny("late-entry-cutoff");
  if (pass.gateCodes.length && (!gateCode || !pass.gateCodes.includes(gateCode))) return deny("wrong-gate");
  // Anti-passback: once inside, the same code cannot let a second person in.
  if (pass.inside) return deny("already-inside");
  if (pass.entries > 0 && !pass.reentry) return deny("no-reentry");
  const claimed = await db.sandboxAccessPass.updateMany({
    where: { id: pass.id, inside: false, entries: pass.entries },
    data: { inside: true, entries: { increment: 1 } },
  });
  if (claimed.count === 0) return deny("already-inside");
  return {
    granted: true,
    reason: "ok",
    event: signedSandboxEvent({ id: eventId(), type: "ENTRY_GRANTED", ref: pass.providerRef, gate: gateCode ?? undefined, at: now.toISOString() }),
  };
}

/** Someone leaves through a gate (so they may re-enter where allowed). */
export async function sandboxGateExit(token: string, gateCode: string | null, now: Date = new Date()) {
  guard();
  const pass = await db.sandboxAccessPass.findUnique({ where: { tokenHash: sha256(token.trim()) } });
  if (!pass || !pass.inside) return { event: null };
  await db.sandboxAccessPass.update({ where: { id: pass.id }, data: { inside: false } });
  return { event: signedSandboxEvent({ id: eventId(), type: "EXIT", ref: pass.providerRef, gate: gateCode ?? undefined, at: now.toISOString() }) };
}

/** NO_CONFIRM mode's confirmations, sent when a test says so. */
export async function confirmPendingSandboxPasses(limit = 50) {
  guard();
  const pending = await db.sandboxAccessPass.findMany({ where: { status: "PENDING" }, take: limit });
  const events: { raw: string; headers: Headers }[] = [];
  for (const p of pending) {
    await db.sandboxAccessPass.update({ where: { id: p.id }, data: { status: "ACTIVE" } });
    events.push(
      signedSandboxEvent({ id: eventId(), type: "CREDENTIAL_ACTIVE", ref: p.providerRef, token: tokenFor(p.providerRef), version: p.version, at: new Date().toISOString() }),
    );
  }
  return events;
}

export const SANDBOX_SLUG = "sandbox";

/** The sandbox provider's row, created on first use where the sandbox is allowed. */
export async function ensureSandboxProvider() {
  guard();
  return db.accessProvider.upsert({
    where: { slug: SANDBOX_SLUG },
    create: { slug: SANDBOX_SLUG, kind: "SANDBOX", nameAr: "بيئة تجريبية (مش صالحة لأي بوابة)", nameEn: "Sandbox (not valid at any gate)" },
    update: {},
  });
}
