import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "@/components/shared/LocaleLink";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import { HELP_ARTICLES } from "@/lib/help/articles";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return lang === "en"
    ? buildMetadata({ title: "Help", description: "Guides for businesses and customers using Maw3ed.", path: "/help", lang })
    : buildMetadata({ title: "المساعدة", description: "أدلة للأنشطة والعملاء اللي بيستخدموا موعد.", path: "/help" });
}

export default async function HelpIndex() {
  const lang = await getLang();
  const en = lang === "en";
  const groups = [
    { key: "business" as const, title: en ? "For businesses" : "لأصحاب الأنشطة" },
    { key: "customer" as const, title: en ? "For customers" : "للعملاء" },
  ];

  return (
    <>
      <Navbar />
      <main id="main" className="pt-24 pb-16">
        <div className="container-app max-w-3xl space-y-10 text-start" dir={en ? "ltr" : "rtl"} lang={lang}>
          <header className="space-y-2">
            <h1 className="m-0 text-3xl font-extrabold text-[var(--color-ink)]">{en ? "Help centre" : "مركز المساعدة"}</h1>
            <p className="m-0 text-[var(--color-muted)]">
              {en ? "Short guides to the things people ask about most." : "أدلة قصيرة لأكتر حاجات الناس بتسأل عنها."}
            </p>
          </header>

          {groups.map((g) => (
            <section key={g.key} className="space-y-3" aria-labelledby={`h-${g.key}`}>
              <h2 id={`h-${g.key}`} className="m-0 text-lg font-extrabold">{g.title}</h2>
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                {HELP_ARTICLES.filter((a) => a.audience === g.key).map((a) => (
                  <li key={a.slug}>
                    <Link href={`/help/${a.slug}`} className="card block h-full p-4 hover:border-[var(--color-jade)]">
                      <p className="m-0 font-bold text-[var(--color-ink)]">{en ? a.en.title : a.ar.title}</p>
                      <p className="m-0 mt-1 text-sm text-[var(--color-subtle)]">{en ? a.en.summary : a.ar.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="card space-y-2 p-5" aria-labelledby="h-support">
            <h2 id="h-support" className="m-0 text-lg font-extrabold">{en ? "Still stuck?" : "لسه محتاج مساعدة؟"}</h2>
            <p className="m-0 text-sm text-[var(--color-muted)]">
              {en ? "Write to us and a person will reply within one working day: " : "ابعتلنا وحد من الفريق هيرد خلال يوم عمل: "}
              <a href={SUPPORT_MAILTO} className="font-bold text-[var(--color-jade)] underline" dir="ltr">{SUPPORT_EMAIL}</a>
            </p>
            <p className="m-0 text-sm">
              <Link href="/faq" className="text-[var(--color-jade)] underline">{en ? "Frequently asked questions" : "الأسئلة الشائعة"}</Link>
              {" · "}
              <Link href="/contact" className="text-[var(--color-jade)] underline">{en ? "Contact" : "تواصل معانا"}</Link>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
