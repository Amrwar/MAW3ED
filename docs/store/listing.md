# Store listing drafts — App Store and Google Play

Drafts for TestFlight / Play internal testing and, later, public release.
Every claim below was checked against the code on 2026-10-14. Anything
that could not be confirmed in code is marked **[VERIFY]**. No counts,
ratings, rankings or testimonials are used on purpose.

Brand note **[VERIFY]**: the app's store name and the website say **موعد**
(`mobile/app.config.ts:66`, `mobile/locales/ar.json`), but some app copy says
**مواعيد** (`mobile/app/(auth)/login.tsx:46,210`,
`mobile/app.config.ts:215`, `mobile/app/business/[slug]/index.tsx:188`).
These drafts use **موعد**. Pick one before screenshots are taken.

---

## 1. Names and short text

| Field | Limit | Arabic | English |
|---|---|---|---|
| App name | 30 | موعد - احجز ميعادك (18) | Maw3ed - Book Appointments (26) |
| Subtitle (iOS) | 30 | احجز صالونك أو دكتورك بسهولة (28) | Book salons, clinics and more (29) |
| Short description (Play) | 80 | دوّر على صالون أو عيادة أو جيم، اختار الخدمة والميعاد واحجز من موبايلك. (71) | Find a salon, clinic or gym, pick a service and time, and book from your phone. (78) |
| Keywords (iOS) | 100 | حجز,ميعاد,مواعيد,صالون,كوافير,حلاقة,عيادة,دكتور,اسنان,تجميل,سبا,جيم,تحاليل,مصر,اونلاين (86) | booking,appointment,salon,barber,clinic,doctor,dentist,spa,beauty,gym,lab,egypt,cairo,reserve (93) |

Categories in the subtitle/keywords come from the seeded category list
(`prisma/seed.ts`). Whether live businesses exist in each one is **[VERIFY]**.

## 2. Full description

### العربي

موعد بيخليك تحجز ميعادك في صالون أو عيادة أو جيم أو أي مكان بيشتغل بالمواعيد، من موبايلك ومن غير مكالمات.

**للعملاء**
- دوّر على الأماكن بالاسم أو بالقسم أو بالمنطقة.
- "الأماكن القريبة مني": لو حبيت، بنستخدم موقعك مرة واحدة عشان نرتب الأماكن حسب قربها منك، وتقدر تشوفها على الخريطة. مش بنتابع موقعك ولا بنحفظه.
- اختار الخدمة والشخص اللي هيقدمها والميعاد المناسب ليك من المواعيد الفاضية.
- ادفع العربون أونلاين بأمان عن طريق Paymob لو المكان طالب عربون، والباقي في المكان. بيانات الكارت مش بتعدي على التطبيق خالص.
- حجوزاتك كلها في مكان واحد: تقدر تلغي أو تغيّر الميعاد في حدود الوقت اللي المكان حدده.
- تنبيهات على الموبايل وعلى واتساب أو الإيميل بحالة حجزك [VERIFY: تفاصيل التذكير قبل الميعاد].
- احفظ الأماكن اللي بتحبها في "المحفوظات".
- قيّم زيارتك بعد ما الموعد يخلص، والتقييمات بتيجي بس من حجوزات حصلت فعلًا.
- تابع مدفوعاتك وأي مبلغ اترجعلك من صفحة "المدفوعات".

**لأصحاب الأعمال وفريق العمل**
- شوف مواعيد النهارده والتقويم.
- أكّد الحجوزات وغيّر مواعيدها وتابع العملاء.
- عدّل الخدمات والفريق وبيانات النشاط، وشوف التقارير (حسب صلاحيات كل حساب).
- تسجيل نشاط جديد بيتم من الموقع، وبعدها تدخل من التطبيق بالإيميل والباسورد.

**الدخول**
العميل بيدخل أو بيعمل حساب برقم موبايله، وبيوصله كود تأكيد على واتساب. تقدر تتصفح الأماكن من غير ما تسجل.

**خصوصيتك**
تقدر تحذف حسابك من جوه التطبيق في أي وقت: حسابي ← حذف الحساب.

### English

Maw3ed lets you book an appointment at a salon, clinic, gym or any place that works by appointment — from your phone, without calling.

**For customers**
- Find places by name, category or area.
- "Places near me": only when you ask, the app reads your location once to sort places by distance and show them on a map. Your location is not tracked or stored.
- Pick the service, the staff member and a free time.
- If the place asks for a deposit, pay it online through Paymob; the rest is paid at the venue. Card details never pass through the app.
- All your bookings in one place: cancel or reschedule within the window the business sets.
- Push, WhatsApp or email updates about your booking [VERIFY: reminder timing].
- Save the places you like.
- Review a visit once the appointment is completed — reviews come only from real bookings.
- See your payments and any refunds.

