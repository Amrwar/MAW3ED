export type DashboardBookingStatus =
  | "PENDING_PAYMENT"
  | "PENDING"
  | "CONFIRMED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "FAILED_PAYMENT";

export type DashboardBooking = {
  id:              string;
  customerName:    string;
  customerPhone:   string;
  serviceName:     string;
  serviceDuration: number;
  date:            string; // "YYYY-MM-DD" UTC date
  startTime:       string; // "HH:MM"
  endTime:         string | null;
  status:          DashboardBookingStatus;
  totalPrice:      number;
  depositAmount:   number | null;
  currency:        string;
  notes:           string | null;
  customerNotes:   string | null;
  createdAt:       string; // ISO datetime
  // Business-type-specific
  tableName:       string | null;
  staffName:       string | null;
  partySize:       number | null;
};

export const STATUS_CONFIG: Record<
  DashboardBookingStatus,
  { label: string; className: string }
> = {
  PENDING_PAYMENT: { label: "في انتظار الدفع",  className: "bg-orange-50 text-orange-600 border border-orange-200" },
  PENDING:         { label: "في الانتظار",       className: "bg-amber-50 text-amber-600 border border-amber-200"   },
  CONFIRMED:       { label: "مؤكد",              className: "bg-green-50 text-green-600 border border-green-200"   },
  ARRIVED:         { label: "وصل",               className: "bg-teal-50 text-teal-600 border border-teal-200"      },
  IN_PROGRESS:     { label: "جاري التنفيذ",      className: "bg-indigo-50 text-indigo-600 border border-indigo-200" },
  COMPLETED:       { label: "مكتمل",             className: "bg-blue-50 text-blue-600 border border-blue-200"      },
  CANCELLED:       { label: "ملغي",              className: "bg-red-50 text-red-500 border border-red-200"         },
  NO_SHOW:         { label: "لم يحضر",           className: "bg-gray-100 text-gray-500 border border-gray-200"    },
  FAILED_PAYMENT:  { label: "فشل الدفع",         className: "bg-red-100 text-red-700 border border-red-300"        },
};

/** Which status transitions are allowed from a given status */
export const ALLOWED_TRANSITIONS: Partial<Record<DashboardBookingStatus, DashboardBookingStatus[]>> = {
  PENDING_PAYMENT: ["CANCELLED"],          // owner can cancel unpaid bookings
  PENDING:         ["CONFIRMED", "CANCELLED"],
  // The day-of path runs CONFIRMED → ARRIVED → IN_PROGRESS → COMPLETED,
  // but no step is mandatory: an owner who never touches the tablet can
  // still mark a booking COMPLETED straight from CONFIRMED, which is
  // what every existing business does today.
  CONFIRMED:       ["ARRIVED", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"],
  ARRIVED:         ["IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"],
  IN_PROGRESS:     ["COMPLETED", "CANCELLED"],
};

/** Arabic labels for action buttons */
export const ACTION_LABELS: Partial<Record<DashboardBookingStatus, string>> = {
  CONFIRMED:   "تأكيد الحجز",
  ARRIVED:     "العميل وصل",
  IN_PROGRESS: "بدأ التنفيذ",
  COMPLETED: "تمّ بنجاح",
  CANCELLED: "إلغاء الحجز",
  NO_SHOW:   "لم يحضر",
  // PENDING_PAYMENT and FAILED_PAYMENT are used as target statuses via ALLOWED_TRANSITIONS only
};

/** Action button variant colour */
export const ACTION_VARIANTS: Partial<Record<DashboardBookingStatus, string>> = {
  CONFIRMED:   "bg-green-600 hover:bg-green-700 text-white",
  ARRIVED:     "bg-teal-600 hover:bg-teal-700 text-white",
  IN_PROGRESS: "bg-indigo-600 hover:bg-indigo-700 text-white",
  COMPLETED: "bg-blue-600 hover:bg-blue-700 text-white",
  CANCELLED: "bg-red-500 hover:bg-red-600 text-white",
  NO_SHOW:   "bg-gray-400 hover:bg-gray-500 text-white",
};

export const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

export const AR_DAYS = [
  "الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت",
];

export function formatDateAr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return `${AR_DAYS[date.getDay()]}، ${d} ${AR_MONTHS[m - 1]}`;
}

export function getTodayISO(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}
