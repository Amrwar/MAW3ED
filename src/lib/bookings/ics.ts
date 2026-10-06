/**
 * The appointment as a calendar event.
 *
 * An .ics file is the one format every calendar on every device
 * understands, and unlike a "add to Google Calendar" link it does not
 * send the customer's appointment to a third party to open it.
 */

export interface CalendarEvent {
  /** Stable across edits, so re-adding updates rather than duplicates. */
  uid: string;
  title: string;
  description?: string;
  location?: string;
  /** Cairo wall-clock. */
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  /** Bumped on every reschedule so calendars accept the update. */
  sequence?: number;
  url?: string;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
}

/**
 * Text in an .ics line has to escape these, and lines longer than 75
 * octets must be folded — calendars reject files that ignore either.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds a line to 75 octets, continuing with a leading space. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // 74 to leave room for the leading space on continuation lines.
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    // Never split a multi-byte character — Arabic is three bytes each.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((start === 0 ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return out.join("\r\n");
}

/** "20260310T140000" — local time, paired with a VTIMEZONE-free TZID. */
function localStamp(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Builds the file.
 *
 * Times carry TZID=Africa/Cairo rather than being converted to UTC: the
 * appointment is at 14:00 in Cairo whatever the clock does, and a
 * customer travelling abroad should still see it against the shop's
 * local time.
 */
export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Maw3ed//Booking//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;TZID=Africa/Cairo:${localStamp(event.date, event.startTime)}`,
    `DTEND;TZID=Africa/Cairo:${localStamp(event.date, event.endTime)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `STATUS:${event.status ?? "CONFIRMED"}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);

  // A reminder the evening before is what people actually want; the
  // business sends its own on the day.
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  // CRLF throughout, which the spec requires and some calendars enforce.
  return lines.map(fold).join("\r\n") + "\r\n";
}
