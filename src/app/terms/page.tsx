import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
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

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="pt-24 pb-16">
        <div className="container-app max-w-3xl">
          <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] mb-2">
            شروط الاستخدام
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-10">
            آخر تحديث: مارس 2025
          </p>

          <div className="prose prose-sm max-w-none space-y-8 text-[var(--color-text-secondary)] leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">1. قبول الشروط</h2>
              <p>
                باستخدامك منصة موعد (Maw3ed)، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء منها، يُرجى عدم استخدام المنصة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">2. وصف الخدمة</h2>
              <p>
                موعد هي منصة رقمية تتيح للأعمال التجارية إدارة مواعيدها وللعملاء حجز الخدمات بسهولة. المنصة وسيط بين الطرفين ولا تتحمل مسؤولية جودة الخدمات المقدمة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">3. حساب المستخدم</h2>
              <p>
                أنت مسؤول عن الحفاظ على سرية بيانات حسابك. يجب إخطارنا فورًا في حال الاشتباه في أي استخدام غير مصرح به لحسابك.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">4. الاستخدام المقبول</h2>
              <p>
                تتعهد بعدم استخدام المنصة لأغراض غير قانونية أو لنشر محتوى مسيء أو مضلل. نحتفظ بالحق في إيقاف أي حساب يخالف هذه الشروط.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">5. تعديل الشروط</h2>
              <p>
                قد نقوم بتحديث هذه الشروط من وقت لآخر. سيتم إخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">6. التواصل</h2>
              <p>
                لأي استفسارات حول شروط الاستخدام، تواصل معنا عبر البريد الإلكتروني:{" "}
                {/* Underlined: inside a sentence, colour alone does not mark a link. */}
                <a href={SUPPORT_MAILTO} dir="ltr" className="text-[var(--color-jade)] underline underline-offset-2">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--color-line)]">
            <Link href="/" className="inline-flex min-h-11 items-center text-sm text-[var(--color-jade)] hover:underline">
              ← العودة للرئيسية
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