**For business owners and staff**
- See today's appointments and the calendar.
- Confirm and reschedule bookings and look up customers.
- Edit services, staff and the business profile, and view reports (depending on each account's permissions).
- New businesses register on the website, then sign in to the app with email and password.

**Signing in**
Customers sign in or sign up with their phone number and a code sent on WhatsApp. Browsing needs no account.

**Your privacy**
You can delete your account inside the app at any time: Account → Delete account.

## 3. Categories

| Store | Primary | Secondary |
|---|---|---|
| App Store | Lifestyle | Business [VERIFY: or Health & Fitness] |
| Google Play | Lifestyle [VERIFY: "Beauty" fits salons but not clinics] | — |

## 4. Age rating questionnaire

App Store (all "None"/"No" except where noted) → expected **4+** [VERIFY on submission]:
- Violence, sexual content, profanity, horror, drugs/alcohol/tobacco, gambling, contests: **None**.
- Medical/treatment information: **None** (the app books clinic appointments; it gives no medical advice).
- Unrestricted web access: **No** (in-app browser opens only Paymob's payment page and maw3ed.net pages).
- User-generated content: **Yes** — public text reviews with star rating, from completed bookings only; moderated by admins (`src/app/api/admin/reviews`). Readers can report any review from the reviews list ("ابلغ عن التقييم" / "Report", with a reason) — `mobile/app/business/[slug]/reviews.tsx` → `POST /api/public/reviews/[id]/report`; a report queues the review for moderation.
- Messaging/chat between users: **No**.
- Location sharing with other users: **No**.

Google Play (IARC): category "Utility/Productivity/Communication or other" →
violence/sexuality/language/controlled substances/gambling: **No**;
users can interact or exchange content: **Yes** (public reviews);
shares user's physical location with other users: **No**;
digital purchases: **No** (deposits are for in-person services);
expected **Everyone / PEGI 3** [VERIFY].

Target audience (Play): **18+** recommended [VERIFY] — the app takes payments and has no child-directed content.

## 5. Contact, privacy and deletion

| Item | Value | Source |
|---|---|---|
| Support URL | https://www.maw3ed.net/contact | `src/app/contact/page.tsx` |
| Support email | support@maw3ed.net | `src/lib/support.ts` (default; overridable by env) |
| Support phone | +1 514 553 4360 [VERIFY: Canadian number for an Egyptian app] | `src/lib/support.ts` |
| Address | 1445 Rue du Fort, Montréal, QC H3H 2C3, Canada [VERIFY] | `src/lib/support.ts` |
| WhatsApp | only if `NEXT_PUBLIC_SUPPORT_WHATSAPP` is set [VERIFY] | `src/lib/contact.ts` |
| Privacy policy | https://www.maw3ed.net/privacy (English: https://www.maw3ed.net/privacy?lang=en) | `src/app/privacy/page.tsx` |
| Account deletion URL | https://www.maw3ed.net/account-deletion (English: https://www.maw3ed.net/account-deletion?lang=en) — public, no sign-in | `src/app/account-deletion/page.tsx` |
| Terms | https://www.maw3ed.net/terms | `src/app/terms` |
| Marketing URL | https://www.maw3ed.net | — |

**Privacy policy (rewritten 14 Oct 2026):** Arabic and English
(`/privacy`, `/privacy?lang=en`), written from the code: phone/WhatsApp (Meta),
Resend, Expo push, Paymob hosted page, Cloudinary, Sentry, Vercel/Neon,
per-request location, cookies, public reviews, retention and deletion. Open
items are `VERIFY` comments in `src/app/privacy/page.tsx` (legal entity,
retention periods, provider regions, minimum age, mobile Sentry scrubbing).

### Account deletion

- **In app:** Account (حسابي) → Delete account (حذف الحساب) → "Send me a
  confirmation code" → enter the WhatsApp code → "Delete my account
  permanently". (`mobile/app/(customer)/account.tsx:232` → `mobile/app/me/delete.tsx`
  → `POST /api/account/delete/code` then `POST /api/account/delete`.)
- **On the web:** sign in at https://www.maw3ed.net → Account → Settings
  (https://www.maw3ed.net/account/settings) → Delete account. Same API.
- **What is deleted:** the account, saved places, notifications, app sessions,
  push registrations, pending login codes and password-reset tokens
  (`src/lib/account/deletion.ts`).
- **What is kept:** bookings, reviews and payment records, as the businesses'
  records (the booking keeps the customer's name and phone). Reviews stay public with first name + last initial.
- **Refused:** accounts that own a business (must contact support) and admin
  accounts. In the business app, More (المزيد) → Delete account (احذف الحساب)
  (`mobile/app/manage/delete-account.tsx`) tells an owner to email
  support@maw3ed.net (shown, selectable) or use the contact page; a staff
  member is sent on to the normal in-app deletion.
- **Privacy policy in app:** a "Privacy policy" row in Account (customer) and
  More (business) opens https://www.maw3ed.net/privacy.
- **Public deletion page (Google Play "delete account URL"):**
  https://www.maw3ed.net/account-deletion (`?lang=en` for English). No sign-in;
  covers the app and web steps, emailing support@maw3ed.net from the account's
  phone/email when the account can't be reached, what is deleted and what stays
  with businesses, and owners going through support. Linked from the footer and
  the sitemap.
- Public reviews keep the reviewer's first name and last initial after
  deletion (it comes from the booking, not the account) — the deletion page
  says so.

## 6. Screenshot plan

Sizes:
- iPhone 6.9": **1320 × 2868** (required). 6.5": **1284 × 2778** (or 1242 × 2688) — optional now that 6.9" scales down, but provide if available.
- iPad: not needed — `ios.supportsTablet` is `false` (`mobile/app.config.ts`), iPhone only.
- Android phone: 1080 × 1920 to 1080 × 2400, 9:16 or taller, 2–8 images.
- Play also needs: app icon 512 × 512 PNG, feature graphic **1024 × 500**.

Capture in **Arabic first** (RTL, primary store locale ar-EG / Arabic), then
the same set in **English** for the English locale. Use the production or
staging build with real-looking demo businesses (no real customer data).

1. Home (الرئيسية) — categories and the "near me" entry.
2. Search (ابحث) results for a category, with filters open.
3. Places near me — map view with pins.
4. Business profile — services, staff, reviews.
5. Booking flow — picking a time (free slots).
6. Booking summary — deposit online / rest at the venue.
7. Booking detail — confirmed, with cancel/reschedule.
8. My bookings (حجوزاتي).
9. Business app — Today (النهارده) or Calendar (التقويم).
10. Account (حسابي) — notification settings and the delete-account row.

## 7. App Store privacy ("nutrition label")

Tracking: **No** (no ad SDKs, no analytics vendor; `mobile/lib/analytics.ts` is a no-op in production).

| Data type | Collected | Linked to user | Purpose | Notes |
|---|---|---|---|---|
| Name | Yes | Yes | App Functionality | Profile, bookings |
| Email address | Yes (optional) | Yes | App Functionality | Optional at sign-up; owners sign in with it |
| Phone number | Yes | Yes | App Functionality | Sign-in, bookings, WhatsApp codes/updates |
| Precise location | Yes [VERIFY] | No [VERIFY] | App Functionality | Sent per "near me" request, not stored; declare conservatively because request URLs may appear in hosting logs |
| Purchase history | Yes | Yes | App Functionality | Bookings and deposit records |
| Payment info (card) | No | — | — | Entered on Paymob's hosted page; never reaches the app or server |
| Other user content | Yes | Yes | App Functionality | Reviews, booking notes |
| User ID | Yes | Yes | App Functionality | Account id |
| Device ID | No [VERIFY] | — | — | Push token and device name are stored for push/session list; Apple does not usually count push tokens |
| Crash / performance data | **Yes** once `EXPO_PUBLIC_SENTRY_DSN` is set for the build | No | App Functionality | `@sentry/react-native`; no PII (`sendDefaultPii: false`, bodies/headers dropped, phone numbers redacted — `mobile/lib/scrub.ts`); 10% performance traces |
| Usage data, browsing, contacts, photos, health, financial info, sensitive info | No | — | — | — |

## 8. Google Play Data safety

- Encrypted in transit: **Yes** (HTTPS only).
- Users can request deletion: **Yes** — in app, on the web, and via https://www.maw3ed.net/account-deletion.
- Shared with third parties: **No** — Paymob, Meta (WhatsApp), Expo push, Resend email and hosting act as service providers; giving your name/phone to the business you book is a user-initiated transfer.

| Category → type | Collected | Optional? | Ephemeral? | Purposes |
|---|---|---|---|---|
| Personal info → Name | Yes | Required for customers | No | App functionality, Account management |
| Personal info → Email address | Yes | Optional | No | App functionality, Account management |
| Personal info → Phone number | Yes | Required for customers | No | App functionality, Account management, Fraud prevention (OTP) |
| Location → Approximate + Precise | Yes | Optional | Yes | App functionality |
| Financial info → Purchase history | Yes | Optional (only bookings with deposits) | No | App functionality |
| Financial info → Payment info | No | — | — | Card entered on Paymob's page |
| App activity → Other user-generated content | Yes | Optional | No | App functionality (reviews, booking notes) |
| App activity → App interactions | No | — | — | No analytics vendor |
| App info & performance → Crash logs / Diagnostics | **Yes** once `EXPO_PUBLIC_SENTRY_DSN` is set | No (collected automatically) | No | App functionality, Analytics (stability) |
| Device or other IDs | Yes | Optional (push permission) | No | App functionality (Expo push token, device name for the sessions list) |

## 9. Reviewer access (App Review / Play pre-launch)

**Decision (14 Oct 2026): reviewers sign in with a business account
(email + password).** Customer sign-in stays phone + WhatsApp code only,
with no reviewer bypass in the code (`src/lib/auth/send-code.ts`).
Reviewers browse the customer side as guests (home, search, near me,
business pages, reviews, starting a booking) and use the business account
for everything behind sign-in.

### Setting up the review account (once, on production)

1. On https://www.maw3ed.net/signup create a business with an address the
   team reads, e.g. `appreview@maw3ed.net`, and a long unique password.
2. Finish onboarding: a name that says what it is ("Maw3ed App Review"),
   two or three services, one or two staff, opening hours.
3. **Do not click the email verification link.** Onboarding publishes a
   business only once its owner's email is verified
   (`src/app/api/onboarding/route.ts`), so this one stays unpublished: it
   never appears in search, near me or at /company/<slug>, and no customer
   can book it. That keeps a demo business out of what customers see.
   Checked on the local stack: such an owner still signs in on the app,
   loads Today, adds a booking by hand and opens it, while the public
   page answers 404 and search leaves it out.
4. In the app, sign in on the **Business** tab and add three or four
   bookings by hand for the coming days (customer name "App Review",
   any number), so Today and the calendar have something to show.
5. Never put real customers' data in this account. Delete it after
   launch, or keep it unpublished for later reviews.

### What to paste

**App Store Connect → App Review Information → Sign-in required**
- User name: the review email · Password: its password
- Notes:

  > Maw3ed is an appointment booking app for businesses in Egypt
  > (salons, clinics, studios). Customer sign-in uses a one-time code
  > sent by WhatsApp to an Egyptian mobile number, so please browse the
  > customer side without signing in: Home, Search, "Near me", any
  > business page and its reviews, and the booking screens up to the
  > sign-in step.
  >
  > To see the signed-in side, open the sign-in screen, choose
  > **Business** ("صاحب نشاط"), and use the account above. It is a
  > test business that is not visible to the public. There you can see
  > today's bookings, the calendar, booking details (confirm, check in,
  > complete, reschedule, cancel), customers, and settings.
  >
  > Account deletion: customers delete from Account → Delete account;
  > business owners are directed to support (Account → Delete account)
  > because a business has bookings and payments other people depend on.
  > Public page: https://www.maw3ed.net/account-deletion
  >
  > Payments for appointments are for services delivered in person at
  > the business and are processed by Paymob on its hosted page.

**Google Play Console → App content → App access**
- "All or some functionality is restricted" → add instructions:
  name "Business account", the same email and password, and the first two
  paragraphs of the notes above.

## 10. Build operations (EAS environment)

Set in the EAS project (expo.dev → Project → Environment variables), per
environment (preview / production). Nothing here is committed.

| Variable | Kind | Needed for |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | plain text (public — compiled into the app) | Crash reports. Unset → the SDK stays off. Never on in development builds or on web. |
| `SENTRY_ORG` | plain text | Adds the `@sentry/react-native/expo` plugin, which uploads source maps / dSYMs at build time. Unset → plugin left out, build unaffected. |
| `SENTRY_PROJECT_MOBILE` | plain text | Sentry project slug; defaults to `maw3ed-mobile`. |
| `SENTRY_AUTH_TOKEN` | **secret** | Required by the plugin's upload step when `SENTRY_ORG` is set. |
| `GOOGLE_SERVICES_JSON` | file | Android push (FCM) — see `docs/push-setup.md`. |
| `GOOGLE_MAPS_ANDROID_API_KEY` | secret | Android map in store builds — see `docs/location.md`. |

`APP_ENV` and `EXPO_PUBLIC_API_URL` are already set per profile in `mobile/eas.json`.

Icons: `mobile/assets/icon.png` (1024, opaque) and `adaptive-icon.png`
(1024, transparent foreground on `#0B3A2E`) are rendered from the largest
existing raster of the Arabic wordmark (`public/logo.png`, ~345 px wide), so
they are upscaled. **[VERIFY]** Replace with a designer's 1024 px vector-
exported master before public release; the Play 512 px icon can be cut from it.
