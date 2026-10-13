import { dayWindow, type StaffDayRule } from "@/lib/bookings/availability";
import { minutesToTime } from "@/lib/bookings/time";
import type { DayHours } from "./hours";

/**
 * When one staff member can be booked, week by week, for a profile to
 * show. Each day is the availability engine's own window
 * (lib/bookings/availability.ts dayWindow) — the business must be open,
 * the member must work that weekday, and their own hours narrow the
 * business's — so the hours shown are the hours booking uses.
 */
export function staffWeek(
  businessHours: DayHours[],
  workingDays: number[],
  staffHours: StaffDayRule[],
): DayHours[] {
  return businessHours.map((rule) => {
    const day = dayWindow(businessHours, rule.dayOfWeek, { workingDays, hours: staffHours });
    if ("reason" in day) return { ...rule, isClosed: true };
    return {
      dayOfWeek: rule.dayOfWeek,
      openTime: minutesToTime(day.window.start),
      // A window running to midnight is shown ending at 23:59, not "24:00".
      closeTime: day.window.end >= 24 * 60 ? "23:59" : minutesToTime(day.window.end),
      isClosed: false,
    };
  });
}
