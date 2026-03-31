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
  PENDING:   { label: "\u0641\u064a \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", className: "bg-amber-50 text-amber-600 border border-amber-200" },
  CONFIRMED: { label: "\u0645\u0624\u0643\u062f",         className: "bg-green-50 text-green-600 border border-green-200"  },
  COMPLETED: { label: "\u0645\u0643\u062a\u0645\u0644",         className: "bg-blue-50 text-blue-600 border border-blue-200"    },
  CANCELLED: { label: "\u0645\u0644\u063a\u064a",          className: "bg-red-50 text-red-500 border border-red-200"        },
  NO_SHOW:   { label: "\u0644\u0645 \u064a\u062d\u0636\u0631",    className: "bg-gray-100 text-gray-500 border border-gray-200"  },
};

/** Which status transitions are allowed from a given status */
export const ALLOWED_TRANSITIONS: Partial<Record<DashboardBookingStatus, DashboardBookingStatus[]>> = {
  PENDING:   ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
};

/** Arabic labels for action buttons */
export const ACTION_LABELS: Partial<Record<DashboardBookingStatus, string>> = {
  CONFIRMED: "\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062d\u062c\u0632",
  COMPLETED: "\u062a\u0645\u0651 \u0628\u0646\u062c\u0627\u062d",
  CANCELLED: "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062d\u062c\u0632",
  NO_SHOW:   "\u0644\u0645 \u064a\u062d\u0636\u0631",
};

/** Action button variant colour */
export const ACTION_VARIANTS: Partial<Record<DashboardBookingStatus, string>> = {
  CONFIRMED: "bg-green-600 hover:bg-green-700 text-white",
  COMPLETED: "bg-blue-600 hover:bg-blue-700 text-white",
  CANCELLED: "bg-red-500 hover:bg-red-600 text-white",
  NO_SHOW:   "bg-gray-400 hover:bg-gray-500 text-white",
};

export const AR_MONTHS = [
  "\u064a\u0646\u0627\u064a\u0631","\u0641\u0628\u0631\u0627\u064a\u0631","\u0645\u0627\u0631\u0633",
  "\u0623\u0628\u0631\u064a\u0644","\u0645\u0627\u064a\u0648","\u064a\u0648\u0646\u064a\u0648",
  "\u064a\u0648\u0644\u064a\u0648","\u0623\u063a\u0633\u0637\u0633","\u0633\u0628\u062a\u0645\u0628\u0631",
  "\u0623\u0643\u062a\u0648\u0628\u0631","\u0646\u0648\u0641\u0645\u0628\u0631","\u062f\u064a\u0633\u0645\u0628\u0631",
];

export const AR_DAYS = [
  "\u0627\u0644\u0623\u062d\u062f","\u0627\u0644\u0627\u062b\u0646\u064a\u0646","\u0627\u0644\u062b\u0644\u0627\u062b\u0627\u0621",
  "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621","\u0627\u0644\u062e\u0645\u064a\u0633","\u0627\u0644\u062c\u0645\u0639\u0629","\u0627\u0644\u0633\u0628\u062a",
];

export function formatDateAr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return `${AR_DAYS[date.getDay()]}\u060c ${d} ${AR_MONTHS[m - 1]}`;
}

export function getTodayISO(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}
