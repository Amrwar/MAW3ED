import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/lib/db";
import { e164, normalisePhone } from "@/lib/phone";
import { checkInUrl, checkInWindow, currentCheckInCode, scanState, wallTime, type ScanState } from "./check-in";
import { bookingAccessView, type BookingAccessView, type PassView } from "./passes";

/**
 * What the customer's booking screen shows about getting in — the same
 * JSON for the web page and the mobile app, so neither invents its own
 * rules. Reached with the booking's manage link (Booking.accessToken),
 * the credential a customer already holds for their own booking.
 *
 * Two things, never confused on screen:
 *
 *   checkIn        the booking's QR for the business's front desk;
 *   visitorAccess  a venue's visitor pass, if the venue offers them —
 *                  a separate code, issued by the venue's access
 *                  provider, with its own state.
 */

export type CheckInDisplay = "ready" | "not-yet" | "checked-in" | "unavailable";

export interface CustomerAccessPayload {
  checkIn: {
    display: CheckInDisplay;
    state: ScanState | null;
    /** The QR's content: our /c/<code> URL. Absent unless it can be shown. */
    url: string | null;
    qrSvg: string | null;
    opensAt: string | null;
    closesAt: string | null;
    checkedInAt: string | null;
  };
  visitorAccess: BookingAccessView;
}

function display(state: ScanState | null): CheckInDisplay {
  if (state === "valid") return "ready";
  if (state === "too-early") return "not-yet";
  if (state === "checked-in" || state === "completed") return "checked-in";
  return "unavailable";
}

export async function qrSvg(content: string): Promise<string> {
  // M, not H: the screen is not scuffed like a sticker, and a denser code
  // is harder for a front-desk camera to read off a phone.
  return QRCode.toString(content, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
}

export async function customerAccessPayload(bookingId: string, en: boolean): Promise<CustomerAccessPayload | null> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, date: true, startTime: true, endTime: true, startsAt: true, endsAt: true, checkIn: { select: { checkedInAt: true } } },
  });
  if (!b) return null;
  const state = scanState(b);
  const shown = state === "valid" || state === "too-early";
  const code = shown ? await currentCheckInCode(b.id) : null;
  const url = code ? checkInUrl(code.code) : null;
  const window = checkInWindow(b);
  return {
    checkIn: {
      display: display(code || !shown ? state : null),
      state,
      url,
      qrSvg: url ? await qrSvg(url) : null,
      opensAt: wallTime(window.opensAt),
      closesAt: wallTime(window.closesAt),
      checkedInAt: b.checkIn?.checkedInAt?.toISOString() ?? null,
    },
    visitorAccess: await withPassQr(await bookingAccessView(b.id, en)),
  };
}

/** Adds the QR picture to every pass that has something to present. */
export async function passQr<T extends PassView>(v: T): Promise<T & { qrSvg: string | null }> {
  return { ...v, qrSvg: v.pass ? await qrSvg(v.pass.token) : null };
}

async function withPassQr(view: BookingAccessView): Promise<BookingAccessView> {
  return {
    ...view,
    holder: view.holder ? await passQr(view.holder) : null,
    guests: await Promise.all(view.guests.map(passQr)),
  };
}

export const visitorSchema = z.object({
  displayName: z.string().trim().min(2, "اكتب الاسم").max(80),
  phone: z.string().trim().max(30).optional().nullable(),
});

/** The phone as stored on a Visitor (+E.164), or null; "invalid" when given but unreadable. */
export function visitorPhone(raw: string | null | undefined): string | null | "invalid" {
  if (!raw) return null;
  const n = normalisePhone(raw);
  return n ? e164(n) : "invalid";
}
