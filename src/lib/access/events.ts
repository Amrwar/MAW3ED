import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { adapterFor, ProviderUnavailableError, type ProviderEvent } from "./provider";
import { activate, confirmRevoked } from "./sync";

/**
 * Callbacks from access providers.
 *
 * A callback is believed only after the provider's adapter has checked
 * its signature and freshness (a captured callback replayed later, or
 * one forged, is refused) and its shape. It is then:
 *
 *   - applied idempotently — confirming a credential is conditional on
 *     its state and version, so the same confirmation twice, or an old
 *     one arriving after a newer one, changes nothing;
 *   - recorded once — AccessEvent is unique on (provider, provider's
 *     event id), so a provider retrying a delivery is answered "already
 *     have it" and not counted twice.
 *
 * Effects never revive what Maw3ed withdrew: a credential that is being
 * revoked stays revoked whatever the provider says about it afterwards.
 * Entry and exit events are recorded for the venue's security desk; they
 * change nothing about the booking.
 */

export type IngestOutcome = "accepted" | "duplicate" | "invalid" | "unknown-provider" | "unavailable" | "unknown-credential";

export async function ingestProviderEvent(slug: string, rawBody: string, headers: Headers): Promise<IngestOutcome> {
  const provider = await db.accessProvider.findUnique({ where: { slug } });
  if (!provider || !provider.isEnabled) return "unknown-provider";
  let adapter;
  try {
    adapter = await adapterFor(provider);
  } catch (e) {
    if (e instanceof ProviderUnavailableError) return "unavailable";
    throw e;
  }
  const ev = adapter.parseEvent(rawBody, headers);
  if (!ev) return "invalid";
  return applyProviderEvent(provider.id, ev);
}

/** Applies an already-validated event. Exported for the sandbox gate and tests. */
export async function applyProviderEvent(providerId: string, ev: ProviderEvent): Promise<IngestOutcome> {
  const seen = await db.accessEvent.findUnique({ where: { providerId_providerEventId: { providerId, providerEventId: ev.providerEventId } }, select: { id: true } });
  if (seen) return "duplicate";

  const credential = await db.accessCredential.findUnique({
    where: { providerId_providerRef: { providerId, providerRef: ev.providerRef } },
    include: { entitlement: { select: { venueId: true, venue: { select: { gates: { select: { id: true, code: true } } } } } } },
  });
  if (!credential) {
    log.warn("[access] event for an unknown credential", { providerId, kind: ev.kind });
    return "unknown-credential";
  }

  switch (ev.kind) {
    case "CREDENTIAL_ACTIVE":
    case "CREDENTIAL_UPDATED":
      await activate(credential, { token: ev.token ?? null, displayFormat: ev.token ? "QR" : null, expiresAt: null, version: ev.version ?? null }, ev.occurredAt, ev.providerEventId);
      break;
    case "CREDENTIAL_REVOKED":
      if (credential.status === "REVOKE_PENDING") {
        await confirmRevoked(credential.id, ev.occurredAt);
      } else if (credential.status === "ACTIVE" || credential.status === "PENDING_PROVIDER") {
        // Withdrawn by the provider on its own: the holder sees it failed
        // and may ask again; nothing re-issues it automatically.
        await db.accessCredential.updateMany({
          where: { id: credential.id, status: { in: ["ACTIVE", "PENDING_PROVIDER"] } },
          data: { status: "FAILED", lastError: `revoked by the provider${ev.reason ? `: ${ev.reason.slice(0, 150)}` : ""}` },
        });
      }
      break;
    case "CREDENTIAL_FAILED":
      await db.accessCredential.updateMany({
        where: { id: credential.id, status: "PENDING_PROVIDER" },
        data: { status: "FAILED", lastError: (ev.reason ?? "refused by the provider").slice(0, 500) },
      });
      break;
    default:
      break; // ENTRY_GRANTED / ENTRY_DENIED / EXIT: recorded below
  }

  const gateId = ev.gateCode ? credential.entitlement.venue.gates.find((g) => g.code === ev.gateCode)?.id ?? null : null;
  try {
    await db.accessEvent.create({
      data: {
        venueId: credential.entitlement.venueId,
        providerId,
        credentialId: credential.id,
        entitlementId: credential.entitlementId,
        gateId,
        kind: ev.kind,
        providerEventId: ev.providerEventId,
        occurredAt: ev.occurredAt,
        reason: ev.reason ?? null,
        correlationId: credential.correlationId,
        details: ev.version ? { version: ev.version } : undefined,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return "duplicate"; // a concurrent delivery of the same event
    throw e;
  }
  return "accepted";
}
