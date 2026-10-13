/**
 * The words the design system's own components say — a close button's
 * label, "Try again", "Loading". Screens' copy lives with the screens;
 * this is only what a component cannot be given by its caller without
 * every caller repeating it.
 *
 * Egyptian Arabic, matching the app's existing voice.
 */
export const strings = {
  ar: {
    close: "إغلاق",
    back: "رجوع",
    cancel: "إلغاء",
    confirm: "تأكيد",
    retry: "حاول تاني",
    loading: "لحظة…",
    clear: "مسح",
    search: "ابحث",
    select: "اختر",
    today: "النهاردة",
    tomorrow: "بكرة",
    previousMonth: "الشهر اللي فات",
    nextMonth: "الشهر الجاي",
    unavailable: "غير متاح",
    selected: "محدد",
    noTimes: "مفيش مواعيد متاحة في اليوم ده",
    offlineTitle: "مفيش اتصال بالإنترنت",
    offlineBody: "اتأكد من الاتصال وجرب تاني.",
    errorTitle: "حصل خطأ",
    errorBody: "حاجة مشيت غلط. جرّب تاني بعد شوية.",
    ratingOf: "{n} من 5",
    reviews: "{n} تقييم",
    noReviews: "جديد",
    verified: "موثّق",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    required: "مطلوب",
    dismiss: "إخفاء",
  },
  en: {
    close: "Close",
    back: "Back",
    cancel: "Cancel",
    confirm: "Confirm",
    retry: "Try again",
    loading: "Loading…",
    clear: "Clear",
    search: "Search",
    select: "Select",
    today: "Today",
    tomorrow: "Tomorrow",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    unavailable: "Unavailable",
    selected: "Selected",
    noTimes: "No times available on this day",
    offlineTitle: "You're offline",
    offlineBody: "Check your connection and try again.",
    errorTitle: "Something went wrong",
    errorBody: "Something didn't work. Try again in a moment.",
    ratingOf: "{n} out of 5",
    reviews: "{n} reviews",
    noReviews: "New",
    verified: "Verified",
    showPassword: "Show password",
    hidePassword: "Hide password",
    required: "Required",
    dismiss: "Dismiss",
  },
} as const;

export type StringKey = keyof (typeof strings)["ar"];

/** "{n} من 5" with n filled in. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

/** Phrases joined for a screen reader, with the language's own comma. */
export function joinLabel(lang: "ar" | "en", ...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(lang === "ar" ? "، " : ", ");
}
