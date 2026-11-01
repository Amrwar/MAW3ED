import { db } from "@/lib/db";
import { cairoDayStart, wallToInstant } from "@/lib/bookings/instants";
import { resyncLiveAccess } from "./hooks";
import { providerUsable } from "./provider";
import { reasonText } from "./eligibility";

/**
 * What a venue's operators and security desk see of visitor passes.
 *
 * Data minimisation is the rule here. The desk needs to know who may
 * come in, when, through which gates, the pass's state and what happened
 * at the gates — so it sees the visitor's name, the business they are
 * visiting (a tenant the venue already lists), the window and the state.
 * It never sees what was booked, the price, a payment, the booking's
 * reference or link, or a phone number (only whether one is on file
 * when the venue requires it).
 */

export interface DeskRow {
  entitlementId: string;
  visitorName: string;
  role: "HOLDER" | "GUEST";
  businessName: string;
  status: string;
  reason: string | null;
  /** The reason in words, for the desk; `reason` stays the code. */
  reasonText: string | null;
  validFrom: string;
  validUntil: string;
  entryUntil: string | null;
  gates: string[];
  reentryAllowed: boolean;
  phoneOnFile: boolean;
  pass: { status: string; confirmedAt: string | null; lastError: string | null } | null;
  lastEvent: { kind: string; at: string; gate: string | null } | null;
}

const DAY = 24 * 60 * 60_000;

/** Passes whose window touches the given Cairo day (default today). */
export async function venueDesk(venueId: string, day?: string) {
  const from = day ? wallToInstant(day, 0) : cairoDayStart();
  const until = new Date(from.getTime() + DAY);
  const [venue, ents, events, escalations] = await Promise.all([
    db.venue.findUnique({
      where: { id: venueId },
      select: {
        accessEnabled: true, accessSiteRef: true,
        accessProvider: { select: { slug: true, kind: true, nameAr: true, nameEn: true, isEnabled: true, lastHealthAt: true, lastHealthOk: true, lastHealthDetail: true } },
        gates: { select: { id: true, nameAr: true, code: true } },
        policy: { select: { escalationContact: true, identityRequirement: true } },
      },
    }),
    db.accessEntitlement.findMany({
      where: { venueId, validFrom: { lt: until }, validUntil: { gt: from } },
      orderBy: { validFrom: "asc" },
      take: 500,
      select: {
        id: true, status: true, reason: true, validFrom: true, validUntil: true, entryUntil: true, allowedGateIds: true, reentryAllowed: true,
        visitor: { select: { displayName: true, phoneE164: true } },
        bookingGuest: { select: { role: true, booking: { select: { business: { select: { nameAr: true } } } } } },
        credentials: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, confirmedAt: true, lastError: true } },
      },
    }),
    db.accessEvent.findMany({
      where: { venueId, occurredAt: { gte: new Date(from.getTime() - DAY) } },
      orderBy: { occurredAt: "desc" },
      take: 200,
      select: { kind: true, occurredAt: true, gateId: true, entitlementId: true, reason: true, actorUserId: true },
    }),
    db.accessEvent.findMany({
      where: { venueId, kind: { in: ["ESCALATION", "PROVIDER_ERROR", "CREDENTIAL_FAILED"] }, occurredAt: { gte: new Date(Date.now() - 7 * DAY) } },
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: { id: true, kind: true, occurredAt: true, reason: true, entitlementId: true },
    }),
  ]);
  if (!venue) return null;
  const gateName = (id: string | null) => (id ? venue.gates.find((g) => g.id === id)?.nameAr ?? null : null);
  const lastByEnt = new Map<string, (typeof events)[number]>();
  for (const e of events) if (e.entitlementId && !lastByEnt.has(e.entitlementId)) lastByEnt.set(e.entitlementId, e);

  const rows: DeskRow[] = ents.map((e) => {
    const last = lastByEnt.get(e.id);
    const c = e.credentials[0];
    return {
      entitlementId: e.id,
      visitorName: e.visitor.displayName,
      role: e.bookingGuest.role,
      businessName: e.bookingGuest.booking.business.nameAr,
      status: e.status,
      reason: e.reason,
      reasonText: reasonText(e.reason, false),
      validFrom: e.validFrom.toISOString(),
      validUntil: e.validUntil.toISOString(),
      entryUntil: e.entryUntil?.toISOString() ?? null,
      gates: e.allowedGateIds.map(gateName).filter((x): x is string => !!x),
      reentryAllowed: e.reentryAllowed,
      phoneOnFile: !!e.visitor.phoneE164,
      pass: c ? { status: c.status, confirmedAt: c.confirmedAt?.toISOString() ?? null, lastError: c.lastError } : null,
      lastEvent: last ? { kind: last.kind, at: last.occurredAt.toISOString(), gate: gateName(last.gateId) } : null,
    };
  });

  return {
    settings: {
      accessEnabled: venue.accessEnabled,
      siteRef: venue.accessSiteRef,
      provider: venue.accessProvider
        ? {
            slug: venue.accessProvider.slug,
            kind: venue.accessProvider.kind,
            name: venue.accessProvider.nameAr,
            usable: providerUsable(venue.accessProvider),
            health: venue.accessProvider.lastHealthAt
              ? { at: venue.accessProvider.lastHealthAt.toISOString(), ok: venue.accessProvider.lastHealthOk, detail: venue.accessProvider.lastHealthDetail }
              : null,
          }
        : null,
      escalationContact: venue.policy?.escalationContact ?? null,
      identityRequirement: venue.policy?.identityRequirement ?? "NAME",
    },
    rows,
    events: events.slice(0, 100).map((e) => ({ kind: e.kind, at: e.occurredAt.toISOString(), gate: gateName(e.gateId), reason: reasonText(e.reason, false), byStaff: !!e.actorUserId })),
    attention: escalations.map((e) => ({ id: e.id, kind: e.kind, at: e.occurredAt.toISOString(), reason: reasonText(e.reason, false) })),
  };
}

/**
 * Something about the venue changed that passes depend on (passes
 * switched on or off, the policy, a notice): decide its live passes
 * again, after the response, bounded. The cron catches whatever this
 * does not reach.
 */
export function venueAccessChanged(venueId: string): void {
  resyncLiveAccess({ venueId });
}
