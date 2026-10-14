/**
 * The business side's API shapes, as src/app/api/business/* returns them.
 */

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

export type BusinessRole = "OWNER" | "MANAGER" | "PROVIDER";

interface Named {
  nameAr: string;
  nameEn: string | null;
}

/** One row of GET /api/business/bookings (the list and the calendar view). */
export interface CalendarBooking {
  id: string;
  reference: string | null;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceNameEn: string | null;
  serviceDuration: number;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  totalPrice: number;
  depositAmount: number | null;
  currency: string;
  notes: string | null;
  staffName: string | null;
  staffNameEn: string | null;
  staffMemberId: string | null;
  branchId: string | null;
  branchName: string | null;
  branchNameEn: string | null;
  partySize: number | null;
}

export interface CalendarResponse {
  bookings: CalendarBooking[];
  total: number;
}

/** GET /api/business/overview. */
export interface Overview {
  today: string;
  business: { id: string; nameAr: string; nameEn: string | null; slug: string; logo: string | null };
  actor: { role: BusinessRole; staffMemberId: string | null; staffName: Named | null; permissions: string[] };
  counts: { today: number; pending: number; cancelledRecent: number; done: number; unreadNotifications: number };
  next: TodayBooking | null;
  todays: TodayBooking[];
  pending: { id: string; date: string; startTime: string; customerName: string; service: Named; staffMember: Named | null }[];
  cancelled: { id: string; date: string; startTime: string; customerName: string; service: Named }[];
}

export interface TodayBooking {
  id: string;
  reference: string | null;
  status: BookingStatus;
  startTime: string;
  endTime: string | null;
  customerName: string;
  customerPhone: string;
  service: Named;
  staffMember: (Named & { id: string }) | null;
  branch: (Named & { id: string }) | null;
}

/** GET /api/business/bookings/[id]. */
export interface BookingDetail {
  id: string;
  reference: string | null;
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string | null;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  partySize: number | null;
  totalPrice: number;
  depositAmount: number | null;
  currency: string;
  service: (Named & { duration: number; price: number }) | null;
  staffMember: (Named & { id: string }) | null;
  branch: (Named & { id: string }) | null;
  resourceName: string | null;
  /** Null for a provider: the customer book is not theirs. */
  customer: { id: string; name: string; phone: string; notes: string | null; completedVisits: number | null } | null;
  /** The statuses this person may move it to. */
  actions: BookingStatus[];
  canReschedule: boolean;
  permissions: string[];
}

export interface StaffRow extends Named {
  id: string;
  role: string | null;
  photo: string | null;
  isActive: boolean;
  workingDays: number[];
  services: { service: { id: string; nameAr: string } }[];
  /** Owner only. */
  access?: BusinessRole | null;
  loginPhone?: string | null;
  linked?: boolean;
  /** Staff only: this is the signed-in person. */
  isYou?: boolean;
}

export interface ServiceRow extends Named {
  id: string;
  duration: number;
  price: number | string;
  isAvailable: boolean;
  descriptionAr?: string | null;
}

export interface BusinessProfile extends Named {
  id: string;
  slug: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  logoImage: string | null;
  coverImage: string | null;
  isPublished: boolean;
  autoConfirm: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  category: { nameAr: string; nameEn: string } | null;
  city: { nameAr: string; nameEn: string } | null;
  availability: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
  branches: (Named & { id: string; address: string | null })[];
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  bookingCount: number;
  totalSpend: number;
  currency: string;
  lastBookingDate: string | null;
  bookings: {
    id: string;
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string | null;
    status: BookingStatus;
    totalPrice: number;
    currency: string;
  }[];
}
