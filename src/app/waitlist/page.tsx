import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "@/components/shared/LocaleLink";
import { getLang } from "@/lib/lang-server";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "Alert confirmed" : "تأكيد التنبيه",
    robots: { index: false, follow: false },
  };
}

/** Where the waitlist confirmation link lands (api/public/waitlist/confirm). */
export default async function WaitlistPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, lang] = await Promise.all([searchParams, getLang()]);
  const en = lang === "en";
  const done = status === "ok";

  return (
    <>
      <Navbar />
      <main id="main" className="flex min-h-[70vh] items-center justify-center bg-[var(--color-ground)] px-5 pt-20">
        <div className="card max-w-md p-8 text-center">
          {done ? (
            <CheckCircle2 size={36} aria-hidden="true" className="mx-auto text-[var(--color-ok)]" />
          ) : (
            <XCircle size={36} aria-hidden="true" className="mx-auto text-[var(--color-danger)]" />
          )}
          <h1 className="m-0 mt-4 text-xl font-bold text-[var(--color-ink)]">
            {done ? (en ? "You're on the list" : "اتسجّلت") : en ? "This link has expired" : "الرابط ده مش شغال"}
          </h1>
          <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--color-subtle)]">
            {done
              ? en
                ? "We'll send you one email when what you searched for is on Maw3ed."
                : "هنبعتلك إيميل واحد لما اللي دوّرت عليه يبقى على موعد."
              : en
                ? "It was already used, or it is not a link we sent. You can ask again from the search page."
                : "يمكن اتستخدم قبل كده، أو مش رابط إحنا بعتناه. تقدر تطلب تاني من صفحة البحث."}
          </p>
          <Link href="/businesses" className="btn btn-primary btn-sm mt-6">
            {en ? "Browse businesses" : "تصفح الأنشطة"}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
