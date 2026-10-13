/**
 * The shapes the server actually returns.
 *
 * Transcribed from the route handlers rather than guessed, and kept
 * deliberately narrow: a screen needs the fields it renders, and
 * copying the whole Prisma model here would mean every schema change
 * looks like a mobile change.
 *
 * Where the server can return null it is `| null` here, because those
 * nulls are the interesting cases. A business with no rating must show
 * nothing rather than a zero, and a service with no price must not
 * render "0 ج.م" — the web learned that the hard way and the app
 * should not relearn it.
 */

/* ─── Discovery ──────────────────────────────────────────── */

/**
 * Mirrors src/lib/discovery/hours.ts. "unknown" is a business with no
 * hours set — the card stays silent rather than guessing it is closed.
 * (An earlier copy here read `isOpen`, which the server never sends, so
 * every business showed as closed.)
 */
export type OpenState =
  | { state: "open"; closesAt: string }
  | { state: "closed"; opensInDays: number; opensAt: string }
  | { state: "unknown" };

/** Mirrors src/lib/discovery/next-slot.ts: days from today in Cairo, and a Cairo time. */
export interface NextSlot {
  dayOffset: number;
  time: string;
}

export interface Business {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  taglineAr: string | null;
  coverImage: string | null;
  logoImage: string | null;
  isVerified: boolean;
  /** Bookings confirm without the business approving each. */
  autoConfirm: boolean;
  acceptsOnlinePayment: boolean;
  /** null when nobody has reviewed it. Never shown as a zero. */
  ratingAvg: number | null;
  ratingCount: number;
  category: { slug: string; nameAr: string; nameEn: string };
  city: { slug: string; nameAr: string; nameEn: string };
  neighborhood: { slug: string; nameAr: string; nameEn: string } | null;
  /** null when no bookable service has a price. Never shown as a zero. */
  minPrice: number | null;
  currency: string;
  bookingCount: number;
  open: OpenState;
  /** The first genuinely free appointment, or null. Never a guess. */
  nextSlot: NextSlot | null;
  /** Its own pin and each active branch's, as the owner set them. Empty when none. */
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

/** GET /api/public/businesses/nearby — nearest first. */
export interface NearbyBusiness extends Business {
  distanceKm: number;
  nearest: { lat: number; lng: number; branchId: string | null };
}

export interface NearbyResponse {
  businesses: NearbyBusiness[];
  radiusKm: number;
}

export interface FacetCategory {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  /** Published businesses filed under it, children included. */
  count: number;
}

export interface FacetCity {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  count: number;
}

/** GET /api/public/facets — src/lib/discovery/search.ts getFacets(). */
export interface Facets {
  categories: (FacetCategory & { children: FacetCategory[] })[];
  cities: FacetCity[];
  /** Only when a city was asked for. */
  neighborhoods: { id: string; slug: string; nameAr: string; nameEn: string; cityId: string }[];
}

export interface BusinessPage {
  businesses: Business[];
  total: number;
  page: number;
  pageCount: number;
  /** The pages end before `total`: price and "soonest" sorts rank the first 240 matches only. */
  capped?: boolean;
}

/* ─── A customer's own bookings ──────────────────────────── */

export interface MyBooking {
  id: string;
  reference: string | null;
  accessToken: string | null;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** Negative once it has passed. */
  minutesUntil: number;
  serviceName: string;
  serviceNameEn: string | null;
  staffName: string | null;
  staffNameEn: string | null;
  resourceName: string | null;
  branchName: string | null;
  branchNameEn: string | null;
  partySize: number | null;
  totalPrice: number;
  depositAmount: number | null;
  currency: string;
  business: {
    slug: string;
    nameAr: string;
    nameEn: string | null;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
    logoImage: string | null;
    coverImage: string | null;
    categorySlug: string;
    cityName: string;
    cityNameEn: string;
    neighborhoodName: string | null;
  };
  hasReview: boolean;
  canReview: boolean;
}

export interface MyBookingsResponse {
  bookings: MyBooking[];
  total: number;
  /**
   * True for an account with no verified phone — an owner who signed up
   * by email, say. Bookings are found by number, so there is nothing to
   * show, and that is a different screen from "you have none yet".
   */
  needsPhone: boolean;
}

/* ─── Saved places ───────────────────────────────────────── */

export interface SavedBusiness {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  logoImage: string | null;
  coverImage: string | null;
  isVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  category: { slug: string; nameAr: string; nameEn: string };
  city: { nameAr: string; nameEn: string };
  savedAt: string;
}

/* ─── Account ────────────────────────────────────────────── */

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Distinguishes "no number" from "number not confirmed". */
  phoneVerified: boolean;
  notifyByWhatsApp: boolean;
  notifyByEmail: boolean;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unread: number;
}

