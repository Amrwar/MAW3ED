import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/meta";
import LegalPage, { LegalList, LegalSection } from "@/components/legal/LegalPage";
import { parseLangParam } from "@/components/legal/lang-param";
import { BUSINESS_ADDRESS, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export const metadata: Metadata = buildMetadata({
  title: "سياسة الخصوصية",
  description: "إيه البيانات اللي موعد بيجمعها، وبيستخدمها في إيه، ومين بيستلمها، وإزاي تحذف حسابك.",
  path: "/privacy",
});

/**
 * The privacy policy, written from the code rather than from a template.
 *
 * Where each claim comes from, so the next change to the code can find
 * the sentence it invalidates:
 *   - what is stored: prisma/schema.prisma (User, Booking, Customer,
 *     Review, Payment, MobileSession, DeviceToken, NotificationDelivery);
 *   - sign-in: src/auth.ts (email + bcrypt password, phone + WhatsApp
 *     code), src/lib/auth/login-code.ts (codes hashed, 10-minute TTL);
 *   - messages: src/lib/notifications/channels.ts (WhatsApp via Meta's
 *     Graph API, email via Resend, Expo push, SMS only if a gateway is
 *     configured — none is today);
 *   - payments: src/lib/services/paymob.ts (hosted Paymob page);
 *   - location: mobile/features/location/location.ts and
 *     src/app/api/public/businesses/nearby/route.ts (per request, not
 *     logged, not stored);
 *   - analytics: mobile/lib/analytics.ts (no sink installed), no web
 *     analytics script;
 *   - crash reports: src/lib/sentry-shared.ts (scrubbed, no replay);
 *   - cookies: LanguageContext, HeroSearch, ref/[code], review-identity;
 *   - deletion: src/lib/account/deletion.ts and /account-deletion.
 *
 * Anything that could not be confirmed from code is marked with a
 * VERIFY comment, not stated.
 */
export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const forced = parseLangParam((await searchParams).lang);
  const email = (
    <a href={SUPPORT_MAILTO} dir="ltr" className="text-[var(--color-jade)] hover:underline">
      {SUPPORT_EMAIL}
    </a>
  );
  const deletion = (label: string) => (
    <Link href="/account-deletion" className="text-[var(--color-jade)] hover:underline">
      {label}
    </Link>
  );

  const ar = (
    <>
      {/* VERIFY: the legal entity that operates Maw3ed (company name, registration country) — the code only has the brand name and the address in src/lib/support.ts. */}
      <p>
        موعد (Maw3ed) منصة لحجز المواعيد بين العملاء والأنشطة (عيادات وصالونات ومطاعم وغيرها)، على الموقع maw3ed.net
        وتطبيق موعد للموبايل. السياسة دي بتشرح البيانات اللي بنجمعها، وبنستخدمها في إيه، ومين بيستلمها، وإزاي تتحكم فيها.
      </p>

      <LegalSection title="1. البيانات اللي بنجمعها">
        <LegalList>
          <li>
            <strong>بيانات الحساب:</strong> الاسم، ورقم الموبايل، والبريد الإلكتروني، وكلمة السر لو سجّلت بالبريد (بتتخزن
            مشفّرة بـ bcrypt ومش بنقدر نقراها)، وتفضيلات الإشعارات.
          </li>
          <li>
            <strong>الحجوزات:</strong> الاسم ورقم الموبايل اللي بتحجز بيهم، والبريد الإلكتروني لو كتبته، والخدمة والميعاد
            والفرع والموظف وعدد الأفراد وأي ملاحظات بتكتبها، والسعر والمقدّم والخصم.
          </li>
          <li>
            <strong>التقييمات:</strong> التقييم والتعليق وأي صور بترفقها. لو صوّتّ إن تقييم مفيد أو بلّغت عنه، بنخزن بس بصمة
            مشفّرة (hash) لمعرّف عشوائي في متصفحك، علشان نمنع التكرار.
          </li>
          <li>
            <strong>أصحاب الأنشطة والموظفين:</strong> بيانات النشاط (الاسم والعنوان والموقع على الخريطة والتليفون وواتساب
            والصور والخدمات والمواعيد)، وأسماء الموظفين وصورهم ورقم دخولهم، وسجلات الاشتراك والمدفوعات، وبيانات العملاء
            والملاحظات اللي النشاط بيسجلها عنده.
          </li>
          <li>
            <strong>المدفوعات:</strong> المبلغ والحالة وطريقة الدفع وأرقام العملية عند Paymob. بيانات الكارت بتتكتب على صفحة
            Paymob مباشرةً ومش بتوصل لموعد خالص.
          </li>
          <li>
            <strong>الجهاز والتطبيق:</strong> رمز إشعارات الموبايل (Push token) ونوع النظام، واسم الجهاز لجلسات الدخول على
            التطبيق. رموز الدخول بتتحفظ على موبايلك في التخزين الآمن للنظام.
          </li>
          <li>
            <strong>الموقع الجغرافي:</strong> التطبيق بيطلب موقعك بس لما تطلب «أماكن قريبة مني»، قراءة واحدة في المرة، بدون
            تتبّع ولا في الخلفية. الإحداثيات بتتبعت مع الطلب ده بس، وكودنا مش بيسجّلها ولا بيخزنها لا على الموبايل ولا على
            السيرفر. تقدر ترفض الإذن وتختار المنطقة بنفسك.
            {/* VERIFY: the hosting provider (Vercel) may record request URLs, including ?lat=&lng=, in its own access logs; the app code does not log them. */}
          </li>
          <li>
            <strong>بيانات تقنية:</strong> عنوان IP بيُستخدم لتحديد عدد المحاولات (rate limiting) ومحفوظ كبصمة مشفّرة بس
            ولفترة قصيرة. ومصدر الزيارة لصفحة النشاط (إنستجرام، واتساب، جوجل...) بيتعدّ كرقم إجمالي لكل يوم من غير ما
            يتربط بالزائر.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. بنستخدم البيانات في إيه">
        <LegalList>
          <li>تسجيل الدخول والتأكد من رقمك بكود على واتساب.</li>
          <li>إنشاء الحجز وإرساله للنشاط، وإرسال التأكيد والتذكير وطلب التقييم والتحديثات ليك.</li>
          <li>إتمام الدفع والاسترداد واشتراكات الأنشطة.</li>
          <li>عرض التقييمات وصفحات الأنشطة للعامة.</li>
          <li>حماية المنصة من الإساءة ومعالجة الأعطال، والرد على طلبات الدعم.</li>
        </LegalList>
        <p>مش بنبيع بياناتك، ومش بنستخدمها في إعلانات، ومفيش أدوات إعلانات في الموقع أو التطبيق.</p>
      </LegalSection>

      <LegalSection title="3. مين بيستلم البيانات">
        <LegalList>
          <li>
            <strong>النشاط اللي بتحجز عنده:</strong> بيشوف اسمك ورقمك وبريدك (لو كتبته) وتفاصيل الحجز وملاحظاتك.
          </li>
          <li>
            <strong>العامة:</strong> التقييمات بتظهر على صفحة النشاط باسمك الأول وأول حرف من اسم العيلة، مع التعليق والصور ورد
            النشاط. صفحات الأنشطة وبياناتها عامة.
          </li>
          <li>
            <strong>مزودي خدمات بيشتغلوا لحسابنا:</strong>
            <LegalList>
              <li>Meta (واتساب للأعمال): رقم الموبايل ونص الرسالة، لأكواد الدخول وإشعارات الحجز.</li>
              <li>Resend: البريد الإلكتروني ونص الرسالة، لرسائل البريد.</li>
              <li>Expo ومن خلالها Apple وGoogle: رمز الإشعارات ونص الإشعار، لإشعارات الموبايل.</li>
              <li>Paymob: المبلغ والاسم والبريد ورقم الموبايل، لإتمام الدفع على صفحتهم.</li>
              <li>Cloudinary: الصور اللي بتترفع (صور الأنشطة والتقييمات).</li>
              <li>Sentry: تقارير الأعطال (تفاصيل بالأسفل).</li>
              <li>Vercel (الاستضافة) وNeon (قاعدة البيانات): كل البيانات المخزنة على المنصة.</li>
            </LegalList>
            {/* VERIFY: Cloudinary is the upload target in src/lib/services/cloudinary.ts — confirm review photos go through it in production. */}
            {/* VERIFY: Neon as the database host comes from .env.example only; confirm the production provider and region. */}
            {/* VERIFY: SMS — src/lib/notifications/channels.ts sends SMS only when SMS_API_URL/SMS_API_KEY are set; none is configured today. If a gateway is added, name it here. */}
          </li>
          <li>الجهات الرسمية لو القانون طلب ده.</li>
        </LegalList>
        <p>مزودي الخدمات دول ممكن يعالجوا البيانات في دول غير بلدك.</p>
        {/* VERIFY: processing regions of Vercel, Neon, Resend, Sentry, Cloudinary and Expo. */}
      </LegalSection>

      <LegalSection title="4. تقارير الأعطال والتحليلات">
        <p>
          بنستخدم Sentry على الموقع والتطبيق علشان نعرف الأعطال ونصلحها. قبل ما أي تقرير يطلع، بنشيل منه أرقام الموبايل
          والبريد الإلكتروني والكوكيز ورؤوس الدخول، والتقرير بيعرّف الحساب برقمه الداخلي بس. مفيش تسجيل لجلسات الاستخدام
          (session replay).
        </p>
        {/* VERIFY: mobile Sentry (@sentry/react-native) is being added; confirm it uses the same scrubbing (no names, phones, emails) before release. */}
        <p>مفيش أدوات تحليلات أو تتبّع من أطراف خارجية في الموقع أو التطبيق.</p>
      </LegalSection>

      <LegalSection title="5. الكوكيز والتخزين على الجهاز">
        <LegalList>
          <li>كوكي تسجيل الدخول على الموقع.</li>
          <li><code dir="ltr">maw3ed-lang</code> و<code dir="ltr">maw3ed-city</code>: لغتك ومدينتك المختارة.</li>
          <li><code dir="ltr">mw_d</code>: معرّف عشوائي لمنع تكرار التصويت والبلاغات على التقييمات.</li>
          <li><code dir="ltr">maw3ed_ref</code>: كود الدعوة لما نشاط يسجّل من رابط دعوة.</li>
          <li>التخزين المحلي في المتصفح: الأماكن المحفوظة للزوار ومسودة تسجيل النشاط.</li>
        </LegalList>
        <p>مفيش كوكيز إعلانات أو تتبّع. تقدر تمسح الكوكيز من متصفحك، بس هتحتاج تسجّل دخول تاني.</p>
      </LegalSection>

      <LegalSection title="6. مدة الاحتفاظ">
        <LegalList>
          <li>الحساب بيفضل لحد ما تحذفه.</li>
          <li>أكواد الدخول صالحة 10 دقايق وبتتمسح لما تُستخدم، وجلسة الدخول على التطبيق بتنتهي بعد 60 يوم من تسجيل الدخول.</li>
          <li>
            الحجوزات والتقييمات وسجلات الدفع بتفضل عند الأنشطة كسجلات لمواعيد حصلت، حتى بعد حذف الحساب — التفاصيل في
            صفحة {deletion("حذف الحساب")}.
          </li>
        </LegalList>
        {/* VERIFY: no retention period or purge job exists for Booking, Customer, Review, Payment, NotificationDelivery or AuditLog rows; decide a period before stating one. */}
      </LegalSection>

      <LegalSection title="7. حقوقك واختياراتك">
        <LegalList>
          <li>تعديل اسمك وبياناتك من حسابك.</li>
          <li>إيقاف تنبيهات واتساب أو البريد من الإعدادات، وإيقاف إشعارات الموبايل أو إذن الموقع من إعدادات الموبايل.</li>
          <li>حذف حسابك من التطبيق أو الموقع — الخطوات في صفحة {deletion("حذف الحساب")}.</li>
          <li>طلب نسخة من بياناتك أو تصحيحها أو حذف تقييم: ابعت لـ {email}.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="8. الحماية">
        <p>
          كل الاتصال بالموقع والتطبيق عبر HTTPS. كلمات السر وأكواد الدخول بتتخزن مشفّرة (hash)، ورموز الدخول على الموبايل
          في التخزين الآمن للنظام. مفيش نظام آمن بنسبة 100%.
        </p>
      </LegalSection>

      {/* VERIFY: minimum age — the code has no age gate; decide the policy (stores' declarations suggest 18+) before stating one. */}

      <LegalSection title="9. التغييرات والتواصل">
        <p>لو غيّرنا السياسة دي هنحدّث التاريخ في أولها.</p>
        <p>
          لأي سؤال عن الخصوصية: {email}
          <br />
          <span dir="ltr">{BUSINESS_ADDRESS}</span>
        </p>
      </LegalSection>
    </>
  );

  const en = (
    <>
      {/* VERIFY: the legal entity that operates Maw3ed (company name, registration country) — the code only has the brand name and the address in src/lib/support.ts. */}
      <p>
        Maw3ed is an appointment-booking platform connecting customers with businesses (clinics, salons, restaurants and
        more), on maw3ed.net and in the Maw3ed mobile app. This policy explains what data we collect, what we use it for,
        who receives it, and how you control it.
      </p>

      <LegalSection title="1. What we collect">
        <LegalList>
          <li>
            <strong>Account:</strong> name, mobile number, email address, a password if you sign up with email (stored as a
            bcrypt hash we cannot read), and notification preferences.
          </li>
          <li>
            <strong>Bookings:</strong> the name and mobile number you book under, your email if you give one, the service,
            time, branch, staff member, party size and any notes you write, plus price, deposit and discount.
          </li>
          <li>
            <strong>Reviews:</strong> your rating, comment and any photos you attach. If you mark a review helpful or report
            it, we store only a hash of a random ID kept in your browser, to prevent duplicates.
          </li>
          <li>
            <strong>Business owners and staff:</strong> business details (name, address, map location, phone and WhatsApp,
            photos, services, hours), staff names, photos and sign-in numbers, subscription and payment records, and the
            customer records and notes a business keeps.
          </li>
          <li>
            <strong>Payments:</strong> amount, status, method and Paymob transaction references. Card details are entered on
            Paymob&apos;s own page and never reach Maw3ed.
          </li>
          <li>
            <strong>Device and app:</strong> your push-notification token and platform, and the device name for app sign-in
            sessions. Sign-in tokens are kept on your phone in the system&apos;s secure storage.
          </li>
          <li>
            <strong>Location:</strong> the app asks for your location only when you ask for places near you — one reading
            per request, no tracking, nothing in the background. The coordinates are sent with that request only; our code
            does not log or store them, on the phone or on the server. You can decline and choose an area instead.
            {/* VERIFY: the hosting provider (Vercel) may record request URLs, including ?lat=&lng=, in its own access logs; the app code does not log them. */}
          </li>
          <li>
            <strong>Technical:</strong> your IP address is used for rate limiting and stored only as a keyed hash, briefly.
            The source of a visit to a business page (Instagram, WhatsApp, Google…) is counted as a daily total, not linked
            to the visitor.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. How we use it">
        <LegalList>
          <li>Signing you in and confirming your number with a WhatsApp code.</li>
          <li>Creating your booking and sending it to the business; sending you confirmations, reminders, review requests and updates.</li>
          <li>Processing payments, refunds and business subscriptions.</li>
          <li>Showing reviews and business pages publicly.</li>
          <li>Protecting the platform from abuse, fixing errors, and answering support requests.</li>
        </LegalList>
        <p>We do not sell your data or use it for advertising, and there are no advertising SDKs on the website or in the app.</p>
      </LegalSection>

      <LegalSection title="3. Who receives it">
        <LegalList>
          <li>
            <strong>The business you book with</strong> sees your name, number, email (if given), booking details and notes.
          </li>
          <li>
            <strong>The public:</strong> reviews appear on the business&apos;s page with your first name and last initial,
            the comment, photos and the business&apos;s reply. Business pages and their details are public.
          </li>
          <li>
            <strong>Service providers working for us:</strong>
            <LegalList>
              <li>Meta (WhatsApp Business): mobile number and message text, for sign-in codes and booking messages.</li>
              <li>Resend: email address and message content, for email.</li>
              <li>Expo, and through it Apple and Google: push token and notification text, for push notifications.</li>
              <li>Paymob: amount, name, email and mobile number, to take payment on its hosted page.</li>
              <li>Cloudinary: uploaded images (business and review photos).</li>
              <li>Sentry: error reports (see below).</li>
              <li>Vercel (hosting) and Neon (database): all data stored on the platform.</li>
            </LegalList>
            {/* VERIFY: Cloudinary is the upload target in src/lib/services/cloudinary.ts — confirm review photos go through it in production. */}
            {/* VERIFY: Neon as the database host comes from .env.example only; confirm the production provider and region. */}
            {/* VERIFY: SMS — src/lib/notifications/channels.ts sends SMS only when SMS_API_URL/SMS_API_KEY are set; none is configured today. If a gateway is added, name it here. */}
          </li>
          <li>Authorities, where the law requires it.</li>
        </LegalList>
        <p>These providers may process data in countries other than your own.</p>
        {/* VERIFY: processing regions of Vercel, Neon, Resend, Sentry, Cloudinary and Expo. */}
      </LegalSection>

      <LegalSection title="4. Crash reports and analytics">
        <p>
          We use Sentry on the website and in the app to find and fix errors. Before a report leaves, phone numbers, email
          addresses, cookies and authorization headers are removed, and the report identifies the account only by its
          internal ID. There is no session replay.
        </p>
        {/* VERIFY: mobile Sentry (@sentry/react-native) is being added; confirm it uses the same scrubbing (no names, phones, emails) before release. */}
        <p>There are no third-party analytics or tracking tools on the website or in the app.</p>
      </LegalSection>

      <LegalSection title="5. Cookies and on-device storage">
        <LegalList>
          <li>The website sign-in cookie.</li>
          <li><code>maw3ed-lang</code> and <code>maw3ed-city</code>: your chosen language and city.</li>
          <li><code>mw_d</code>: a random ID to prevent duplicate review votes and reports.</li>
          <li><code>maw3ed_ref</code>: a referral code when a business signs up from an invite link.</li>
          <li>Browser local storage: saved places for signed-out visitors, and the business sign-up draft.</li>
        </LegalList>
        <p>There are no advertising or tracking cookies. You can clear cookies in your browser; you will need to sign in again.</p>
      </LegalSection>

      <LegalSection title="6. How long we keep it">
        <LegalList>
          <li>Your account is kept until you delete it.</li>
          <li>Sign-in codes are valid for 10 minutes and deleted once used; an app sign-in session expires 60 days after you sign in.</li>
          <li>
            Bookings, reviews and payment records stay with the businesses as records of appointments that happened, even
            after an account is deleted — details on the {deletion("account deletion")} page.
          </li>
        </LegalList>
        {/* VERIFY: no retention period or purge job exists for Booking, Customer, Review, Payment, NotificationDelivery or AuditLog rows; decide a period before stating one. */}
      </LegalSection>

      <LegalSection title="7. Your rights and choices">
        <LegalList>
          <li>Edit your name and details in your account.</li>
          <li>Turn WhatsApp or email alerts off in settings; turn push notifications or location permission off in your phone&apos;s settings.</li>
          <li>Delete your account in the app or on the website — steps on the {deletion("account deletion")} page.</li>
          <li>Ask for a copy of your data, a correction, or a review&apos;s removal: email {email}.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          All traffic to the website and app uses HTTPS. Passwords and sign-in codes are stored hashed, and app sign-in
          tokens are kept in the phone&apos;s secure storage. No system is perfectly secure.
        </p>
      </LegalSection>

      {/* VERIFY: minimum age — the code has no age gate; decide the policy (stores' declarations suggest 18+) before stating one. */}

      <LegalSection title="9. Changes and contact">
        <p>If we change this policy we will update the date at the top.</p>
        <p>
          Privacy questions: {email}
          <br />
          {BUSINESS_ADDRESS}
        </p>
      </LegalSection>
    </>
  );

  return (
    <LegalPage
      path="/privacy"
      forced={forced}
      title={{ ar: "سياسة الخصوصية", en: "Privacy Policy" }}
      updated={{ ar: "آخر تحديث: 14 أكتوبر 2026", en: "Last updated: 14 October 2026" }}
      body={{ ar, en }}
    />
  );
}
