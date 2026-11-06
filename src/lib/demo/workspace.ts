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
  /** Arabic, and English for an English visitor; one typed in is both. */
  name: string;
  en: string;
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

/** A review left after a visit; the owner can answer it, as on /dashboard/reviews. */
export interface DemoReview {
  id: string;
  customerId: string;
  rating: number;
  ar: string;
  en: string;
  reply: string | null;
}

/** A discount code, as on /dashboard/offers: a percentage off with a code. */
export interface DemoOffer {
  id: string;
  code: string;
  percent: number;
  uses: number;
  active: boolean;
}

/** The notification settings the real settings page has. */
export interface DemoSettings {
  reminderEnabled: boolean;
  /** Hours before the appointment, from the same choices as the real form. */
  reminderLeadHours: number;
  autoConfirm: boolean;
}

export interface DemoState {
  services: DemoService[];
  staff: DemoStaff[];
  customers: DemoCustomer[];
  bookings: DemoBooking[];
  hours: DayHoursRule[];
  reviews: DemoReview[];
  offers: DemoOffer[];
  settings: DemoSettings;
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
  en: `Sample customer ${i + 1}`,
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

const REVIEWS: DemoReview[] = [
  { id: "r-1", customerId: "c-1", rating: 5, ar: "مواعيد مظبوطة وشغل نضيف. الحجز من اللينك خلّص في دقيقة.", en: "On time and neat work. Booking from the link took a minute.", reply: "شكرًا! مستنيينك المرة الجاية." },
  { id: "r-2", customerId: "c-2", rating: 4, ar: "الخدمة كويسة، بس استنيت شوية.", en: "Good service, though I waited a little.", reply: null },
  { id: "r-3", customerId: "c-6", rating: 5, ar: "التذكير على واتساب فكّرني بالميعاد. ممتاز.", en: "The WhatsApp reminder saved me. Excellent.", reply: null },
];

const OFFERS: DemoOffer[] = [
  { id: "o-1", code: "WELCOME10", percent: 10, uses: 4, active: true },
];

const SETTINGS: DemoSettings = { reminderEnabled: true, reminderLeadHours: 24, autoConfirm: false };

/** Reminder lead times the real settings form offers. */
export const REMINDER_LEAD_CHOICES = [1, 2, 3, 6, 12, 24, 48, 72] as const;

/** A fresh copy every time, so a reset really resets. */
export function initialDemoState(): DemoState {
  return structuredClone({
    services: SERVICES, staff: STAFF, customers: CUSTOMERS, bookings: BOOKINGS, hours: HOURS,
    reviews: REVIEWS, offers: OFFERS, settings: SETTINGS,
  });
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
  const typed = input.customerName.trim();
  const customer: DemoCustomer = {
    id,
    name: typed || `عميل تجريبي ${state.customers.length + 1}`,
    en: typed || `Sample customer ${state.customers.length + 1}`,
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


/** The owner's answer to a review; an empty one removes it. */
export function demoReply(state: DemoState, reviewId: string, text: string): DemoState {
  const reply = text.trim() || null;
  return { ...state, reviews: state.reviews.map((r) => (r.id === reviewId ? { ...r, reply } : r)) };
}

/**
 * A new discount code, or null with the reason it was refused: the same
 * shape of rule as the real form (letters and digits, a sensible percent,
 * no duplicate codes).
 */
export function demoAddOffer(
  state: DemoState,
  rawCode: string,
  percent: number,
): { state: DemoState } | { error: "code" | "percent" | "duplicate" } {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,15}$/.test(code)) return { error: "code" };
  if (!Number.isInteger(percent) || percent < 5 || percent > 90) return { error: "percent" };
  if (state.offers.some((o) => o.code === code)) return { error: "duplicate" };
  return {
    state: { ...state, offers: [...state.offers, { id: `o-new-${state.offers.length + 1}`, code, percent, uses: 0, active: true }] },
  };
}

export function demoToggleOffer(state: DemoState, offerId: string): DemoState {
  return { ...state, offers: state.offers.map((o) => (o.id === offerId ? { ...o, active: !o.active } : o)) };
}

export function demoSetSettings(state: DemoState, patch: Partial<DemoSettings>): DemoState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

/** The home screen's numbers for "today". Expected revenue counts what is still to happen too. */
export function demoOverview(state: DemoState) {
  const live = state.bookings.filter((b) => b.status !== "CANCELLED");
  const price = (b: DemoBooking) => service(state, b.serviceId)?.price ?? 0;
  const rated = state.reviews.length ? state.reviews.reduce((s, r) => s + r.rating, 0) / state.reviews.length : 0;
  return {
    today: live.length,
    pending: live.filter((b) => b.status === "PENDING").length,
    expected: live.filter((b) => b.status !== "NO_SHOW").reduce((s, b) => s + price(b), 0),
    earned: live.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + price(b), 0),
    rating: Math.round(rated * 10) / 10,
    unanswered: state.reviews.filter((r) => !r.reply).length,
  };
}

export const serviceOf = service;