/* ─── The owner's side ───────────────────────────────────── */

export interface BusinessBooking {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceDuration: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  depositAmount: number | null;
  currency: string;
  notes: string | null;
  customerNotes: string | null;
  createdAt: string;
  tableName: string | null;
  staffName: string | null;
  partySize: number | null;
}

export interface BusinessBookingsResponse {
  bookings: BusinessBooking[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface BusinessCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  bookingCount: number;
  totalSpend: number;
  lastBookingDate: string | null;
  currency: string;
}

export interface CustomersResponse {
  customers: BusinessCustomer[];
  total: number;
}

export interface Analytics {
  kpis: {
    totalBookings: number;
    completedRevenue: number;
    avgBookingValue: number;
    repeatCustomerRate: number;
    currency: string;
  };
  revenueByPeriod: { period: string; revenue: number; bookings: number }[];
  bookingsByService: { serviceName: string; bookings: number; revenue: number }[];
  granularity: "day" | "week" | "month";
}

/* ─── One business, as the public sees it ────────────────── */

/** GET /api/public/[slug] — src/lib/discovery/profile.ts getPublicProfile(). */
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
  autoConfirm: boolean;
  /** True only when a deposit really is taken online at booking. */
  acceptsOnlinePayment: boolean;
  businessType: "GENERAL" | "RESTAURANT" | "BARBERSHOP";
  /** parentSlug is set for a subcategory. */
  category: { slug: string; nameAr: string; nameEn: string; parentSlug: string | null };
  city: { slug: string; nameAr: string; nameEn: string };
  neighborhood: { slug: string; nameAr: string; nameEn: string } | null;
  address: string | null;
  /** The owner's pin, or null — never derived from the address. */
  location: { lat: number; lng: number } | null;
  phone: string | null;
  whatsapp: string | null;
  images: { url: string; caption: string | null }[];
  services: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    descriptionAr: string | null;
    durationMinutes: number;
    /** null when unpriced — never shown as free. */
    price: number | null;
    currency: string;
  }[];
  minPrice: number | null;
  currency: string;
  /** dayOfWeek 0 = Sunday. */
  hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
  open: OpenState;
  nextSlot: NextSlot | null;
  rating: { average: number | null; count: number; distribution: Record<"1" | "2" | "3" | "4" | "5", number> };
  reviews: PublicReview[];
  branches: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    address: string | null;
    phone: string | null;
    location: { lat: number; lng: number } | null;
  }[];
  staff: PublicStaffMember[];
  resources: PublicResource[];
  policies: BookingPolicies;
}

export type DayHours = { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean };

export interface PublicStaffMember {
  id: string;
  nameAr: string;
  nameEn: string | null;
  role: string | null;
  photo: string | null;
  specialties: string[];
  /** Services they perform; empty means all of them. */
  serviceIds: string[];
  /** When they can be booked, already inside the business's hours. */
  hours: DayHours[];
  nextSlot: NextSlot | null;
}

export interface PublicResource {
  id: string;
  kind: "TABLE" | "ROOM" | "CHAIR" | "EQUIPMENT" | "OTHER";
  name: string;
  capacity: number | null;
  area: string | null;
  branchId: string | null;
}

