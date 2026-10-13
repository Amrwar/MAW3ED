import { db } from "@/lib/db";
import { cairoNow, openState, type DayHours, type OpenState } from "@/lib/discovery/hours";
import type { NextSlot } from "@/lib/discovery/next-slot";
import { firstFree, loadSchedule, shortest } from "@/lib/discovery/next-free";
import { getBusinessReviews, getRatingSummary, type PublicReview, type RatingSummary } from "@/lib/reviews";
import { canUseFeature, getEffectivePlan } from "@/lib/plans";
import { CUTOFF_HOURS } from "@/lib/bookings/self-service";
import { staffWeek } from "@/lib/discovery/staff";

/**
 * One business as the public may see it — the app's business screen.
 *
 * Every field is chosen, never spread from the row: GET /api/public/[slug]
 * used to return the whole Business record minus ownerId, which handed
 * anyone the plan, subscription and payment ids, the notification phone
 * and email, and the referral code. Anything added to Business is now
 * private until it is added here on purpose.
 *
 * The open state, next free time and rating are computed by the same
 * functions the website's profile page uses, so the two never disagree.
 */

export interface PublicProfile {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  taglineAr: string | null;
  about: string | null;
  coverImage: string | null;
  logoImage: string | null;
  isVerified: boolean;
  /** Bookings are confirmed without the business approving each one. */
  autoConfirm: boolean;
  /** A deposit is taken online when booking — true only when it really will be. */
  acceptsOnlinePayment: boolean;
  /** How the business schedules: tables, staff, or neither in particular. */
  businessType: "GENERAL" | "RESTAURANT" | "BARBERSHOP";
  /** parentSlug is set for a subcategory, so a dentist reads as medical. */
  category: { slug: string; nameAr: string; nameEn: string; parentSlug: string | null };
  city: { slug: string; nameAr: string; nameEn: string };
  neighborhood: { slug: string; nameAr: string; nameEn: string } | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  images: { url: string; caption: string | null }[];
  services: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    descriptionAr: string | null;
    durationMinutes: number;
    /** null when the service has no price set — never shown as free. */
    price: number | null;
    currency: string;
  }[];
  /** Cheapest priced service, or null. */
  minPrice: number | null;
  currency: string;
  /** dayOfWeek 0 = Sunday. Empty when the business has set no hours. */
  hours: DayHours[];
  open: OpenState;
  nextSlot: NextSlot | null;
  rating: RatingSummary;
  reviews: PublicReview[];
  branches: { id: string; nameAr: string; nameEn: string | null; address: string | null; phone: string | null }[];
  staff: PublicStaffMember[];
  /** Tables, rooms, chairs — what a booking holds, when the business uses any. */
  resources: PublicResource[];
  policies: BookingPolicies;
}

export interface PublicStaffMember {
  id: string;
  nameAr: string;
  nameEn: string | null;
  role: string | null;
  photo: string | null;
  specialties: string[];
  /** Services this member performs. Empty means every service, as booking reads it. */
  serviceIds: string[];
  /** When they can be booked, already narrowed by the business's own hours. */
  hours: DayHours[];
  /** Their own first free appointment — their bookings, not the whole shop's. */
  nextSlot: NextSlot | null;
}

export interface PublicResource {
  id: string;
  kind: "TABLE" | "ROOM" | "CHAIR" | "EQUIPMENT" | "OTHER";
  name: string;
  /** Seats, when it counts any. */
  capacity: number | null;
  /** "Garden", "First floor" — free text from the owner. */
  area: string | null;
  branchId: string | null;
}

/** The rules a booking here is made under. Each is a real setting, never a default dressed up. */
export interface BookingPolicies {
  /** Percent of the price paid online to hold the booking, or null when nothing is taken. */
  depositPercent: number | null;
  /** How long ahead a booking must be made, in minutes. 0 means any time left today. */
  minNoticeMinutes: number;
  /** How far ahead the calendar is open. */
  maxAdvanceDays: number;
  /** "HH:MM" Cairo; past it, no more bookings for today. */
  sameDayCutoff: string | null;
  /** Customers can cancel or move a booking themselves until this many hours before it. */
  changeCutoffHours: number;
}

