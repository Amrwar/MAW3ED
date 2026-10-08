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

export interface OpenState {
  isOpen: boolean;
  /** "9:00" etc., or null when the state does not imply a time. */
  opensAt?: string | null;
  closesAt?: string | null;
}

export interface NextSlot {
  date: string;
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
}

export interface BusinessPage {
  businesses: Business[];
  total: number;
  page: number;
  pageCount: number;
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
  staffName: string | null;
  resourceName: string | null;
  branchName: string | null;
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
