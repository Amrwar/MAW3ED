/**
 * Booking check-in codes and venue visitor passes, as the server sends
 * them (src/lib/access/customer.ts, src/components/access/PassCard.tsx).
 * The app shows what the server says and never decides a state itself:
 * a pass is active only when the venue's access system confirmed it.
 */

export type PassState =
  | "ineligible"
  | "pending"
  | "active"
  | "updating"
  | "suspended"
  | "revoked"
  | "expired"
  | "failed"
  | "withdrawing";

export interface PassView {
  guestId: string;
  role: "HOLDER" | "GUEST";
  displayName: string;
  state: PassState;
  reason: string | null;
  validFrom: string | null;
  validUntil: string | null;
  entryUntil: string | null;
  gates: string[];
  reentryAllowed: boolean;
  pass: { token: string; format: string; sandbox: boolean } | null;
  canRetry: boolean;
  /** The guest's own link token (holder's view only). */
  inviteToken?: string;
  qrSvg?: string | null;
}

export interface AccessPayload {
  checkIn: {
    display: "ready" | "not-yet" | "checked-in" | "unavailable";
    url: string | null;
    qrSvg: string | null;
    opensAt: string | null;
    closesAt: string | null;
    checkedInAt: string | null;
  };
  visitorAccess: {
    offered: boolean;
    venue: { id: string; name: string; instructions: string | null } | null;
    sandbox: boolean;
    eligibility: { eligible: boolean; reason: string | null };
    guestLimit: number;
    identityRequirement: "NAME" | "NAME_AND_PHONE";
    holder: PassView | null;
    guests: PassView[];
  };
}

/** GET /api/pass/<inviteToken>: one guest's own pass, and nothing about the booking. */
export interface GuestPassPayload {
  venue: { name: string; instructions: string | null } | null;
  sandbox: boolean;
  pass: PassView;
}
