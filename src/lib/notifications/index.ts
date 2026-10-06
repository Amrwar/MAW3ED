/**
 * Maw3ed's notification system.
 *
 * Everything that tells somebody something goes through `notify`:
 *
 *     await notify({ type: "booking.confirmed", bookingId });
 *
 * The caller says what happened and nothing else. Who hears about it,
 * on which channels, in what words, and whether it has already been
 * sent are all decided here — which is how a call site is unable to
 * send the business the customer's phone number, or to send the same
 * reminder twice because a cron overlapped itself.
 *
 * The WhatsApp templates and the hand-written booking emails that were
 * here first are untouched and still used; this gives them one place to
 * be called from and a record of what went out.
 */
export { notify, type DispatchOutcome } from "./dispatch";
export {
  EVENT_AUDIENCE,
  EVENT_KIND,
  dedupeKey,
  type Audience,
  type EventType,
  type NotificationEvent,
} from "./events";
export { copyFor, smsText, type Copy, type CopyContext } from "./copy";
export {
  businessRecipient,
  customerRecipient,
  type BookingSubject,
  type BusinessSubject,
  type Recipient,
} from "./recipients";
