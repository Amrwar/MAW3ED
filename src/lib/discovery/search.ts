import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  PAGE_SIZE,
  type DiscoveryQuery,
} from "./params";
import {
  cairoNow,
  dayOffsetToWeekday,
  openState,
  startOfCairoDay,
  type DayHours,
  type OpenState,
} from "./hours";
import { findNextSlot, type BookedRange, type NextSlot } from "./next-slot";
import { timeToMinutes } from "@/lib/bookings/time";

/**
 * The discovery query.
 *
 * Filtering and paging both happen in the database. The browser is sent
 * one page of results and a total count, never the catalogue — the old
 * page fetched every published business on every request and filtered a
 * slice of it in React.
 */

export interface DiscoveryBusiness {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  taglineAr: string | null;
  coverImage: string | null;
  logoImage: string | null;
  isVerified: boolean;
  autoConfirm: boolean;
  acceptsOnlinePayment: boolean;
  /** null when nobody has reviewed it. Never substituted with a number. */
  ratingAvg: number | null;
  ratingCount: number;
  category: { slug: string; nameAr: string; nameEn: string };
  city: { slug: string; nameAr: string; nameEn: string };
  neighborhood: { slug: string; nameAr: string; nameEn: string } | null;
  /** null when no bookable service has a price set. Never shown as 0. */
  minPrice: number | null;
  currency: string;
  bookingCount: number;
  open: OpenState;
  /**
   * The first genuinely free appointment, or null when there is none
   * inside the fortnight we look ahead. Never a guess — see next-slot.ts.
   */
  nextSlot: NextSlot | null;
}

export interface DiscoveryResult {
  businesses: DiscoveryBusiness[];
  total: number;
  page: number;
  pageCount: number;
  /** True when a derived sort's pages end before `total` (they rank the first 240 only). */
  capped: boolean;
  /** Cheapest and dearest bookable service across the whole catalogue. */
  priceBounds: { min: number; max: number } | null;
}

/* ─── WHERE ──────────────────────────────────────────────── */

function buildWhere(q: DiscoveryQuery, now: Date): Prisma.BusinessWhereInput {
  const and: Prisma.BusinessWhereInput[] = [{ isPublished: true }];

  // Free text spans the three things a person types: the place, what
  // they want done, and who they want to see.
  if (q.q) {
    const contains = { contains: q.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { nameAr: contains },
        { nameEn: contains },
        { taglineAr: contains },
        { services: { some: { isAvailable: true, OR: [{ nameAr: contains }, { nameEn: contains }] } } },
        { staffMembers: { some: { isActive: true, OR: [{ nameAr: contains }, { nameEn: contains }] } } },
        { category: { OR: [{ nameAr: contains }, { nameEn: contains }] } },
        { city: { OR: [{ nameAr: contains }, { nameEn: contains }] } },
        { neighborhood: { OR: [{ nameAr: contains }, { nameEn: contains }] } },
      ],
    });
  }

  // A parent category matches its children too, so picking "medical"
  // does not hide the dentists filed under it.
  if (q.subcategory) {
    and.push({ category: { slug: q.subcategory } });
  } else if (q.category) {
    and.push({
      OR: [{ category: { slug: q.category } }, { category: { parent: { slug: q.category } } }],
    });
  }

  if (q.neighborhood) and.push({ neighborhood: { slug: q.neighborhood } });
  else if (q.city) and.push({ city: { slug: q.city } });

  if (q.minPrice !== null || q.maxPrice !== null) {
    and.push({
      services: {
        some: {
          isAvailable: true,
          price: {
            // gt: 0 throughout — see PRICED. A service left at the
            // default 0 has no price, so it cannot satisfy a range.
            gt: 0,
            ...(q.minPrice !== null ? { gte: q.minPrice } : {}),
            ...(q.maxPrice !== null ? { lte: q.maxPrice } : {}),
          },
        },
      },
    });
  }

  // An unrated business is excluded by a rating floor rather than
  // treated as zero — it has no rating, which is not the same as a bad one.
  if (q.rating !== null) and.push({ ratingAvg: { gte: q.rating } });

  if (q.verified) and.push({ isVerified: true });
  if (q.instant) and.push({ autoConfirm: true });
  // "Online payment" is deposits switched on. The plan gate is checked
  // when the booking is taken; here it is what the owner has enabled.
  if (q.online) and.push({ depositEnabled: true });

  const { dayOfWeek, time } = cairoNow(now);

  if (q.availability === "today" || q.availability === "tomorrow") {
    const day = q.availability === "today" ? dayOfWeek : dayOffsetToWeekday(dayOfWeek, 1);
    and.push({ availability: { some: { dayOfWeek: day, isClosed: false } } });
  }

  if (q.availability === "open-now") {
    // "HH:MM" is zero-padded, so Postgres string comparison is clock
    // comparison. The second branch is a business trading past midnight,
    // where closeTime has wrapped below openTime.
    and.push({
      availability: {
        some: {
          dayOfWeek,
          isClosed: false,
          OR: [
            { openTime: { lte: time }, closeTime: { gt: time } },
            { AND: [{ closeTime: { lte: db.availabilityRule.fields.openTime } }, { openTime: { lte: time } }] },
          ],
        },
      },
    });
  }

  return { AND: and };
}

