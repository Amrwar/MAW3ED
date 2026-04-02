export type DashboardBookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

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
  currency:        string;
  notes:           string | null;
  customerNotes:   string | null;
  createdAt:       string; // ISO datetime
};

export const STATUS_CONFIG: Record<
  DashboardBookingStatus,
  { label: string; className: string }
> = {
  PENDING:   { label: "في الانتظار", className: "bg-amber-50 text-amber-600 border border-amber-200" },
  CONFIRMED: { label: "مؤكد",        className: "bg-green-50 text-green-600 border border-green-200"  },
  COMPLETED: { label: "مكتمل",       className: "bg-blue-50 text-blue-600 border border-blue-200"    },
  CANCELLED: { label: "ملغي",        className: "bg-red-50 text-red-500 border border-red-200"        },
  NO_SHOW:   { label: "لم يحضر",     className: "bg-gray-100 text-gray-500 border border-gray-200"  },
};

/** Which status transitions are allowed from a given status */
export const ALLOWED_TRANSITIONS: Partial<Record<DashboardBookingStatus, DashboardBookingStatus[]>> = {
  PENDING:   ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
};

/** Arabic labels for action buttons */
export const ACTION_LABELS: Partial<Record<DashboardBookingStatus, string>> = {
  CONFIRMED: "تأكيد الحجز",
  COMPLETED: "تمّ بنجاح",
  CANCELLED: "إلغاء الحجز",
  NO_SHOW:   "لم يحضر",
};

/** Action button variant colour */
export const ACTION_VARIANTS: Partial<Record<DashboardBookingStatus, string>> = {
  CONFIRMED: "bg-green-600 hover:bg-green-700 text-white",
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
