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
  type DayHours,
  type OpenState,
  startOfCairoDay,
} from "./hours";
import { firstFree, loadSchedules, type NextSlot } from "./next-free";
import { timeToMinutes } from "@/lib/bookings/time";
import { searchTerms } from "./synonyms";
import { settleInstantBadges } from "@/lib/bookings/allowance";
import { PLAN_PRICES_EGP, canUseFeature, getEffectivePlan, type Plan } from "@/lib/plans";

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
   * inside the fortnight we look ahead. Never a guess — see next-free.ts.
   */
  nextSlot: NextSlot | null;
  /**
   * Where it is on a map — the business's own pin and each active
   * branch's, as their owner set them. Empty when none is set; never
   * geocoded from an address.
   */
  pins: MapPin[];
}

export interface MapPin {
  lat: number;
  lng: number;
  /** Null for the business's own pin. */
  branchId: string | null;
  branchNameAr: string | null;
  branchNameEn: string | null;
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
  // The query is widened first (lib/discovery/synonyms): "doctor" also
  // looks for clinics, "عيادة" for "عيادات". Every word has to match
  // something; the alternatives for one word are ORed. A word as typed
  // is looked for everywhere, a stand-in for it only in the fields a
  // synonym describes — the name, the services and the category — so
  // a widened query costs a few scans more rather than eight times.
  if (q.q) {
    // Every term is already folded (normalize.ts), and so is every
    // searchKey column (the database folds it the same way), so "احمد"
    // meets "أحمد" and "مستشفي" meets "مستشفى". The trigram index on the
    // business and service keys serves these contains-scans.
    for (const [typed, ...alts] of searchTerms(q.q)) {
      const has = (term: string) => ({ searchKey: { contains: term } });
      const loose = (term: string): Prisma.BusinessWhereInput[] => [
        has(term),
        { services: { some: { isAvailable: true, ...has(term) } } },
        { category: has(term) },
      ];
      and.push({
        OR: [
          ...loose(typed),
          { staffMembers: { some: { isActive: true, ...has(typed) } } },
          { city: has(typed) },
          { neighborhood: has(typed) },
          ...alts.flatMap(loose),
        ],
      });
    }
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
  // "Online payment" is deposits switched on AND a plan that allows
  // them — the same test the business page and the booking route apply
  // (plans.ts: getEffectivePlan + "deposits"). Switched on under a plan
  // that lapsed, the booking takes no payment, so the filter must not
  // promise one.
  if (q.online) and.push({ depositEnabled: true, ...DEPOSITS_ALLOWED(now) });

  const { dayOfWeek, time } = cairoNow(now);
  const today = startOfCairoDay(now);

  if (q.availability === "today" || q.availability === "tomorrow") {
    const offset = q.availability === "today" ? 0 : 1;
    const day = dayOffsetToWeekday(dayOfWeek, offset);
    const date = new Date(today.getTime() + offset * 86_400_000);
    and.push({ availability: { some: { dayOfWeek: day, isClosed: false } } });
    and.push({ NOT: { timeBlocks: { some: closedAllDay(date, day) } } });
  }

  if (q.availability === "open-now") {
    // "HH:MM" is zero-padded, so Postgres string comparison is clock
    // comparison. The same rule as the card's badge (hours.ts isOpenAt),
    // so the filter and the badge never disagree: a normal day is open
    // from openTime to closeTime; a day trading past midnight (closeTime
    // wrapped at or below openTime) is open from openTime on and before
    // closeTime.
    and.push({
      availability: {
        some: {
          dayOfWeek,
          isClosed: false,
          OR: [
            { openTime: { lte: time }, closeTime: { gt: time } },
            {
              closeTime: { lte: db.availabilityRule.fields.openTime },
              OR: [{ openTime: { lte: time } }, { closeTime: { gt: time } }],
            },
          ],
        },
      },
    });
    // Closed today (a holiday, a closure) or blocked right now.
    and.push({
      NOT: {
        timeBlocks: {
          some: {
            OR: [
              closedAllDay(today, dayOfWeek),
              // Blocked right now: a timed block, dated or weekly.
              { AND: [WHOLE_BUSINESS, appliesOn(today, dayOfWeek), { startTime: { lte: time }, endTime: { gt: time } }] },
            ],
          },
        },
      },
    });
  }

  return { AND: and };
}

/** A time block that takes the whole business, not one person or branch. */
const WHOLE_BUSINESS = { staffMemberId: null, branchId: null } as const;

/*
 * Time blocks, read exactly as the booking engine reads them
 * (lib/scheduling/calendar.ts): a weekly block (dayOfWeek set) applies on
 * that weekday; a dated block covers startsOn to endsOn inclusive, or
 * startsOn alone when endsOn is empty; a block missing its start or end
 * time is the whole day. The filter must never call open a business the
 * booking panel would offer no time at.
 */

/** A block that applies on `day` (UTC-midnight date), whose weekday is `dow`. */
const appliesOn = (day: Date, dow: number): Prisma.TimeBlockWhereInput => ({
  OR: [
    { dayOfWeek: dow },
    { startsOn: { lte: day }, endsOn: { gte: day } },
    { startsOn: day, endsOn: null },
  ],
});

/** The whole business closed all of `day`. */
const closedAllDay = (day: Date, dow: number): Prisma.TimeBlockWhereInput => ({
  AND: [WHOLE_BUSINESS, appliesOn(day, dow), { OR: [{ startTime: null }, { endTime: null }] }],
});

/** The plans that may take deposits, as a WHERE (mirrors getEffectivePlan). */
const DEPOSIT_PLANS = (Object.keys(PLAN_PRICES_EGP) as Plan[]).filter((p) => canUseFeature(p, "deposits"));
const DEPOSITS_ALLOWED = (now: Date): Prisma.BusinessWhereInput => ({
  OR: [
    // A live trial runs as PRO.
    ...(canUseFeature("PRO", "deposits") ? [{ subscriptionStatus: "TRIAL" as const, trialEndsAt: { gt: now } }] : []),
    { subscriptionStatus: { not: "INACTIVE" as const }, plan: { in: DEPOSIT_PLANS } },
  ],
});

/* ─── ORDER BY ───────────────────────────────────────────── */

function buildOrderBy(sort: DiscoveryQuery["sort"]): Prisma.BusinessOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      // nulls last, so an unrated business never outranks a rated one.
      return [{ ratingAvg: { sort: "desc", nulls: "last" } }, { ratingCount: "desc" }, { createdAt: "desc" }, { id: "asc" }];
    case "most-booked":
      return [{ bookings: { _count: "desc" } }, { createdAt: "desc" }, { id: "asc" }];
    case "price-asc":
    case "price-desc":
    case "soonest":
      // Settled after the fetch — see sortInMemory.
      return [{ createdAt: "desc" }, { id: "asc" }];
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
        // The last tie-breaker must be unique, or two rows created in the
        // same instant (an import, a seed) can swap places between two
        // OFFSET pages: one shown twice, the other never.
        { id: "asc" },
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
  plan: true,
  subscriptionStatus: true,
  trialEndsAt: true,
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
  latitude: true,
  longitude: true,
  branches: {
    where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, nameAr: true, nameEn: true, latitude: true, longitude: true },
  },
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
    // What the booking will actually do: deposits on AND allowed by the plan.
    acceptsOnlinePayment:
      row.depositEnabled && canUseFeature(getEffectivePlan(row.plan, row.subscriptionStatus, row.trialEndsAt), "deposits"),
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
    pins: pinsOf(row),
  };
}