/* ─── ORDER BY ───────────────────────────────────────────── */

function buildOrderBy(sort: DiscoveryQuery["sort"]): Prisma.BusinessOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      // nulls last, so an unrated business never outranks a rated one.
      return [{ ratingAvg: { sort: "desc", nulls: "last" } }, { ratingCount: "desc" }, { createdAt: "desc" }];
    case "most-booked":
      return [{ bookings: { _count: "desc" } }, { createdAt: "desc" }];
    case "price-asc":
    case "price-desc":
    case "soonest":
      // Settled after the fetch — see sortInMemory.
      return [{ createdAt: "desc" }];
    case "recommended":
    default:
      // Verified first, then rated, then busy, then new. A deliberate
      // ordering rather than an opaque score: the listing can explain
      // itself, and nobody can buy their way up it.
      return [
        { isVerified: "desc" },
        { ratingAvg: { sort: "desc", nulls: "last" } },
        { bookings: { _count: "desc" } },
        { createdAt: "desc" },
      ];
  }
}

/* ─── Query ──────────────────────────────────────────────── */

/**
 * What counts as a priced service.
 *
 * Decimal defaults to 0, and three of the live listings have services
 * sitting at it — an owner who skipped the field, not a free service.
 * Treating 0 as a price is how a listing ends up advertising "0 ج.م",
 * so it is excluded here and the card says the price is not set.
 */
const PRICED = { isAvailable: true, price: { gt: 0 } } as const;

const SELECT = {
  id: true,
  slug: true,
  nameAr: true,
  nameEn: true,
  taglineAr: true,
  coverImage: true,
  logoImage: true,
  isVerified: true,
  autoConfirm: true,
  depositEnabled: true,
  ratingAvg: true,
  ratingCount: true,
  category: { select: { slug: true, nameAr: true, nameEn: true } },
  city: { select: { slug: true, nameAr: true, nameEn: true } },
  neighborhood: { select: { slug: true, nameAr: true, nameEn: true } },
  availability: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
  services: {
    where: PRICED,
    orderBy: { price: "asc" },
    take: 1,
    select: { price: true, currency: true },
  },
  _count: { select: { bookings: true } },
} satisfies Prisma.BusinessSelect;

type Row = Prisma.BusinessGetPayload<{ select: typeof SELECT }>;

function toBusiness(row: Row, nowDay: number, nowTime: string): DiscoveryBusiness {
  const cheapest = row.services[0];
  const rules: DayHours[] = row.availability;

  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    taglineAr: row.taglineAr,
    coverImage: row.coverImage,
    logoImage: row.logoImage,
    isVerified: row.isVerified,
    autoConfirm: row.autoConfirm,
    acceptsOnlinePayment: row.depositEnabled,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    category: row.category,
    city: row.city,
    neighborhood: row.neighborhood,
    // Decimal cannot cross into a client component, and a missing price
    // is null here so the card can say so instead of printing 0.
    minPrice: cheapest ? Number(cheapest.price) : null,
    currency: cheapest?.currency ?? "EGP",
    bookingCount: row._count.bookings,
    open: openState(rules, nowDay, nowTime),
    nextSlot: null,
  };
}

/**
 * Fills in nextSlot for one page of results.
 *
 * Two queries regardless of page size: the shortest service per
 * business, and every booking across those businesses for the fortnight
 * ahead. Both are indexed.
 */
