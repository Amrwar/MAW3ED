/**
 * The demo workspace: a fictional business to try the dashboard on.
 *
 * Everything here is invented and lives in the visitor's browser. This
 * module imports no database client, no API helper and no session, and
 * nothing in it calls fetch — demo.test.ts checks that — so the demo
 * cannot read or change a real business, customer or booking however
 * it is used. Slots come from the real availability engine (a pure
 * function), so the demo books the way the product books.
 */

import { computeStaffedAvailability, type DayHoursRule, type StaffDayRule } from "@/lib/bookings/availability";
import { minutesToTime, timeToMinutes } from "@/lib/bookings/time";

export interface DemoService {
  id: string;
  ar: string;
  en: string;
  duration: number;
  price: number;
}

export interface DemoStaff {
  id: string;
  ar: string;
  en: string;
  workingDays: number[];
}

export interface DemoCustomer {
  id: string;
  name: string;
  /** Visibly fake: 0100 000 0xxx. */
  phone: string;
  visits: number;
}

export type DemoStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

export interface DemoBooking {
  id: string;
  customerId: string;
  serviceId: string;
  staffId: string;
  /** Minutes from midnight, on the demo's "today". */
  start: number;
  status: DemoStatus;
}

export interface DemoState {
  services: DemoService[];
  staff: DemoStaff[];
  customers: DemoCustomer[];
  bookings: DemoBooking[];
  hours: DayHoursRule[];
}

export const DEMO_BUSINESS = { ar: "صالون تجريبي", en: "Sample Salon" } as const;

const SERVICES: DemoService[] = [
  { id: "s-cut", ar: "قص شعر", en: "Haircut", duration: 30, price: 120 },
  { id: "s-beard", ar: "تهذيب ذقن", en: "Beard trim", duration: 20, price: 70 },
  { id: "s-combo", ar: "قص وذقن", en: "Cut & beard", duration: 45, price: 170 },
  { id: "s-color", ar: "صبغة", en: "Colour", duration: 60, price: 300 },
];

const STAFF: DemoStaff[] = [
  { id: "t-1", ar: "كريم (تجريبي)", en: "Karim (sample)", workingDays: [0, 1, 2, 3, 4, 6] },
  { id: "t-2", ar: "يوسف (تجريبي)", en: "Youssef (sample)", workingDays: [0, 1, 2, 3, 4, 5, 6] },
];

const NAMES = ["عميل تجريبي ١", "عميل تجريبي ٢", "عميل تجريبي ٣", "عميل تجريبي ٤", "عميل تجريبي ٥", "عميل تجريبي ٦"];

const CUSTOMERS: DemoCustomer[] = NAMES.map((name, i) => ({
  id: `c-${i + 1}`,
  name,
  phone: `0100 000 0${String(100 + i).padStart(3, "0")}`,
  visits: [5, 1, 3, 0, 2, 7][i] ?? 0,
}));

const HOURS: DayHoursRule[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d,
  openTime: d === 5 ? "14:00" : "10:00",
  closeTime: "22:00",
  isClosed: false,
}));

const BOOKINGS: DemoBooking[] = [
  { id: "b-1", customerId: "c-1", serviceId: "s-cut", staffId: "t-1", start: 10 * 60 + 30, status: "COMPLETED" },
  { id: "b-2", customerId: "c-2", serviceId: "s-combo", staffId: "t-2", start: 11 * 60, status: "COMPLETED" },
  { id: "b-3", customerId: "c-3", serviceId: "s-beard", staffId: "t-1", start: 13 * 60, status: "NO_SHOW" },
  { id: "b-4", customerId: "c-4", serviceId: "s-color", staffId: "t-2", start: 15 * 60, status: "CONFIRMED" },
  { id: "b-5", customerId: "c-5", serviceId: "s-cut", staffId: "t-1", start: 17 * 60, status: "CONFIRMED" },
  { id: "b-6", customerId: "c-6", serviceId: "s-combo", staffId: "t-2", start: 18 * 60 + 30, status: "PENDING" },
];

