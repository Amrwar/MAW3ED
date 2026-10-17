// The app's own words, in both languages — the one place the language
// flows (09, 10, 11, 20) take their text from. Each value is copied from
// the component that shows it (file noted); when the copy changes there,
// change it here.
//
// Maestro matches `text:` as a regular expression over the whole label,
// and also accepts an exact match of the string itself, so plain strings
// work as long as they are valid regexes (no unbalanced brackets).
//
// Run with runScript and the env APP_LANG ("ar" or "en"); the strings for
// that language land in output.s, the other language's in output.other,
// and a regex for "any letter of the other script" in output.s.otherScript.

/* global output, APP_LANG -- provided by Maestro: output is shared with the flows, APP_LANG comes from env. */
// Wrapped in a function: flows that start twice (11, 19) run this twice in
// the same JavaScript context, where a second top-level const would throw.
(function () {
const S = {
  ar: {
    // app/(customer)/_layout.tsx
    tabHome: "الرئيسية",
    tabSearch: "ابحث",
    tabBookings: "حجوزاتي",
    tabFavorites: "المحفوظات",
    tabAccount: "حسابي",
    // design/strings.ts
    back: "رجوع",
    // app/(customer)/index.tsx
    homeSignIn: "دخول",
    homeSearchLabel: "ابحث عن مكان أو خدمة",
    homeCategories: "الأقسام",
    chooseCity: "اختار المدينة",
    // app/(customer)/search.tsx, features/discovery/FilterSheet.tsx, labels.ts
    searchPlaceholder: "اسم مكان، خدمة أو منطقة",
    filters: "الفلاتر",
    showResults: "اعرض النتايج",
    clearAll: "مسح الكل",
    sortRecommended: "الأنسب",
    sortBy: "الترتيب",
    noPlacesMatch: "مفيش أماكن مطابقة",
    // app/business/[slug]/index.tsx
    reviews: "التقييمات",
    bookingPolicy: "سياسة الحجز",
    // app/book/[slug].tsx
    continue: "كمّل",
    // features/auth/SignInGate.tsx + the three tabs
    signInFirst: "سجّل دخولك الأول",
    gateSignIn: "تسجيل الدخول",
    gateBookings: "حجوزاتي",
    gateFavorites: "المحفوظات",
    gateAccount: "حسابي",
    // app/(auth)/login.tsx (the screen title carries the brand name, which
    // is still being settled, so it is not asserted)
    customerTab: "عميل",
    businessTab: "صاحب نشاط",
    mobileNumber: "رقم الموبايل",
    sendCode: "ابعت الكود",
    newHere: "أول مرة؟ هنعملك حساب تلقائيًا بعد ما تأكد رقمك.",
    businessSignIn: "دخول أصحاب الأعمال",
    email: "الإيميل",
    password: "كلمة المرور",
    forgotPassword: "نسيت كلمة المرور؟",
    signInButton: "تسجيل الدخول",
    createBusiness: "سجّل نشاطك على موعد",
    // features/auth/AuthShell.tsx (LegalNote): the two linked words
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية",
    // features/auth/PhoneField.tsx
    chooseCountry: "اختار الدولة",
    noCountry: "مفيش دولة بالاسم ده",
    egyptOption: "مصر.*20",
    // app/nearby.tsx
    nearMe: "قريب مني",
    useMyLocation: "استخدم موقعي",
    // app/business/[slug]/index.tsx (a link to a place that does not exist)
    placeMissing: "المكان ده مش متاح",
    // app/(business)/_layout.tsx, index.tsx, calendar.tsx, customers.tsx, account.tsx, manage/*
    bizTabToday: "النهارده",
    bizTabCalendar: "التقويم",
    bizTabCustomers: "العملاء",
    bizTabMore: "المزيد",
    bizSchedule: "جدول النهارده",
    calendarDay: "يوم",
    calendarWeek: "أسبوع",
    customersSearch: "ابحث في العملاء",
    noMatches: "مفيش نتايج",
    bizProfile: "صفحة النشاط",
    bizStaff: "الفريق",
    bizServices: "الخدمات",
    bizReports: "التقارير",
    bookingTitle: "الحجز",
    signOut: "تسجيل الخروج",
  },
  en: {
    tabHome: "Home",
    tabSearch: "Search",
    tabBookings: "Bookings",
    tabFavorites: "Favorites",
    tabAccount: "Account",
    back: "Back",
    homeSignIn: "Sign in",
    homeSearchLabel: "Search for a place or service",
    homeCategories: "Categories",
    chooseCity: "Choose a city",
    searchPlaceholder: "A place, service or area",
    filters: "Filters",
    showResults: "Show results",
    clearAll: "Clear all",
    sortRecommended: "Recommended",
    sortBy: "Sort by",
    noPlacesMatch: "No places match",
    reviews: "Reviews",
    bookingPolicy: "Booking policy",
    continue: "Continue",
    signInFirst: "Sign in first",
    gateSignIn: "Sign in",
    gateBookings: "My bookings",
    gateFavorites: "Favorites",
    gateAccount: "Account",
    customerTab: "Customer",
    businessTab: "Business",
    mobileNumber: "Mobile number",
    sendCode: "Send code",
    newHere: "New here\\? Your account is created as soon as you confirm your number\\.",
    businessSignIn: "Business sign-in",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password\\?",
    signInButton: "Sign in",
    createBusiness: "Create a business account",
    terms: "Terms & Conditions",
    privacy: "Privacy policy",
    chooseCountry: "Choose your country",
    noCountry: "No country matches",
    egyptOption: "Egypt.*20",
    nearMe: "Near me",
    useMyLocation: "Use my location",
    placeMissing: "This place isn.t available",
    bizTabToday: "Today",
    bizTabCalendar: "Calendar",
    bizTabCustomers: "Customers",
    bizTabMore: "More",
    bizSchedule: "Today.s schedule",
    calendarDay: "Day",
    calendarWeek: "Week",
    customersSearch: "Search customers",
    noMatches: "No matches",
    bizProfile: "Business profile",
    bizStaff: "Staff",
    bizServices: "Services",
    bizReports: "Reports",
    bookingTitle: "Booking",
    signOut: "Sign out",
  },
};

const lang = typeof APP_LANG !== "undefined" && APP_LANG === "en" ? "en" : "ar";
output.lang = lang;
output.s = S[lang];
output.other = S[lang === "ar" ? "en" : "ar"];
// Any letter of the other language's script, anywhere in a label.
output.s.otherScript = lang === "ar" ? "(?s).*[A-Za-z].*" : "(?s).*[\\u0600-\\u06FF].*";
})();
