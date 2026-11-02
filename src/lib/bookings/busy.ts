import { err } from "@/lib/api";
import { isBookingQueueBusy } from "./queue";

/**
 * "Busy, try again" for a write that found no turn in the business's
 * booking queue — said as the public booking route says it, with a
 * Retry-After the app and the widget already treat as retryable. Null
 * for any other error. Nothing was written.
 */
export function queueBusyResponse(e: unknown, en = false): Response | null {
  if (!isBookingQueueBusy(e)) return null;
  const res = err(en ? "Busy right now. Try again in a few seconds." : "الضغط عالي دلوقتي، جرّب تاني بعد ثواني", 503, { code: "busy" });
  res.headers.set("Retry-After", "2");
  return res;
}
