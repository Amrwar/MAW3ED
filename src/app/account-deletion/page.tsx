import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/meta";
import LegalPage, { LegalList, LegalSection } from "@/components/legal/LegalPage";
import { parseLangParam } from "@/components/legal/lang-param";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export const metadata: Metadata = buildMetadata({
  title: "حذف الحساب",
  description: "إزاي تحذف حسابك على موعد، وإيه اللي بيتحذف وإيه اللي بيفضل عند الأنشطة.",
  path: "/account-deletion",
});

/**
 * How to delete a Maw3ed account — public, no sign-in, because Google
 * Play asks for exactly that.
 *
 * Every statement here is what the code does, not what a policy might
 * hope for:
 *   - the steps: mobile/app/me/delete.tsx and
 *     src/app/account/_components/DeleteAccount.tsx, both calling
 *     /api/account/delete/code then /api/account/delete;
 *   - what goes and what stays: src/lib/account/deletion.ts;
 *   - owners refused: deletionBlocker() returns "owns-business".
 * Change those and this page has to change with them.
 */
export default async function AccountDeletionPage({
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
  const settings = (
    <Link href="/account/settings" className="text-[var(--color-jade)] hover:underline">
      maw3ed.net/account/settings
    </Link>
  );
  const privacy = (label: string) => (
    <Link href="/privacy" className="text-[var(--color-jade)] hover:underline">
      {label}
    </Link>
  );

  const ar = (
    <>
      <p>
        تقدر تحذف حساب العميل بتاعك على موعد بنفسك من التطبيق أو من الموقع. الحذف نهائي ومينفعش يترجع.
        عشان نتأكد إنك صاحب الحساب، بنبعتلك كود تأكيد على واتساب على رقم الموبايل المسجّل في الحساب.
      </p>

      <LegalSection title="1. من تطبيق موعد">
        <ol className="list-decimal space-y-2 ps-5">
          <li>افتح تبويب <strong>حسابي</strong>.</li>
          <li>اضغط <strong>حذف الحساب</strong>.</li>
          <li>اضغط <strong>ابعتلي كود التأكيد</strong> — هيوصلك كود على واتساب.</li>
          <li>اكتب الكود واضغط <strong>احذف حسابي نهائيًا</strong>.</li>
        </ol>
      </LegalSection>

      <LegalSection title="2. من الموقع">
        <ol className="list-decimal space-y-2 ps-5">
          <li>سجّل دخولك على maw3ed.net وافتح <strong>الإعدادات</strong> في حسابك ({settings}).</li>
          <li>في جزء <strong>حذف الحساب</strong> اضغط <strong>احذف حسابي</strong> ثم <strong>ابعتلي كود التأكيد</strong>.</li>
          <li>اكتب الكود اللي وصلك على واتساب واضغط <strong>احذف الحساب نهائيًا</strong>.</li>
        </ol>
      </LegalSection>

      <LegalSection title="3. لو مش قادر تدخل على حسابك">
        <p>
          لو مش قادر تسجّل دخول، أو حسابك مفيهوش رقم موبايل متأكد منه (وده لازم عشان كود التأكيد)، ابعت إيميل
          لـ {email} بعنوان «حذف الحساب»، من البريد الإلكتروني المسجّل في الحساب، واكتب فيه رقم الموبايل المسجّل.
          ممكن نطلب منك تأكيد إضافي إن الحساب بتاعك قبل ما نحذفه.
        </p>
        {/* VERIFY: response time for deletion requests sent by email — no SLA exists in code; none is promised here. */}
      </LegalSection>

      <LegalSection title="4. إيه اللي بيتحذف">
        <LegalList>
          <li>الحساب نفسه: الاسم ورقم الموبايل والبريد الإلكتروني وكلمة السر (لو موجودة) وتفضيلات الإشعارات.</li>
          <li>الأماكن المحفوظة (المفضلة) وقائمة الإشعارات داخل الحساب.</li>
          <li>كل جلسات الدخول على التطبيق وكل تسجيلات إشعارات الموبايل (Push)، فالتطبيق بيعمل تسجيل خروج على كل الأجهزة، والموقع بيعمل تسجيل خروج بعد الحذف.</li>
          <li>أي أكواد دخول أو روابط تغيير كلمة السر لسه صالحة لرقمك أو بريدك.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. إيه اللي بيفضل عند الأنشطة">
        <p>
          الحجوزات مش مربوطة بالحساب، كل حجز متسجّل بالاسم ورقم الموبايل اللي اتعمل بيهم. علشان كده بعد حذف الحساب
          بيفضل الآتي كما هو، من غير ما يتمسح أو يتعمل له إخفاء هوية:
        </p>
        <LegalList>
          <li>
            <strong>الحجوزات</strong> عند كل نشاط حجزت فيه: الاسم ورقم الموبايل والخدمة والميعاد والسعر وأي ملاحظات كتبتها.
          </li>
          <li>
            <strong>سجل العميل عند النشاط</strong>: الاسم ورقم الموبايل والبريد الإلكتروني (لو كتبته وقت الحجز)، وأي ملاحظات
            أو تصنيفات النشاط ضافها.
          </li>
          <li>
            <strong>التقييمات</strong> اللي كتبتها بتفضل منشورة على صفحة النشاط، باسمك الأول وأول حرف من اسم العيلة،
            مع التعليق وأي صور أرفقتها.
          </li>
          <li>
            <strong>سجلات الدفع والاسترداد</strong> المرتبطة بالحجوزات، لأنها سجلات مالية.
          </li>
          <li>سجل إرسال الإشعارات (رقم أو بريد المستلم ونوع الرسالة ونتيجة الإرسال).</li>
        </LegalList>
        {/* VERIFY: no code deletes NotificationDelivery rows for a deleted user, and no retention job prunes them; confirm the retention period you want to state. */}
        <p>
          بعد الحذف مفيش أي حساب أو تسجيل دخول مربوط بالسجلات دي، لكن الحجوزات متسجلة برقم الموبايل: لو عملت حساب جديد بنفس الرقم، حجوزاتك القديمة هتظهر فيه تاني. لو عايز تقييم معيّن يتشال، أو تطلب من نشاط يمسح
          بياناتك عنده، تواصل معانا على {email}.
        </p>
        {/* VERIFY: removing a review or a business's customer record on request is a manual support action; there is no self-service for it. */}
      </LegalSection>

      <LegalSection title="6. أصحاب الأنشطة">
        <p>
          الحساب اللي مالك نشاط مينفعش يتحذف من التطبيق أو الموقع، لأن حذفه بيشيل النشاط وكل مواعيد عملائه معاه. لقفل
          النشاط وحذف الحساب، ابعت لـ {email} من البريد الإلكتروني المسجّل للحساب.
        </p>
      </LegalSection>

      <p>تفاصيل أكتر عن البيانات اللي بنجمعها في {privacy("سياسة الخصوصية")}.</p>
    </>
  );

  const en = (
    <>
      <p>
        You can delete your Maw3ed customer account yourself, in the app or on the website. Deletion is permanent and
        cannot be undone. To make sure it is really you, we send a confirmation code by WhatsApp to the mobile number on
        the account.
      </p>

      <LegalSection title="1. In the Maw3ed app">
        <ol className="list-decimal space-y-2 ps-5">
          <li>Open the <strong>Account</strong> tab.</li>
          <li>Tap <strong>Delete account</strong>.</li>
          <li>Tap <strong>Send me a confirmation code</strong> — a code arrives on WhatsApp.</li>
          <li>Enter the code and tap <strong>Delete my account permanently</strong>.</li>
        </ol>
      </LegalSection>

      <LegalSection title="2. On the website">
        <ol className="list-decimal space-y-2 ps-5">
          <li>Sign in at maw3ed.net and open <strong>Settings</strong> in your account ({settings}).</li>
          <li>Under <strong>Delete account</strong>, choose <strong>Delete my account</strong>, then <strong>Send me a confirmation code</strong>.</li>
          <li>Enter the code you received on WhatsApp and confirm.</li>
        </ol>
      </LegalSection>

      <LegalSection title="3. If you can't get into your account">
        <p>
          If you cannot sign in, or your account has no verified mobile number (needed for the confirmation code), email{" "}
          {email} with the subject “Account deletion” from the email address on the account, and include the mobile
          number on the account. We may ask for further confirmation that the account is yours before deleting it.
        </p>
        {/* VERIFY: response time for deletion requests sent by email — no SLA exists in code; none is promised here. */}
      </LegalSection>

      <LegalSection title="4. What is deleted">
        <LegalList>
          <li>The account itself: name, mobile number, email address, password (if any) and notification preferences.</li>
          <li>Your saved places (favourites) and your in-account notification feed.</li>
          <li>Every app session and every push-notification registration, so the app signs out on every device; the website signs you out after deleting.</li>
          <li>Any sign-in codes or password-reset links still outstanding for your number or email.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. What stays with the businesses">
        <p>
          Bookings are not linked to the account: each one records the name and mobile number it was made under. So after
          the account is deleted, the following remain as they are — they are not erased or anonymised:
        </p>
        <LegalList>
          <li>
            <strong>Bookings</strong> with each business you booked: name, mobile number, service, date and time, price and
            any notes you wrote.
          </li>
          <li>
            <strong>The business&apos;s customer record</strong>: name, mobile number, email (if you gave one when booking),
            and any notes or tags the business added.
          </li>
          <li>
            <strong>Reviews</strong> you wrote stay published on the business&apos;s page, shown with your first name and last
            initial, with the comment and any photos you attached.
          </li>
          <li>
            <strong>Payment and refund records</strong> attached to bookings, because they are financial records.
          </li>
          <li>The notification delivery log (recipient number or email, message type and delivery result).</li>
        </LegalList>
        {/* VERIFY: no code deletes NotificationDelivery rows for a deleted user, and no retention job prunes them; confirm the retention period you want to state. */}
        <p>
          After deletion, none of these records is linked to an account or login. Bookings are kept under the phone number, though: if you create a new account with the same number, your past bookings will show in it again. To have a particular review removed,
          or to ask for a business&apos;s copy of your details to be erased, contact {email}.
        </p>
        {/* VERIFY: removing a review or a business's customer record on request is a manual support action; there is no self-service for it. */}
      </LegalSection>

      <LegalSection title="6. Business owners">
        <p>
          An account that owns a business cannot be deleted from the app or the website, because that would take the
          business and all of its customers&apos; appointments with it. To close the business and delete the account,
          email {email} from the account&apos;s email address.
        </p>
      </LegalSection>

      <p>More about the data we collect is in our {privacy("Privacy Policy")}.</p>
    </>
  );

  return (
    <LegalPage
      path="/account-deletion"
      forced={forced}
      title={{ ar: "حذف حساب موعد", en: "Delete your Maw3ed account" }}
      updated={{ ar: "آخر تحديث: 14 أكتوبر 2026", en: "Last updated: 14 October 2026" }}
      body={{ ar, en }}
    />
  );
}
