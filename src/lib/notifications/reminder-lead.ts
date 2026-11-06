/**
 * How long before an appointment a reminder can go out, in hours: the
 * choices on the settings page. The API accepts any whole hour from 1 to
 * 72 (api/business/settings/notifications); the demo offers these same
 * choices, so it shows the product as it is.
 */
export const REMINDER_LEAD_HOURS = [1, 2, 3, 6, 12, 24, 48, 72] as const;