function pinsOf(row: Row): MapPin[] {
  const pins: MapPin[] = [];
  if (row.latitude !== null && row.longitude !== null) {
    pins.push({ lat: row.latitude, lng: row.longitude, branchId: null, branchNameAr: null, branchNameEn: null });
  }
  for (const b of row.branches) {
    if (b.latitude === null || b.longitude === null) continue;
    pins.push({ lat: b.latitude, lng: b.longitude, branchId: b.id, branchNameAr: b.nameAr, branchNameEn: b.nameEn });
  }
  return pins;
}

/**
 * Cards for a known set of businesses — the nearby search's candidates —
 * through the same filters, mapping and next-free computation as the
 * search itself, so a card is identical however it was found.
 */
export async function cardsForIds(ids: string[], q: DiscoveryQuery, now: Date = new Date()): Promise<DiscoveryBusiness[]> {
  if (ids.length === 0) return [];
  const { dayOfWeek, time } = cairoNow(now);
  const rows = await db.business.findMany({
    where: { AND: [buildWhere(q, now), { id: { in: ids } }] },
    select: SELECT,
  });
  const mapped = rows.map((r) => toBusiness(r, dayOfWeek, time));
  await Promise.all([attachNextSlots(mapped, now), settleInstantBadges(mapped, now)]);
  return mapped;
}

/**
 * Fills in nextSlot for one page of results, by the booking engine's own
 * rule (lib/discovery/next-free) — the one the profile page and the
 * booking widget use, so a card never promises a time the profile does
 * not show. Three queries regardless of page size.
 */
async function attachNextSlots(list: DiscoveryBusiness[], now: Date): Promise<void> {
  if (list.length === 0) return;
  const ids = list.map((b) => b.id);

  const [services, schedules] = await Promise.all([
    // The shortest service of each business, and which one it is: the
    // members who do it decide the time.
    db.service.findMany({
      where: { businessId: { in: ids }, isAvailable: true, duration: { gt: 0 } },
      orderBy: [{ businessId: "asc" }, { duration: "asc" }],
      distinct: ["businessId"],
      select: { id: true, businessId: true, duration: true },
    }),
    loadSchedules(ids, now),
  ]);

  const shortestOf = new Map(services.map((s) => [s.businessId, s]));

  for (const b of list) {
    const schedule = schedules.get(b.id);
    const quickest = shortestOf.get(b.id);
    b.nextSlot = schedule && quickest ? firstFree(schedule, quickest.duration, null, quickest.id) : null;
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

  const mapped = rows.map((r) => toBusiness(r, dayOfWeek, time));

  // "Soonest" ranks by the next free slot, so every candidate needs one
  // before sorting; otherwise only the page shown does. That is the full
  // booking engine over up to DERIVED_CAP businesses — three queries, then
  // arithmetic — the price of the order matching what each card shows.
  if (q.sort === "soonest") await attachNextSlots(mapped, now);
  const ordered = sortInMemory(mapped, q.sort);
  const businesses = derivedSort
    ? ordered.slice((q.page - 1) * PAGE_SIZE, q.page * PAGE_SIZE)
    : ordered;
  if (q.sort !== "soonest") await attachNextSlots(businesses, now);
  // Only the page shown: the badge is what the card says.
  await settleInstantBadges(businesses, now);

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