export async function getPublicProfile(slug: string): Promise<PublicProfile | null> {
  const b = await db.business.findUnique({
    where: { slug, isPublished: true },
    select: {
      id: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      taglineAr: true,
      about: true,
      coverImage: true,
      logoImage: true,
      isVerified: true,
      autoConfirm: true,
      depositEnabled: true,
      depositPercent: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      minNoticeMinutes: true,
      maxAdvanceDays: true,
      sameDayCutoff: true,
      businessType: true,
      address: true,
      phone: true,
      whatsapp: true,
      category: { select: { slug: true, nameAr: true, nameEn: true, parent: { select: { slug: true } } } },
      city: { select: { slug: true, nameAr: true, nameEn: true } },
      neighborhood: { select: { slug: true, nameAr: true, nameEn: true } },
      images: { select: { url: true, caption: true }, orderBy: { sortOrder: "asc" } },
      services: {
        where: { isAvailable: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, nameAr: true, nameEn: true, descriptionAr: true, duration: true, price: true, currency: true },
      },
      availability: {
        orderBy: { dayOfWeek: "asc" },
        select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
      },
      branches: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, nameAr: true, nameEn: true, address: true, phone: true },
      },
      staffMembers: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          role: true,
          photo: true,
          specialties: true,
          workingDays: true,
          hours: { select: { dayOfWeek: true, startTime: true, endTime: true, isOff: true } },
          services: { select: { serviceId: true } },
        },
      },
      resources: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, kind: true, name: true, capacity: true, area: true, branchId: true },
      },
    },
  });
  if (!b) return null;

  const hours: DayHours[] = b.availability;
  const now = new Date();
  const [rating, reviewPage, schedule] = await Promise.all([
    getRatingSummary(b.id),
    getBusinessReviews(b.id, { sort: "recent", take: 5 }),
    loadSchedule(b.id, now),
  ]);
  const { dayOfWeek, time } = cairoNow(now);
  const durationOf = new Map(b.services.map((s) => [s.id, s.duration]));
  const nextSlot = schedule ? firstFree(schedule, shortest(b.services.map((s) => s.duration))) : null;

  const staff: PublicStaffMember[] = b.staffMembers.map((m) => {
    // Every link, kept as it is: an empty list means "performs every
    // service" to each reader, so a member linked only to services that
    // are no longer offered must stay non-empty — they perform nothing.
    const serviceIds = m.services.map((x) => x.serviceId);
    const week = staffWeek(hours, m.workingDays, m.hours);
    const durations =
      m.services.length === 0
        ? [...durationOf.values()]
        : serviceIds.flatMap((id) => (durationOf.has(id) ? [durationOf.get(id) as number] : []));
    return {
      id: m.id,
      nameAr: m.nameAr,
      nameEn: m.nameEn,
      role: m.role,
      photo: m.photo,
      specialties: m.specialties.map((x) => x.trim()).filter(Boolean),
      serviceIds,
      hours: week,
      // Their own first slot, as booking with them would offer it.
      nextSlot: schedule
        ? firstFree(schedule, shortest(durations), { id: m.id, workingDays: m.workingDays, hours: m.hours })
        : null,
    };
  });

  // The booking route's own test, exactly (api/public/[slug]/bookings):
  // a deposit is taken when it is switched on and the plan includes
  // deposits — and only then, so the page promises nothing more.
  const takesDeposit =
    b.depositEnabled && canUseFeature(getEffectivePlan(b.plan, b.subscriptionStatus, b.trialEndsAt), "deposits");

  const services = b.services.map((s) => {
    const price = Number(s.price);
    return {
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      descriptionAr: s.descriptionAr,
      durationMinutes: s.duration,
      price: price > 0 ? price : null,
      currency: s.currency,
    };
  });
  const priced = services.filter((s) => s.price !== null);
  const cheapest = priced.reduce<(typeof priced)[number] | null>(
    (min, s) => (min === null || (s.price as number) < (min.price as number) ? s : min),
    null,
  );

  return {
    id: b.id,
    slug: b.slug,
    nameAr: b.nameAr,
    nameEn: b.nameEn,
    taglineAr: b.taglineAr,
    about: b.about,
    coverImage: b.coverImage,
    logoImage: b.logoImage,
    isVerified: b.isVerified,
    autoConfirm: b.autoConfirm,
    acceptsOnlinePayment: takesDeposit,
    businessType: b.businessType,
    category: {
      slug: b.category.slug,
      nameAr: b.category.nameAr,
      nameEn: b.category.nameEn,
      parentSlug: b.category.parent?.slug ?? null,
    },
    city: b.city,
    neighborhood: b.neighborhood,
    address: b.address,
    phone: b.phone,
    whatsapp: b.whatsapp,
    images: b.images,
    services,
    minPrice: cheapest?.price ?? null,
    currency: cheapest?.currency ?? "EGP",
    hours,
    open: openState(hours, dayOfWeek, time),
    nextSlot,
    rating,
    reviews: reviewPage.reviews,
    branches: b.branches,
    staff,
    resources: b.resources,
    policies: {
      depositPercent: takesDeposit ? b.depositPercent : null,
      minNoticeMinutes: b.minNoticeMinutes,
      maxAdvanceDays: b.maxAdvanceDays,
      sameDayCutoff: b.sameDayCutoff,
      changeCutoffHours: CUTOFF_HOURS,
    },
  };
}

/**
 * The first genuinely free appointment at one business — the shortest
 * service, as the booking engine would offer it (lib/discovery/next-free).
 * Shared by this profile and the website's business page
 * (src/app/company/[slug]/page.tsx), so the two cannot disagree.
 */
export async function businessNextSlot(
  businessId: string,
  serviceDurations: number[],
  now: Date = new Date(),
): Promise<NextSlot | null> {
  const schedule = await loadSchedule(businessId, now);
  return schedule ? firstFree(schedule, shortest(serviceDurations)) : null;
}
