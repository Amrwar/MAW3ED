import { cairoToday, weekdayOf } from "@/design/calendar";
import { staffFor, profileKind } from "@/features/profile/profile";
import { ApiError, NetworkError, UnauthorizedError } from "@/lib/api/errors";
import type { DayHours, PublicProfile, PublicResource, PublicStaffMember } from "@/types/api";

/**
 * The booking flow, as rules rather than screens.
 *
 * Nothing here decides availability, price or whether a booking stands —
 * the server does all three (lib/bookings/create.ts re-derives the slot,
 * the quote route prices it, the webhook confirms a deposit). This file
 * decides only which questions to ask, in what order, and what the app
 * sends, so the screens stay thin and the rules can be tested.
 *
 * The questions mirror the website's widget (BookingWidget.tsx): a
 * person is asked for when the service has people to choose from and
 * "anyone" is allowed; a branch when there is more than one; a table,
 * room or chair when the business schedules on them, and then one must
 * be picked. A restaurant is never asked about staff.
 */

export type Step = "service" | "staff" | "branch" | "resource" | "when" | "details" | "summary";

export type Lang = "ar" | "en";

export interface Draft {
  serviceId: string | null;
  /** Null is "anyone available". */
  staffId: string | null;
  branchId: string | null;
  resourceId: string | null;
  partySize: number;
  date: string | null;
  time: string | null;
  name: string;
  email: string;
  notes: string;
  /** A coupon the customer typed; the server prices it. */
  code: string;
  step: Step;
}

export const EMPTY_DRAFT: Draft = {
  serviceId: null,
  staffId: null,
  branchId: null,
  resourceId: null,
  partySize: 2,
  date: null,
  time: null,
  name: "",
  email: "",
  notes: "",
  code: "",
  step: "service",
};

type Profile = Pick<PublicProfile, "services" | "staff" | "branches" | "resources" | "businessType" | "category" | "policies" | "hours">;

/** Who can perform the chosen service. A restaurant offers nobody. */
export function peopleFor(p: Profile, serviceId: string | null): PublicStaffMember[] {
  if (!serviceId || profileKind(p) === "dining") return [];
  return staffFor(p.staff, serviceId);
}

/** What can be held at the chosen branch: its own and the shared ones. */
export function resourcesFor(p: Profile, branchId: string | null): PublicResource[] {
  if (p.branches.length <= 1 || !branchId) return p.resources;
  return p.resources.filter((r) => r.branchId === null || r.branchId === branchId);
}

/** Party size is asked when a resource counts seats, not because it is a restaurant. */
export function asksPartySize(resources: PublicResource[]): boolean {
  return resources.some((r) => r.capacity !== null);
}

/** The steps this business asks, in order. Left out entirely when they do not apply. */
export function stepsFor(p: Profile, d: Pick<Draft, "serviceId" | "branchId">): Step[] {
  const steps: Step[] = ["service"];
  // Before a service is chosen, count the person step if any service
  // would ask it — so "Step 1 of 5" does not become "Step 2 of 6".
  const asksPerson = d.serviceId
    ? peopleFor(p, d.serviceId).length > 0
    : p.services.some((s) => peopleFor(p, s.id).length > 0);
  if (asksPerson) steps.push("staff");
  if (p.branches.length > 1) steps.push("branch");
  if (resourcesFor(p, d.branchId).length > 0) steps.push("resource");
  steps.push("when", "details", "summary");
  return steps;
}

/** Whether the answer on this step is complete enough to go on. */
export function canAdvance(p: Profile, d: Draft, step: Step): boolean {
  switch (step) {
    case "service":
      return d.serviceId !== null && p.services.some((s) => s.id === d.serviceId);
    case "staff":
      // "Anyone" is an answer.
      return d.staffId === null || peopleFor(p, d.serviceId).some((m) => m.id === d.staffId);
    case "branch":
      return d.branchId !== null && p.branches.some((b) => b.id === d.branchId);
    case "resource": {
      const r = resourcesFor(p, d.branchId).find((x) => x.id === d.resourceId);
      return Boolean(r) && !tooSmall(r as PublicResource, d.partySize);
    }
    case "when":
      return d.date !== null && d.time !== null;
    case "details":
      return detailsErrors(d).length === 0;
    case "summary":
      return true;
  }
}

export function tooSmall(r: PublicResource, partySize: number): boolean {
  return r.capacity !== null && partySize > r.capacity;
}

