import { checkInWindow } from "./check-in";
import { wallToInstant } from "@/lib/bookings/instants";

/**
 * How long a customer's phone may keep a copy of their booking page for
 * use without a connection (public/sw.js keeps it, reading this from the
 * page's `maw3ed-offline-until` meta tag).
 *
 * Only while the page has a code to present — a check-in QR that is ready
 * or soon will be, or a visitor pass — and only until the booking's
 * check-in window closes (30 minutes after it ends). Null otherwise, and
 * the service worker then deletes any copy it holds: a cancelled,
 * finished or moved-away booking is not kept on the device.
 *
 * A kept copy cannot be misused: whether a code is good is decided online
 * when it is scanned, from the booking itself (lib/access/check-in.ts).
 */

interface Clock {
  status: string;
  date: Date;
  startTime: string;
  endTime: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

interface AccessShape {
  checkIn: { display: string };
  visitorAccess: { holder: { pass: unknown } | null; guests: { pass: unknown }[] };
}

export function offlineCopyUntil(booking: Clock, access: AccessShape | null, now: Date = new Date()): Date | null {
  if (!access) return null;
  const hasCode = access.checkIn.display === "ready" || access.checkIn.display === "not-yet";
  const hasPass = [access.visitorAccess.holder, ...access.visitorAccess.guests].some((p) => !!p?.pass);
  if (!hasCode && !hasPass) return null;
  // The window is in the bookings' wall-clock frame (Cairo time written as
  // UTC); the device compares with a real instant.
  const closes = checkInWindow(booking).closesAt;
  const until = wallToInstant(closes.toISOString().slice(0, 10), closes.getUTCHours() * 60 + closes.getUTCMinutes());
  return until > now ? until : null;
}
