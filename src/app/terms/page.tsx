import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import LegalPage, { LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return lang === "en"
    ? buildMetadata({
        title: "Terms of use",
        description: "Terms of use of the Maw3ed platform for customers and business owners.",
        path: "/terms",
        lang,
      })
    : buildMetadata({
        title: "شروط الاستخدام",
        description: "شروط استخدام منصة موعد للعملاء ولأصحاب الأعمال.",
        path: "/terms",
      });
}

/**
 * The terms in both languages. The English is a translation of the
 * Arabic, section for section; it adds nothing the Arabic does not say.
 */
export default function TermsPage() {
  // Underlined: inside a sentence, colour alone does not mark a link.
  const email = (
    <a href={SUPPORT_MAILTO} dir="ltr" className="text-[var(--color-jade)] underline underline-offset-2">
      {SUPPORT_EMAIL}
    </a>
  );

  const ar = (
    <>
      <LegalSection title="1. قبول الشروط">
        <p>
          باستخدامك منصة موعد (Maw3ed)، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء منها، يُرجى عدم استخدام المنصة.
        </p>
      </LegalSection>
      <LegalSection title="2. وصف الخدمة">
        <p>
          موعد هي منصة رقمية تتيح للأعمال التجارية إدارة مواعيدها وللعملاء حجز الخدمات بسهولة. المنصة وسيط بين الطرفين ولا تتحمل مسؤولية جودة الخدمات المقدمة.
        </p>
      </LegalSection>
      <LegalSection title="3. حساب المستخدم">
        <p>
          أنت مسؤول عن الحفاظ على سرية بيانات حسابك. يجب إخطارنا فورًا في حال الاشتباه في أي استخدام غير مصرح به لحسابك.
        </p>
      </LegalSection>
      <LegalSection title="4. الاستخدام المقبول">
        <p>
          تتعهد بعدم استخدام المنصة لأغراض غير قانونية أو لنشر محتوى مسيء أو مضلل. نحتفظ بالحق في إيقاف أي حساب يخالف هذه الشروط.
        </p>
      </LegalSection>
      <LegalSection title="5. تعديل الشروط">
        <p>
          قد نقوم بتحديث هذه الشروط من وقت لآخر. سيتم إخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة.
        </p>
      </LegalSection>
      <LegalSection title="6. التواصل">
        <p>
          لأي استفسارات حول شروط الاستخدام، تواصل معنا عبر البريد الإلكتروني: {email}.
        </p>
      </LegalSection>
    </>
  );

  const en = (
    <>
      <LegalSection title="1. Acceptance of the terms">
        <p>
          By using the Maw3ed platform, you agree to be bound by these terms and conditions. If you do not agree with any part of them, please do not use the platform.
        </p>
      </LegalSection>
      <LegalSection title="2. The service">
        <p>
          Maw3ed is a digital platform that lets businesses manage their appointments and lets customers book services easily. The platform is an intermediary between the two and is not responsible for the quality of the services provided.
        </p>
      </LegalSection>
      <LegalSection title="3. Your account">
        <p>
          You are responsible for keeping your account details confidential. Tell us immediately if you suspect any unauthorised use of your account.
        </p>
      </LegalSection>
      <LegalSection title="4. Acceptable use">
        <p>
          You agree not to use the platform for unlawful purposes or to publish offensive or misleading content. We reserve the right to suspend any account that breaks these terms.
        </p>
      </LegalSection>
      <LegalSection title="5. Changes to the terms">
        <p>
          We may update these terms from time to time. You will be told of any material change by email or by a notice on the platform.
        </p>
      </LegalSection>
      <LegalSection title="6. Contact">
        <p>
          For any questions about these terms of use, email us at {email}.
        </p>
      </LegalSection>
    </>
  );

  return (
    <LegalPage
      path="/terms"
      title={{ ar: "شروط الاستخدام", en: "Terms of use" }}
      updated={{ ar: "آخر تحديث: مارس 2025", en: "Last updated: March 2025" }}
      body={{ ar, en }}
    />
  );
}