export function nextStep(steps: Step[], current: Step): Step | null {
  const i = steps.indexOf(current);
  return i >= 0 && i < steps.length - 1 ? (steps[i + 1] as Step) : null;
}

export function previousStep(steps: Step[], current: Step): Step | null {
  const i = steps.indexOf(current);
  return i > 0 ? (steps[i - 1] as Step) : null;
}

/**
 * The first step that still needs an answer — where a restored draft or
 * a link that preselected a service should open. Never past `limit`.
 */
export function firstOpenStep(p: Profile, d: Draft, limit: Step = "summary"): Step {
  const steps = stepsFor(p, d);
  for (const s of steps) {
    if (s === limit || !canAdvance(p, d, s)) return s;
  }
  return limit;
}

/* ─── Changing an answer ─────────────────────────────────── */

/**
 * Apply a change and clear whatever it made stale. A new service can
 * change who performs it and how long it takes, so the person and the
 * time go; a new person, branch, table or day changes which times exist,
 * so the time goes. Nothing is cleared that the change cannot affect.
 */
export function change(p: Profile, d: Draft, patch: Partial<Draft>): Draft {
  const next = { ...d, ...patch };
  if ("serviceId" in patch && patch.serviceId !== d.serviceId) {
    if (next.staffId && !peopleFor(p, next.serviceId).some((m) => m.id === next.staffId)) next.staffId = null;
    next.time = null;
  }
  if ("branchId" in patch && patch.branchId !== d.branchId) {
    if (next.resourceId && !resourcesFor(p, next.branchId).some((r) => r.id === next.resourceId)) next.resourceId = null;
    next.time = null;
  }
  if (("staffId" in patch && patch.staffId !== d.staffId) || ("resourceId" in patch && patch.resourceId !== d.resourceId)) {
    next.time = null;
  }
  if ("date" in patch && patch.date !== d.date) next.time = null;
  if ("partySize" in patch && next.resourceId) {
    const r = p.resources.find((x) => x.id === next.resourceId);
    if (r && tooSmall(r, next.partySize)) next.resourceId = null;
  }
  return next;
}

/**
 * A draft as saved earlier, checked against the business as it is now.
 * Anything that no longer exists — a removed service, a person who left,
 * a past day — is dropped rather than submitted and refused.
 */
export function reconcile(p: Profile, saved: Draft, today: string = cairoToday()): Draft {
  let d: Draft = { ...EMPTY_DRAFT, ...saved };
  if (d.serviceId && !p.services.some((s) => s.id === d.serviceId)) d = { ...d, serviceId: null, time: null };
  if (d.staffId && !peopleFor(p, d.serviceId).some((m) => m.id === d.staffId)) d = { ...d, staffId: null, time: null };
  if (d.branchId && !p.branches.some((b) => b.id === d.branchId)) d = { ...d, branchId: null, time: null };
  if (d.resourceId && !resourcesFor(p, d.branchId).some((r) => r.id === d.resourceId)) d = { ...d, resourceId: null, time: null };
  if (d.date && d.date < today) d = { ...d, date: null, time: null };
  // A saved time is a guess about availability, and only the server
  // knows; the time screen re-checks it against fresh slots.
  const steps = stepsFor(p, d);
  if (!steps.includes(d.step)) d = { ...d, step: firstOpenStep(p, d) };
  // Never reopen on the summary with an answer missing upstream.
  const open = firstOpenStep(p, d, d.step);
  if (steps.indexOf(open) < steps.indexOf(d.step)) d = { ...d, step: open };
  return d;
}

/* ─── Days ───────────────────────────────────────────────── */

/** The days the calendar offers: today through the business's booking horizon. */
export function bookableDays(p: Pick<Profile, "policies">, today: string = cairoToday()): { from: string; count: number } {
  const horizon = Math.max(1, Math.min(p.policies.maxAdvanceDays || 30, 90));
  return { from: today, count: horizon };
}

/**
 * A hint for the date strip: days the business (or the chosen person)
 * does not work are shown as closed instead of being offered and then
 * found empty. Only a hint — holidays, time off and full days are the
 * server's to say, and the time screen shows what it says.
 */