async function attachNextSlots(
  list: DiscoveryBusiness[],
  rulesByBusiness: Map<string, DayHours[]>,
  nowDay: number,
  nowTime: string,
  now: Date,
): Promise<void> {
  if (list.length === 0) return;

  const ids = list.map((b) => b.id);

  const todayUTC = startOfCairoDay(now);
  const horizonUTC = new Date(todayUTC.getTime() + 14 * 86_400_000);

  const [services, bookings] = await Promise.all([
    // One row per business, not every service of every business.
    db.service.groupBy({
      by: ["businessId"],
      where: { businessId: { in: ids }, isAvailable: true, duration: { gt: 0 } },
      _min: { duration: true },
    }),
    db.booking.findMany({
      where: {
        businessId: { in: ids },
        date: { gte: todayUTC, lt: horizonUTC },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: {
        businessId: true,
        date: true,
        startTime: true,
        endTime: true,
        service: { select: { duration: true } },
      },
    }),
  ]);

  const shortest = new Map<string, number>();
  for (const s of services) {
    if (s._min.duration !== null) shortest.set(s.businessId, s._min.duration);
  }

  const booked = new Map<string, BookedRange[]>();
  for (const b of bookings) {
    const dayOffset = Math.round((b.date.getTime() - todayUTC.getTime()) / 86_400_000);
    const startMin = timeToMinutes(b.startTime);
    const endMin = b.endTime ? timeToMinutes(b.endTime) : startMin + b.service.duration;
    const list = booked.get(b.businessId) ?? [];
    list.push({ dayOffset, startMin, endMin });
    booked.set(b.businessId, list);
  }

  for (const b of list) {
    b.nextSlot = findNextSlot(
      {
        rules: rulesByBusiness.get(b.id) ?? [],
        durationMinutes: shortest.get(b.id) ?? null,
        booked: booked.get(b.id) ?? [],
      },
      nowDay,
      nowTime,
    );
  }
}

/**
 * Price and soonest-availability are derived values, not columns, so
 * they are ordered after the fetch. Both are stable tie-breaks on top of
 * an already-deterministic database ordering.
 */
function sortInMemory(list: DiscoveryBusiness[], sort: DiscoveryQuery["sort"]) {
  if (sort === "price-asc" || sort === "price-desc") {
    const dir = sort === "price-asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      // A business with no price set sorts last either way: it is
      // unknown, not free and not expensive.
      if (a.minPrice === null && b.minPrice === null) return 0;
      if (a.minPrice === null) return 1;
      if (b.minPrice === null) return -1;
      return (a.minPrice - b.minPrice) * dir;
    });
  }

  if (sort === "soonest") {
    // By the first genuinely free appointment — attachNextSlots has run
    // over the whole capped set first. Nothing free in the fortnight
    // ahead sorts last.
    const rank = (b: DiscoveryBusiness) =>
      b.nextSlot ? b.nextSlot.dayOffset * 1440 + timeToMinutes(b.nextSlot.time) : Number.POSITIVE_INFINITY;
    return [...list].sort((a, b) => rank(a) - rank(b));
  }

  return list;
}

