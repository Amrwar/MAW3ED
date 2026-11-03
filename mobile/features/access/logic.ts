import type { AccessPayload, PassState, PassView } from "@/types/access";
import type { Tone } from "@/design/tokens";

/**
 * The booking's check-in code and visitor passes: what to show, and when
 * to ask the server again. The server decides every state; this only
 * words them and keeps the asking bounded.
 */

/** While a pass is waiting on the access system: every POLL_MS, at most POLL_MAX times, then a "check again" button. */
export const POLL_MS = 4_000;
export const POLL_MAX = 10;

export function isWaiting(p: AccessPayload | undefined): boolean {
  if (!p) return false;
  return [p.visitorAccess.holder, ...p.visitorAccess.guests].some((x) => !!x && (x.state === "pending" || x.state === "withdrawing"));
}

/** The next poll delay, or false: never a poll without something waiting, and never past POLL_MAX. */
export function nextPoll(p: AccessPayload | undefined, pollsSoFar: number): number | false {
  return isWaiting(p) && pollsSoFar < POLL_MAX ? POLL_MS : false;
}

export const PASS_STATE: Record<PassState, { label: [ar: string, en: string]; tone: Tone }> = {
  ineligible: { label: ["مش مؤهل", "Not eligible"], tone: "neutral" },
  pending: { label: ["مستني موافقة نظام الدخول", "Waiting for the access system"], tone: "warn" },
  active: { label: ["فعّال", "Active"], tone: "ok" },
  updating: { label: ["فعّال — بيتحدّث بالميعاد الجديد", "Active — updating to the new time"], tone: "info" },
  suspended: { label: ["موقوف مؤقتًا", "Temporarily suspended"], tone: "warn" },
  revoked: { label: ["اتلغى", "Cancelled"], tone: "danger" },
  withdrawing: { label: ["بيتلغي", "Being cancelled"], tone: "danger" },
  expired: { label: ["انتهى", "Expired"], tone: "neutral" },
  failed: { label: ["ماتصدرش", "Not issued"], tone: "danger" },
};

/** A pass has a code to show only when the access system confirmed it — never before. */
export function showsCode(v: PassView): boolean {
  return (v.state === "active" || v.state === "updating") && !!v.pass && !!v.qrSvg;
}

/** Whether the holder may ask for a pass now (the server checks again). */
export function canAskForPass(p: AccessPayload): boolean {
  return p.visitorAccess.offered && p.visitorAccess.eligibility.eligible && !p.visitorAccess.holder;
}

/** Room for another named guest under the venue's limit. */
export function guestsLeft(p: AccessPayload): number {
  const live = p.visitorAccess.guests.filter((g) => g.state !== "revoked" && g.state !== "expired").length;
  return Math.max(0, p.visitorAccess.guestLimit - live);
}

/** A guest's own link, to send them (the website's pass page; the app opens it too). */
export function guestLink(base: string, inviteToken: string): string {
  return `${base.replace(/\/$/, "")}/pass/${inviteToken}`;
}