export function mightBeOpen(iso: string, businessHours: DayHours[], staff: PublicStaffMember | null): boolean {
  const dow = weekdayOf(iso);
  const hours = staff && staff.hours.length > 0 ? staff.hours : businessHours;
  if (hours.length === 0) return true;
  const day = hours.find((h) => h.dayOfWeek === dow);
  return Boolean(day && !day.isClosed);
}



/* ─── Details ────────────────────────────────────────────── */

export type DetailsField = "name" | "email" | "notes";

export function detailsErrors(d: Pick<Draft, "name" | "email" | "notes">): DetailsField[] {
  const out: DetailsField[] = [];
  if (d.name.trim().length < 2) out.push("name");
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) out.push("email");
  if (d.notes.length > 500) out.push("notes");
  return out;
}

/* ─── Money ──────────────────────────────────────────────── */

/**
 * The deposit the server will ask for, for the summary. The same
 * arithmetic as src/lib/payments/money.ts depositCents — percent of the
 * discounted total, rounded up to the piastre — so the preview and the
 * charge agree. The booking response carries the real figure, and that
 * is what is shown from then on.
 */
export function depositPreviewCents(totalCents: number, percent: number | null): number | null {
  if (!percent || percent <= 0 || percent >= 100 || totalCents <= 0) return null;
  return Math.ceil((totalCents * percent) / 100);
}

/* ─── Submitting ─────────────────────────────────────────── */

export interface BookingRequest {
  serviceId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  staffMemberId?: string;
  resourceId?: string;
  branchId?: string;
  partySize?: number;
  discountCode?: string;
  idempotencyKey: string;
  source: "MAW3ED";
}

/**
 * The request, minus its key. Two submissions with the same body are
 * the same booking, which is what the idempotency key is for; a changed
 * body is a different booking and gets a new key.
 */
export function requestBody(p: Profile, d: Draft, phone: string, discountCode: string | null): Omit<BookingRequest, "idempotencyKey"> | null {
  if (!d.serviceId || !d.date || !d.time) return null;
  const resource = d.resourceId ? p.resources.find((r) => r.id === d.resourceId) : undefined;
  return {
    serviceId: d.serviceId,
    date: d.date,
    startTime: d.time,
    customerName: d.name.trim(),
    customerPhone: phone,
    customerEmail: d.email.trim() || undefined,
    notes: d.notes.trim() || undefined,
    staffMemberId: d.staffId ?? undefined,
    resourceId: resource?.id,
    branchId: d.branchId ?? undefined,
    partySize: resource && resource.capacity !== null ? d.partySize : undefined,
    discountCode: discountCode ?? undefined,
    source: "MAW3ED",
  };
}

/** Stable text for a body, so "is this the same submission?" is a string compare. */
export function fingerprint(body: object): string {
  return JSON.stringify(Object.entries(body).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)));
}

export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return `app-${c.randomUUID()}`;
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ─── What went wrong ────────────────────────────────────── */

/**
 * What the screen does about a failure:
 *   pick-time    the slot is gone — back to the times, refreshed
 *   retry        try the same submission again; the key makes it safe
 *   edit         something the customer typed needs changing
 *   sign-in      the session ended
 *   none         nothing to do here (the business cannot take bookings)
 */
export type Recovery = "pick-time" | "retry" | "edit" | "sign-in" | "none";

export interface Failure {
  title: string;
  body: string;
  recovery: Recovery;
  /** For analytics — never the message itself. */
  code: string;
}

const T = (lang: Lang, ar: string, en: string) => (lang === "ar" ? ar : en);

/** Why a day has no times, in words. */
export function emptyDayReason(reason: string | null, lang: Lang): string {
  switch (reason) {
    case "business-closed":
      return T(lang, "المكان مقفول في اليوم ده", "They're closed on this day");
    case "staff-off":
      return T(lang, "الشخص ده مش شغال في اليوم ده", "This person isn't working on this day");
    case "holiday":
      return T(lang, "أجازة رسمية", "Public holiday — closed");
    case "vacation":
      return T(lang, "في أجازة اليوم ده", "On leave this day");
    case "same-day-cutoff":
      return T(lang, "الحجز لليوم قفل، جرّب بكرة", "Same-day booking has closed — try tomorrow");
    case "too-far-ahead":
      return T(lang, "الحجز مش مفتوح للتاريخ ده لسه", "Booking isn't open this far ahead yet");
    case "past":
      return T(lang, "اليوم ده عدّى", "This day has passed");
    default:
      return T(lang, "مفيش مواعيد فاضية في اليوم ده", "No free times on this day");
  }
}