export async function searchBusinesses(
  q: DiscoveryQuery,
  now: Date = new Date(),
  /**
   * The price range across the whole catalogue, for the website's price
   * filter. An aggregate over every service, so callers that show no
   * price filter (the app's API) skip it.
   */
  opts: { priceBounds?: boolean } = {},
): Promise<DiscoveryResult> {
  const where = buildWhere(q, now);
  const { dayOfWeek, time } = cairoNow(now);

  const derivedSort = q.sort === "price-asc" || q.sort === "price-desc" || q.sort === "soonest";

  // A derived sort has to rank the whole result set before slicing it,
  // or page 2 would be ordered independently of page 1. The cap keeps
  // that bounded; past it the ordering degrades to the database one,
  // which is still deterministic.
  const DERIVED_CAP = PAGE_SIZE * 20;

  const [total, rows, bounds] = await Promise.all([
    db.business.count({ where }),
    db.business.findMany({
      where,
      select: SELECT,
      orderBy: buildOrderBy(q.sort),
      ...(derivedSort
        ? { take: DERIVED_CAP }
        : { skip: (q.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    }),
    opts.priceBounds === false
      ? null
      : db.service.aggregate({
          where: { ...PRICED, business: { isPublished: true } },
          _min: { price: true },
          _max: { price: true },
        }),
  ]);

  // The rules came back with the rows; next-slot reuses them rather than
  // reading them again.
  const rulesByBusiness = new Map<string, DayHours[]>(rows.map((r) => [r.id, r.availability]));
  const mapped = rows.map((r) => toBusiness(r, dayOfWeek, time));

  // "Soonest" ranks by the next free slot, so every candidate needs one
  // before sorting; otherwise only the page shown does.
  if (q.sort === "soonest") await attachNextSlots(mapped, rulesByBusiness, dayOfWeek, time, now);
  const ordered = sortInMemory(mapped, q.sort);
  const businesses = derivedSort
    ? ordered.slice((q.page - 1) * PAGE_SIZE, q.page * PAGE_SIZE)
    : ordered;
  if (q.sort !== "soonest") await attachNextSlots(businesses, rulesByBusiness, dayOfWeek, time, now);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return {
    businesses,
    total,
    page: q.page,
    // A derived sort only ranks the first DERIVED_CAP rows; offering
    // pages past them would offer empty pages.
    pageCount: derivedSort ? Math.min(pages, DERIVED_CAP / PAGE_SIZE) : pages,
    // `total` stays the real number of matches, so this says when the
    // pages stop short of it — a client can say so rather than claim it
    // has shown everything.
    capped: derivedSort && total > DERIVED_CAP,
    priceBounds:
      bounds && bounds._min.price !== null && bounds._max.price !== null
        ? { min: Math.floor(Number(bounds._min.price)), max: Math.ceil(Number(bounds._max.price)) }
        : null,
  };
}

/* ─── Facets ─────────────────────────────────────────────── */

export interface Facets {
  categories: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string;
    count: number;
    children: { id: string; slug: string; nameAr: string; nameEn: string; count: number }[];
  }[];
  cities: { id: string; slug: string; nameAr: string; nameEn: string; count: number }[];
  neighborhoods: { id: string; slug: string; nameAr: string; nameEn: string; cityId: string }[];
}

/**
 * The filter panel's options, with the counts that let someone avoid a
 * dead end. Four small queries, none of which grow with the result set.
 */
export async function getFacets(citySlug?: string): Promise<Facets> {
  const [categories, cities, byCategory, byCity, neighborhoods] = await Promise.all([
    db.category.findMany({ orderBy: { nameAr: "asc" } }),
    db.city.findMany({ orderBy: { nameAr: "asc" } }),
    // Within the chosen city, so a category is never offered there with
    // another city's businesses behind it. City counts stay national —
    // they are what somebody picks a city by.
    db.business.groupBy({
      by: ["categoryId"],
      where: { isPublished: true, ...(citySlug ? { city: { slug: citySlug } } : {}) },
      _count: { _all: true },
    }),
    db.business.groupBy({ by: ["cityId"], where: { isPublished: true }, _count: { _all: true } }),
    citySlug
      ? db.neighborhood.findMany({ where: { city: { slug: citySlug } }, orderBy: { nameAr: "asc" } })
      : Promise.resolve([]),
  ]);

  const catCount = new Map(byCategory.map((g) => [g.categoryId, g._count._all]));
  const cityCount = new Map(byCity.map((g) => [g.cityId, g._count._all]));

  const tops = categories.filter((c) => !c.parentId);
  const kids = categories.filter((c) => c.parentId);

  return {
    categories: tops
      .map((c) => {
        const children = kids
          .filter((k) => k.parentId === c.id)
          .map((k) => ({
            id: k.id,
            slug: k.slug,
            nameAr: k.nameAr,
            nameEn: k.nameEn,
            count: catCount.get(k.id) ?? 0,
          }));
        return {
          id: c.id,
          slug: c.slug,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          // A parent's count includes everything filed beneath it.
          count: (catCount.get(c.id) ?? 0) + children.reduce((n, k) => n + k.count, 0),
          children,
        };
      })
      .sort((a, b) => b.count - a.count || a.nameAr.localeCompare(b.nameAr, "ar")),

    cities: cities
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        count: cityCount.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.nameAr.localeCompare(b.nameAr, "ar")),

    neighborhoods: neighborhoods.map((n) => ({
      id: n.id,
      slug: n.slug,
      nameAr: n.nameAr,
      nameEn: n.nameEn,
      cityId: n.cityId,
    })),
  };
}

/* ─── Ratings ────────────────────────────────────────────── */

// recomputeBusinessRating lives in lib/reviews.ts, next to the single
// rating calculation it has to agree with.
export { recomputeBusinessRating } from "@/lib/reviews";