export interface BookingPolicies {
  /** Percent paid online to hold a booking; null when nothing is taken. */
  depositPercent: number | null;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  /** "HH:MM"; no more same-day bookings after it. */
  sameDayCutoff: string | null;
  /** Cancel or move it yourself until this many hours before. */
  changeCutoffHours: number;
}

export interface ReviewPage {
  reviews: PublicReview[];
  /** How many match the current filter, across all pages. */
  matched: number;
  page: number;
  pageSize: number;
}

export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** First name only. */
  authorName: string;
  verifiedBooking: boolean;
  serviceName: string | null;
  bookedOn: string | null;
  photos: string[];
}

/* ─── Booking ────────────────────────────────────────────── */

/** GET /api/public/[slug]/slots — the times the server will accept. */
export interface SlotsResponse {
  slots: string[];
  /** Why a day is empty: business-closed, staff-off, holiday, vacation, same-day-cutoff, too-far-ahead, past. */
  reason: string | null;
}

/** POST /api/public/[slug]/quote — what the booking costs, from the same rules that charge it. */
export interface Quote {
  subtotalCents: number;
  totalCents: number;
  currency: string;
  discount: { nameAr: string; code: string | null; amountCents: number; automatic: boolean } | null;
  codeError: string | null;
}

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PENDING"
  | "CONFIRMED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "FAILED_PAYMENT";

/** POST /api/public/[slug]/bookings, success. */
export interface CreateBookingResponse {
  booking: {
    id: string;
    reference: string | null;
    accessToken: string;
    date: string;
    startTime: string;
    endTime: string;
    totalPrice: number;
    depositAmount: number | null;
    currency: string;
    status: BookingStatus;
  };
  requiresPayment: boolean;
  /** Present when a deposit session was opened. */
  paymentUrl?: string;
  /** The same idempotency key was seen before; this is that booking. */
  idempotentReplay?: boolean;
}

/** GET /api/public/booking/[token] — the authoritative state of one booking. */
export interface PublicBooking {
  id: string;
  reference: string | null;
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  partySize: number | null;
  notes: string | null;
  customerName: string;
  totalPrice: number;
  depositAmount: number | null;
  discountAmount: number;
  currency: string;
  createdAt: string;
  business: {
    slug: string;
    nameAr: string;
    nameEn: string | null;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
    location: { lat: number; lng: number } | null;
    logoImage: string | null;
    cityNameAr: string;
    cityNameEn: string;
  };
  service: { id: string; nameAr: string; nameEn: string | null };
  staff: { id: string; nameAr: string; nameEn: string | null } | null;
  resource: { id: string; name: string; kind: string } | null;
  branch: { id: string; nameAr: string; nameEn: string | null; address: string | null; location: { lat: number; lng: number } | null } | null;
  payment: {
    status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "ABANDONED";
    amount: number;
    /** Refunded so far, from the ledger. */
    refunded: number;
    currency: string;
    paidAt: string | null;
  } | null;
  notifications: { channel: "IN_APP" | "EMAIL" | "WHATSAPP" | "SMS" | "PUSH"; status: "SENT" | "SKIPPED" | "FAILED" }[];
  canChange: boolean;
  changeCutoffHours: number;
  canReview: boolean;
  reviewBlock: "not-completed" | "already-reviewed" | "too-late" | null;
  review: {
    rating: number;
    comment: string | null;
    response: string | null;
    createdAt: string;
    status: string;
    canEdit: boolean;
  } | null;
}

/* ─── Account extras ─────────────────────────────────────── */

export interface MyReview {
  id: string;
  rating: number;
  comment: string | null;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  business: { slug: string; nameAr: string; logoImage: string | null };
  date: string;
  serviceName: string;
}

export interface AccountPayment {
  id: string;
  kind: string;
  status: "SUCCEEDED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  method: string | null;
  amountCents: number;
  refundedCents: number;
  currency: string;
  receiptNumber: string | null;
  paidAt: string | null;
  bookingRef: string | null;
  bookingDate: string | null;
  startTime: string | null;
  serviceAr: string | null;
  serviceEn: string | null;
  businessAr: string | null;
  businessEn: string | null;
  businessSlug: string | null;
}

export interface AccountSession {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}
