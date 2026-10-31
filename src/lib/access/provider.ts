import type { AccessProvider } from "@prisma/client";

/**
 * The provider-neutral boundary between Maw3ed and whatever system runs
 * a venue's gates.
 *
 * Maw3ed decides who MAY request entry (lib/access/eligibility.ts). A
 * provider decides whether to issue a credential, issues it, and admits
 * or refuses people at its gates. Maw3ed never opens a gate and never
 * claims a credential works anywhere until the provider has confirmed it.
 *
 * Every operation a real integration needs is here, so adding one means
 * writing one adapter and nothing else:
 *
 *   provision   ask for a credential for one visitor and window
 *   update      the window, gates or re-entry changed
 *   revoke      withdraw it
 *   status      what the provider holds for one credential (reconciling)
 *   parseEvent  a signed callback from the provider → a validated event
 *   health      can we reach it at all
 *
 * Calls carry an idempotency key (the same call retried is the same
 * call) and a correlation id (every log line and event about one
 * credential shares it), and take an AbortSignal: the caller bounds
 * every call with a timeout (lib/access/sync.ts).
 *
 * The only adapter implemented is the SANDBOX (lib/access/sandbox.ts),
 * which imitates an external system and is refused wherever customers
 * are. A PARTNER provider has no adapter until a real agreement and
 * specification exist: every call to one fails as "not configured",
 * and nothing pretends otherwise. No real operator's endpoint, field
 * name or credential is written anywhere in this code.
 *
 * docs/architecture/ACCESS_PROVIDER_INTERFACE.md.
 */

export interface PassRequest {
  /** Maw3ed's id for the credential — the provider's "external reference". */
  externalRef: string;
  /** The venue's own reference at the provider (Venue.accessSiteRef). */
  siteRef: string | null;
  /** What the gate shows: a first name or a label, never a phone number. */
  holderLabel: string;
  /** Only when the venue requires it (NAME_AND_PHONE). */
  holderPhone: string | null;
  validFrom: Date;
  validUntil: Date;
  entryUntil: Date | null;
  /** The venue's gate codes (VenueGate.code), not Maw3ed ids. Empty = any gate. */
  gateCodes: string[];
  reentryAllowed: boolean;
  /** The entitlement version this request describes. */
  version: number;
}

export interface CallContext {
  idempotencyKey: string;
  correlationId: string;
  signal: AbortSignal;
}

/** The provider's answer to provision or update. */
export type IssueResult =
  /** Issued and confirmed now; `token` is what the holder presents. */
  | { outcome: "active"; providerRef: string; token: string; displayFormat: "QR" | "CODE"; expiresAt: Date | null; version: number }
  /** Accepted; the confirmation arrives later as an event. */
  | { outcome: "accepted"; providerRef: string }
  /** Refused for good (the provider said no). Not retried. */
  | { outcome: "refused"; reason: string };

export type RemoteStatus =
  | { found: true; status: "ACTIVE" | "REVOKED" | "EXPIRED" | "PENDING"; version: number }
  | { found: false };

/** A provider callback that passed signature, freshness and shape checks. */
export interface ProviderEvent {
  providerEventId: string;
  kind:
    | "CREDENTIAL_ACTIVE"
    | "CREDENTIAL_UPDATED"
    | "CREDENTIAL_REVOKED"
    | "CREDENTIAL_FAILED"
    | "ENTRY_GRANTED"
    | "ENTRY_DENIED"
    | "EXIT";
  providerRef: string;
  /** Present on CREDENTIAL_ACTIVE/UPDATED when the provider issued a token then. */
  token?: string;
  version?: number;
  gateCode?: string;
  reason?: string;
  occurredAt: Date;
}

export interface AccessProviderAdapter {
  readonly kind: "SANDBOX" | "PARTNER";
  provision(req: PassRequest, ctx: CallContext): Promise<IssueResult>;
  update(providerRef: string, req: PassRequest, ctx: CallContext): Promise<IssueResult>;
  revoke(providerRef: string, reason: string, ctx: CallContext): Promise<{ revoked: true }>;
  status(providerRef: string, ctx: CallContext): Promise<RemoteStatus>;
  /** Null when the signature, timestamp or shape is wrong. Never throws on bad input. */
  parseEvent(rawBody: string, headers: Headers): ProviderEvent | null;
  health(signal: AbortSignal): Promise<{ ok: boolean; detail: string }>;
}

/** A call that may succeed if tried again later (timeouts, outages, 5xx). */
export class TransientProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientProviderError";
  }
}

/** The provider cannot be used at all here (not configured, not allowed). */
export class ProviderUnavailableError extends Error {
  constructor(public readonly code: "not-configured" | "sandbox-not-allowed" | "disabled") {
    super(code);
    this.name = "ProviderUnavailableError";
  }
}

/**
 * Whether the sandbox provider may run. Never on Vercel (production or
 * preview — wherever real people might be) and never in a production
 * build unless ACCESS_SANDBOX=1 says this machine is a QA box; always in
 * development and tests. Every sandbox entry point checks this itself.
 */
export function sandboxAllowed(): boolean {
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ACCESS_SANDBOX === "1";
}

/** Whether a provider can be used for new passes here. */
export function providerUsable(p: Pick<AccessProvider, "kind" | "slug" | "isEnabled"> | null): boolean {
  if (!p || !p.isEnabled) return false;
  if (p.kind === "SANDBOX") return sandboxAllowed();
  return partnerAdapters.has(p.slug);
}

/**
 * Real adapters, by provider slug. Empty: no partner integration exists.
 * One is registered here when there is an agreement, a specification and
 * an approved integration test — not before.
 */
const partnerAdapters = new Map<string, AccessProviderAdapter>();

export async function adapterFor(p: Pick<AccessProvider, "kind" | "slug" | "isEnabled">): Promise<AccessProviderAdapter> {
  if (!p.isEnabled) throw new ProviderUnavailableError("disabled");
  if (p.kind === "SANDBOX") {
    if (!sandboxAllowed()) throw new ProviderUnavailableError("sandbox-not-allowed");
    const { sandboxAdapter } = await import("./sandbox");
    return sandboxAdapter;
  }
  const adapter = partnerAdapters.get(p.slug);
  if (!adapter) throw new ProviderUnavailableError("not-configured");
  return adapter;
}
