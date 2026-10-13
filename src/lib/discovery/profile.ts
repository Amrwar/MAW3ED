import { db } from "@/lib/db";
import { cairoNow, openState, startOfCairoDay, type DayHours, type OpenState } from "@/lib/discovery/hours";
import { findNextSlot, type NextSlot } from "@/lib/discovery/next-slot";
import { timeToMinutes } from "@/lib/bookings/time";
import { getBusinessReviews, getRatingSummary, type PublicReview, type RatingSummary } from "@/lib/reviews";

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
  acceptsOnlinePayment: boolean;
  category: { slug: string; nameAr: string; nameEn: string };
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
  branches: { id: string; nameAr: string; nameEn: string | null; address: string | null }[];
  staff: { id: string; nameAr: string; nameEn: string | null; role: string | null; photo: string | null }[];
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
      address: true,
      phone: true,
      whatsapp: true,
      category: { select: { slug: true, nameAr: true, nameEn: true } },
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
        select: { id: true, nameAr: true, nameEn: true, address: true },
      },
      staffMembers: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, nameAr: true, nameEn: true, role: true, photo: true },
      },
    },
  });
  if (!b) return null;

  const hours: DayHours[] = b.availability;
  const [rating, reviewPage, nextSlot] = await Promise.all([
    getRatingSummary(b.id),
    getBusinessReviews(b.id, { sort: "recent", take: 5 }),
    businessNextSlot(b.id, hours, b.services.map((s) => s.duration)),
  ]);

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

  const { dayOfWeek, time } = cairoNow();

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
    acceptsOnlinePayment: b.depositEnabled,
    category: b.category,
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
    staff: b.staffMembers,
  };
}

/** How far ahead findNextSlot looks; bookings beyond it cannot matter. */
const HORIZON_DAYS = 14;

/**
 * The first genuinely free appointment at one business — the shortest
 * service fitting between its hours and its bookings over the next
 * fortnight. Shared by this profile and the website's business page
 * (src/app/company/[slug]/page.tsx), so the two cannot disagree.
 */
export async function businessNextSlot(
  businessId: string,
  hours: DayHours[],
  serviceDurations: number[],
  now: Date = new Date(),
): Promise<NextSlot | null> {
  const today = startOfCairoDay(now);
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 86_400_000);
  const booked = await db.booking.findMany({
    where: { businessId, status: { in: ["PENDING", "CONFIRMED"] }, date: { gte: today, lt: horizon } },
    select: { date: true, startTime: true, endTime: true, service: { select: { duration: true } } },
  });
  const shortest = serviceDurations.reduce<number | null>(
    (min, d) => (d > 0 && (min === null || d < min) ? d : min),
    null,
  );
  const { dayOfWeek, time } = cairoNow(now);
  return findNextSlot(
    {
      rules: hours,
      durationMinutes: shortest,
      booked: booked.map((x) => {
        const startMin = timeToMinutes(x.startTime);
        return {
          dayOffset: Math.round((x.date.getTime() - today.getTime()) / 86_400_000),
          startMin,
          endMin: x.endTime ? timeToMinutes(x.endTime) : startMin + x.service.duration,
        };
      }),
    },
    dayOfWeek,
    time,
  );
}