export function describeFailure(e: unknown, lang: Lang): Failure {
  if (e instanceof NetworkError) {
    return {
      title: T(lang, "الاتصال وقع", "Connection lost"),
      body: T(
        lang,
        "مش متأكدين الحجز وصل ولا لأ. جرّب تاني — مش هيتعمل حجز مكرر.",
        "We couldn't tell whether your booking went through. Try again — it won't be booked twice.",
      ),
      recovery: "retry",
      code: "network",
    };
  }
  if (e instanceof UnauthorizedError) {
    return {
      title: T(lang, "الجلسة خلصت", "You've been signed out"),
      body: T(lang, "سجّل دخولك تاني وكمّل — اختياراتك محفوظة.", "Sign in again to continue — your choices are saved."),
      recovery: "sign-in",
      code: "unauthorized",
    };
  }
  if (e instanceof ApiError) {
    switch (e.code) {
      case "slot-taken":
        return {
          title: T(lang, "الميعاد ده اتحجز", "That time was just taken"),
          body: T(lang, "حد تاني حجزه قبلك بلحظات. اختار ميعاد تاني.", "Someone booked it moments before you. Please pick another time."),
          recovery: "pick-time",
          code: e.code,
        };
      case "slot-unavailable":
        return {
          title: T(lang, "الميعاد ده مبقاش متاح", "That time is no longer available"),
          body: emptyDayReason(typeof e.detail.reason === "string" ? e.detail.reason : null, lang),
          recovery: "pick-time",
          code: e.code,
        };
      case "discount-invalid":
      case "discount-gone":
        return {
          title: T(lang, "كود الخصم مش شغال", "That code can't be used"),
          body: e.code === "discount-gone"
            ? T(lang, "العرض خلص دلوقتي. شيل الكود وكمّل بالسعر العادي.", "The offer just ran out. Remove the code to book at the regular price.")
            : lang === "ar"
              ? e.message
              : "Check the code, or remove it to book at the regular price.",
          recovery: "edit",
          code: e.code,
        };
      case "invalid":
        return {
          title: T(lang, "في بيانات محتاجة تتظبط", "Some details need fixing"),
          body: lang === "ar" ? e.message : "Check your name, email and notes, then try again.",
          recovery: "edit",
          code: e.code,
        };
      case "limit-reached":
        return {
          title: T(lang, "المكان مش واخد حجوزات دلوقتي", "Not taking bookings right now"),
          body: T(lang, "المكان وصل لأقصى عدد حجوزات الشهر ده. تقدر تكلمهم مباشرة.", "This place has reached its booking limit for the month. You can contact them directly."),
          recovery: "none",
          code: e.code,
        };
      case "business-not-found":
      case "service-not-found":
        return {
          title: T(lang, "الخدمة مبقتش متاحة", "This service is no longer available"),
          body: T(lang, "يمكن المكان غيّر خدماته. ارجع واختار تاني.", "The business may have changed its services. Go back and choose again."),
          recovery: "none",
          code: e.code,
        };
      case "payment-unavailable":
        return {
          title: T(lang, "الدفع مش شغال دلوقتي", "Payment couldn't start"),
          body: T(lang, "مفيش فلوس اتخصمت والميعاد اتساب. جرّب تاني بعد شوية.", "Nothing was charged and the time was released. Try again in a moment."),
          recovery: "retry",
          code: e.code,
        };
    }
    return {
      title: T(lang, "الحجز ماتمّش", "Booking didn't go through"),
      body: lang === "ar" ? e.message : "Something went wrong on our side. Try again in a moment.",
      recovery: e.isClientError ? "none" : "retry",
      code: e.code ?? `http-${e.status}`,
    };
  }
  return {
    title: T(lang, "الحجز ماتمّش", "Booking didn't go through"),
    body: T(lang, "حصل خطأ غير متوقع. جرّب تاني.", "Something unexpected happened. Try again."),
    recovery: "retry",
    code: "unknown",
  };
}

/** A key only survives retries of a failure that might have succeeded server-side. */
export function keepsKey(recovery: Recovery, code: string): boolean {
  // A network failure may have created the booking; the same key finds it.
  // A payment session that failed to open left the booking FAILED_PAYMENT,
  // and the same key would only return that failed booking.
  return recovery === "retry" && code !== "payment-unavailable";
}