/** A fresh copy every time, so a reset really resets. */
export function initialDemoState(): DemoState {
  return structuredClone({ services: SERVICES, staff: STAFF, customers: CUSTOMERS, bookings: BOOKINGS, hours: HOURS });
}

const service = (s: DemoState, id: string) => s.services.find((x) => x.id === id);

/**
 * Free start times today for a service, from the real engine. `staffId`
 * null means "anyone available"; the result says who would take each.
 */
export function demoSlots(
  state: DemoState,
  serviceId: string,
  staffId: string | null,
  dayOfWeek: number,
  nowMinutes: number,
): { slots: string[]; assignments: Record<string, string> } {
  const svc = service(state, serviceId);
  if (!svc) return { slots: [], assignments: {} };
  const live = state.bookings.filter((b) => b.status !== "CANCELLED");
  const staffHours = (st: DemoStaff): StaffDayRule[] =>
    st.workingDays.map((d) => ({ dayOfWeek: d, startTime: "00:00", endTime: "23:59", isOff: false }));
  const result = computeStaffedAvailability(
    {
      date: "2000-01-01",
      dayOfWeek,
      today: "2000-01-01",
      nowMinutes,
      daysFromToday: 0,
      serviceDuration: svc.duration,
      policy: { bufferMinutes: 0, minNoticeMinutes: 0, maxAdvanceDays: 30, sameDayCutoff: null },
      businessHours: state.hours,
      branchId: null,
      blocks: [],
      bookings: live.map((b) => ({
        startMin: b.start,
        endMin: b.start + (service(state, b.serviceId)?.duration ?? 30),
        staffMemberId: b.staffId,
        resourceId: null,
      })),
      resourceId: null,
    },
    state.staff.map((st) => ({ id: st.id, workingDays: st.workingDays, hours: staffHours(st) })),
    staffId,
  );
  return { slots: result.slots, assignments: result.assignments };
}

/** Books a slot in the demo state; returns a new state, never mutates. */
export function demoBook(
  state: DemoState,
  input: { serviceId: string; staffId: string; time: string; customerName: string },
): DemoState {
  const id = `c-new-${state.customers.length + 1}`;
  const customer: DemoCustomer = {
    id,
    name: input.customerName.trim() || `عميل تجريبي ${state.customers.length + 1}`,
    phone: `0100 000 0${String(100 + state.customers.length).padStart(3, "0")}`,
    visits: 0,
  };
  return {
    ...state,
    customers: [...state.customers, customer],
    bookings: [
      ...state.bookings,
      {
        id: `b-new-${state.bookings.length + 1}`,
        customerId: id,
        serviceId: input.serviceId,
        staffId: input.staffId,
        start: timeToMinutes(input.time),
        status: "PENDING",
      },
    ],
  };
}

export function demoSetStatus(state: DemoState, bookingId: string, status: DemoStatus): DemoState {
  return { ...state, bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, status } : b)) };
}

/** The report, counted the way the real one is: revenue from completed visits only. */
export function demoReport(state: DemoState) {
  const by = (s: DemoStatus) => state.bookings.filter((b) => b.status === s);
  const completed = by("COMPLETED");
  return {
    total: state.bookings.filter((b) => b.status !== "CANCELLED").length,
    completed: completed.length,
    noShows: by("NO_SHOW").length,
    pending: by("PENDING").length,
    revenue: completed.reduce((sum, b) => sum + (service(state, b.serviceId)?.price ?? 0), 0),
    perStaff: state.staff.map((st) => ({
      id: st.id,
      ar: st.ar,
      en: st.en,
      bookings: state.bookings.filter((b) => b.staffId === st.id && b.status !== "CANCELLED").length,
      minutes: state.bookings
        .filter((b) => b.staffId === st.id && b.status !== "CANCELLED")
        .reduce((m, b) => m + (service(state, b.serviceId)?.duration ?? 0), 0),
    })),
  };
}

export const clockOf = (minutes: number) => minutesToTime(minutes);
