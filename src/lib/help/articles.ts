import { PLAN_PRICES_EGP, PLAN_FEATURES, ANNUAL_MONTHS_CHARGED } from "@/lib/plans";
import { MAX_ROWS } from "@/lib/import/csv";

/**
 * The help centre's articles, in both languages.
 *
 * Kept as data beside the code whose rules they explain, and built from
 * the same constants where a number is involved (plan prices and
 * limits, the import cap), so an article cannot quote a limit the
 * product no longer has.
 */

export interface HelpSection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface HelpArticleText {
  title: string;
  summary: string;
  sections: HelpSection[];
}

export interface HelpArticle {
  slug: string;
  audience: "business" | "customer";
  ar: HelpArticleText;
  en: HelpArticleText;
  /** Where in the product this article is about. */
  related?: { href: string; ar: string; en: string };
}

const FREE_LIMIT = PLAN_FEATURES.FREE.monthlyBookings;
const PRO_STAFF = PLAN_FEATURES.PRO.staffMembers;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started",
    audience: "business",
    related: { href: "/dashboard/setup", ar: "افتح تجهيز النشاط", en: "Open setup" },
    ar: {
      title: "إزاي تجهّز نشاطك وتنشره",
      summary: "الخطوات من التسجيل لحد أول حجز حقيقي.",
      sections: [
        {
          paragraphs: [
            "صفحتك بتتعمل خاصة: محدش يشوفها غيرك لحد ما تنشرها. صفحة \"تجهيز النشاط\" بتقولك بالظبط إيه الناقص.",
          ],
          bullets: [
            "المطلوب قبل النشر: التصنيف، رقم تليفون، إيميل متأكد، العنوان، مواعيد العمل، خدمة واحدة على الأقل بمدة وسعر صح، ومراجعة سياسات الحجز والإلغاء.",
            "المستحسن (مش بيمنع النشر): الموقع على الخريطة، تأكيد الواتساب، اللوجو والوصف، الفريق أو الطاولات، وحجز تجريبي.",
            "لو بدأت التسجيل ومكملتش، بنحفظ خطواتك على السيرفر وتقدر تكمّل من أي جهاز.",
          ],
        },
        {
          heading: "النشر",
          paragraphs: [
            "لما المطلوب كله يخلص، دوس \"انشر صفحتي\". لو فاضل تأكيد الإيميل بس، الصفحة هتتنشر لوحدها أول ما تفتح رابط التأكيد.",
            "تقدر تخفي صفحتك في أي وقت. الحجوزات اللي موجودة بتفضل زي ما هي.",
          ],
        },
      ],
    },
    en: {
      title: "Setting up and publishing your business",
      summary: "The steps from sign-up to your first real booking.",
      sections: [
        {
          paragraphs: [
            "Your page starts private: nobody but you can see it until you publish. The Setup page lists exactly what is missing.",
          ],
          bullets: [
            "Required before publishing: category, phone number, confirmed email, address, opening hours, at least one service with a valid duration and price, and a review of your booking and cancellation policies.",
            "Recommended (never blocks publishing): map location, confirmed WhatsApp, logo and description, team or tables, and a test booking.",
            "If you start signing up and stop, your progress is saved on our server and you can continue on any device.",
          ],
        },
        {
          heading: "Publishing",
          paragraphs: [
            "When everything required is done, press \"Publish my page\". If only the email confirmation is left, the page goes live by itself as soon as you open the confirmation link.",
            "You can hide your page at any time. Existing bookings are kept.",
          ],
        },
      ],
    },
  },
  {
    slug: "test-booking",
    audience: "business",
    related: { href: "/dashboard/setup#test", ar: "جرّب حجز تجريبي", en: "Try a test booking" },
    ar: {
      title: "الحجز التجريبي",
      summary: "جرّب صفحتك زي العميل قبل ما تنشرها.",
      sections: [
        {
          paragraphs: [
            "قبل النشر، افتح المعاينة من صفحة التجهيز واحجز أي خدمة. الحجز بيمشي في نظام الحجز الحقيقي بنفس المواعيد والقواعد.",
          ],
          bullets: [
            "مفيش عميل بيتسجل، ومفيش إيميل أو واتساب بيتبعت لحد.",
            "مش بيتحسب من حدود باقتك ولا بيظهر في التقارير.",
            "بيظهر في قايمة الحجوزات بعلامة \"حجز تجريبي\".",
            "كل الحجوزات التجريبية بتتمسح أول ما تنشر.",
          ],
        },
      ],
    },
    en: {
      title: "Test bookings",
      summary: "Try your page as a customer would, before you publish.",
      sections: [
        {
          paragraphs: [
            "Before publishing, open the preview from the Setup page and book any service. It runs through the real booking system with the same times and rules.",
          ],
          bullets: [
            "No customer record is created and no email or WhatsApp message is sent.",
            "It does not count toward your plan's limits and does not appear in reports.",
            "It shows in your bookings list marked \"Test booking\".",
            "All test bookings are deleted the moment you publish.",
          ],
        },
      ],
    },
  },
  {
    slug: "verification",
    audience: "business",
    ar: {
      title: "التحقق وعلامة \"موثّق\"",
      summary: "إيه الفرق بين تأكيد الإيميل والتليفون وبين التوثيق.",
      sections: [
        {
          paragraphs: ["عندنا أربع حاجات منفصلة، ومفيش واحدة بتغني عن التانية:"],
          bullets: [
            "تأكيد الإيميل: مطلوب للنشر. معناه إننا نقدر نبعتلك.",
            "تأكيد التليفون / الواتساب: مستحسن. معناه إن الرقم بيوصلك.",
            "التأكد من صاحب النشاط: بيعمله فريق موعد بنفسه من مستندات بتبعتها للدعم. ده الوحيد اللي بيظهر علامة \"موثّق\".",
            "التحقق من المكان: مش متاح لسه.",
          ],
        },
        {
          paragraphs: [
            "تأكيد الإيميل والتليفون لوحدهم مش معناهم إن النشاط موثّق قانونيًا. عشان تطلب التوثيق، ابعت للدعم ما يثبت إنك صاحب النشاط.",
          ],
        },
      ],
    },
    en: {
      title: "Verification and the Verified badge",
      summary: "How confirming your email and phone differs from being verified.",
      sections: [
        {
          paragraphs: ["There are four separate checks, and none stands in for another:"],
          bullets: [
            "Email confirmed: required to publish. It means we can reach you.",
            "Phone / WhatsApp confirmed: recommended. It means the number reaches you.",
            "Ownership checked by Maw3ed: done by our team from evidence you send to support. This is the only thing that shows the Verified badge.",
            "Venue check: not offered yet.",
          ],
        },
        {
          paragraphs: [
            "A confirmed email and phone do not mean a business is legally verified. To request verification, send support evidence that you own the business.",
          ],
        },
      ],
    },
  },
  {
    slug: "import",
    audience: "business",
    related: { href: "/dashboard/import", ar: "افتح الاستيراد", en: "Open import" },
    ar: {
      title: "استيراد العملاء والخدمات من شيت",
      summary: "جهّز ملف CSV وارفعه، وتقدر تتراجع في أي وقت.",
      sections: [
        {
          heading: "تجهيز الملف",
          paragraphs: ["احفظ الشيت كـ CSV من Excel أو Google Sheets. أول سطر لازم يكون العناوين، بالعربي أو بالإنجليزي."],
          bullets: [
            "العملاء: الاسم والموبايل مطلوبين، والإيميل والملاحظات اختياري.",
            "الخدمات: الاسم والمدة بالدقايق (من ٥ لـ ٧٢٠) والسعر.",
            `أقصى حجم ١ ميجا و${MAX_ROWS} صف.`,
            "لو في قيمة فيها فاصلة (زي 1,250) حطها بين علامتين \" \".",
          ],
        },
        {
          heading: "المعاينة والتكرار",
          paragraphs: [
            "قبل أي حفظ هتشوف كام صف جاهز، وكام مكرر، وكل صف فيه غلط برقم سطره. العميل اللي رقمه موجود عندك بالفعل بيتساب حتى لو مكتوب بشكل مختلف، والخدمة اللي اسمها موجود بتتساب.",
          ],
        },
        {
          heading: "التراجع",
          paragraphs: [
            "من \"استيرادات سابقة\" دوس \"تراجع\" عشان تمسح اللي اتضاف. أي عميل أو خدمة عليها حجز من وقتها بتفضل، عشان الحجز ميضيعش.",
          ],
        },
      ],
    },
    en: {
      title: "Importing customers and services from a spreadsheet",
      summary: "Prepare a CSV file, upload it, and undo it any time.",
      sections: [
        {
          heading: "Preparing the file",
          paragraphs: ["Save the sheet as CSV from Excel or Google Sheets. The first row must be the headers, in Arabic or English."],
          bullets: [
            "Customers: name and phone are required; email and notes are optional.",
            "Services: name, duration in minutes (5 to 720) and price.",
            `At most 1 MB and ${MAX_ROWS} rows.`,
            "Put any value containing a comma (like 1,250) in double quotes.",
          ],
        },
        {
          heading: "Preview and duplicates",
          paragraphs: [
            "Before anything is saved you see how many rows are ready, how many are duplicates, and every row with an error by its line number. A customer whose number you already have is skipped even if it is written differently, and so is a service with a name you already use.",
          ],
        },
        {
          heading: "Undoing",
          paragraphs: [
            "Under \"Past imports\", press \"Undo\" to remove what was added. Any customer or service that has had a booking since is kept, so no booking is lost.",
          ],
        },
      ],
    },
  },
  {
    slug: "plans",
    audience: "business",
    related: { href: "/dashboard/billing", ar: "الاشتراك والفواتير", en: "Billing" },
    ar: {
      title: "الباقات والحدود",
      summary: "إيه اللي في كل باقة، وإيه اللي بيحصل لما تغيّر.",
      sections: [
        {
          bullets: [
            `المجانية: ${FREE_LIMIT} حجز بيتأكد تلقائي في الشهر، وبعدها الحجوزات بتفضل توصل بس بتستنى تأكيدك. التذكيرات للعملاء شغالة.`,
            `برو: ${PLAN_PRICES_EGP.PRO} ج.م في الشهر. حجوزات من غير حد، لحد ${PRO_STAFF} من الفريق، واتساب، عربون ودفع أونلاين، وتحليلات.`,
            `بريميوم: ${PLAN_PRICES_EGP.PREMIUM} ج.م في الشهر. زي برو، بفريق من غير حد وأكتر من فرع.`,
            `الدفع السنوي بيتحسب ${ANNUAL_MONTHS_CHARGED} شهور بس.`,
          ],
          paragraphs: [],
        },
        {
          heading: "لو الاشتراك خلص أو رجعت للمجانية",
          paragraphs: [
            "مفيش حاجة بتتمسح: الفريق والفروع والحجوزات والعملاء بيفضلوا. اللي بيتقفل هو إضافة جديد فوق حد الباقة، والمميزات المدفوعة لحد ما تجدد.",
            "لو الدفع فشل، الباقة بتفضل زي ما هي لحد آخر الفترة المدفوعة، وتقدر تجرّب تدفع تاني من صفحة الاشتراك.",
          ],
        },
      ],
    },
    en: {
      title: "Plans and limits",
      summary: "What each plan includes, and what happens when you change.",
      sections: [
        {
          bullets: [
            `Free: ${FREE_LIMIT} auto-confirmed bookings a month; after that bookings still arrive but wait for you to confirm. Customer reminders included.`,
            `Pro: ${PLAN_PRICES_EGP.PRO} EGP a month. Unlimited bookings, up to ${PRO_STAFF} team members, WhatsApp, deposits and online payment, analytics.`,
            `Premium: ${PLAN_PRICES_EGP.PREMIUM} EGP a month. Everything in Pro, with an unlimited team and multiple branches.`,
            `Paying yearly charges ${ANNUAL_MONTHS_CHARGED} months.`,
          ],
          paragraphs: [],
        },
        {
          heading: "If a subscription lapses or you go back to Free",
          paragraphs: [
            "Nothing is deleted: team, branches, bookings and customers all stay. What stops is adding more beyond the plan's limit, and the paid features, until you renew.",
            "If a payment fails, your plan stays as it is until the end of the paid period, and you can try paying again from the billing page.",
          ],
        },
      ],
    },
  },
  {
    slug: "booking-problems",
    audience: "customer",
    ar: {
      title: "ليه مش لاقي ميعاد، أو الحجز مكملش؟",
      summary: "الأسباب المعتادة وإيه تعمله.",
      sections: [
        {
          bullets: [
            "اليوم مقفول: المكان مش شغال اليوم ده، أو أجازة.",
            "قريب أوي: بعض الأماكن بتطلب وقت قبل الميعاد (مثلاً ساعتين).",
            "بعيد أوي: كل مكان بيحدد لحد كام يوم قدام تقدر تحجز.",
            "حجز نفس اليوم اتقفل: بعض الأماكن بتوقف حجز النهارده بعد ساعة معينة.",
            "الميعاد اتاخد: حد حجزه وإنت بتختار. اختار ميعاد تاني.",
            "الشخص اللي اخترته مش موجود اليوم ده: جرّب \"أي حد متاح\".",
            "حجزك \"مستني تأكيد\": المكان بيراجع الحجوزات بنفسه. هيوصلك رد.",
          ],
          paragraphs: [],
        },
        {
          heading: "الإلغاء والتغيير",
          paragraphs: [
            "تقدر تلغي أو تغيّر ميعادك من رابط الحجز لحد عدد الساعات اللي المكان محدده قبل الميعاد (مكتوب في صفحة الحجز وفي الإيميل). بعد كده كلّم المكان مباشرة.",
          ],
        },
      ],
    },
    en: {
      title: "Why can't I find a time, or why didn't my booking go through?",
      summary: "The usual reasons and what to do.",
      sections: [
        {
          bullets: [
            "The day is closed: the place doesn't work that day, or it's a holiday.",
            "Too soon: some places need notice before an appointment (for example two hours).",
            "Too far ahead: each place sets how many days ahead you can book.",
            "Same-day booking has closed: some places stop booking for today after a set time.",
            "The time was taken: someone booked it while you were choosing. Pick another.",
            "The person you chose isn't working that day: try \"Anyone available\".",
            "Your booking says \"Pending\": the place reviews bookings itself. You'll hear back.",
          ],
          paragraphs: [],
        },
        {
          heading: "Cancelling and changing",
          paragraphs: [
            "You can cancel or move your appointment from your booking link up to the number of hours before it that the place has set (shown on the booking page and in the email). After that, contact the place directly.",
          ],
        },
      ],
    },
  },
];

export function findArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}
