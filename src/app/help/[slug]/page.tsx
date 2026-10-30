import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "@/components/shared/LocaleLink";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import { HELP_ARTICLES, findArticle } from "@/lib/help/articles";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = findArticle(slug);
  if (!a) return {};
  const lang = await getLang();
  const t = lang === "en" ? a.en : a.ar;
  return buildMetadata({ title: t.title, description: t.summary, path: `/help/${slug}`, lang });
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) notFound();
  const lang = await getLang();
  const en = lang === "en";
  const t = en ? article.en : article.ar;

  return (
    <>
      <Navbar />
      <main id="main" className="pt-24 pb-16">
        <article className="container-app max-w-3xl space-y-8 text-start" dir={en ? "ltr" : "rtl"} lang={lang}>
          <nav aria-label={en ? "Breadcrumb" : "مسار الصفحة"} className="text-sm">
            <Link href="/help" className="text-[var(--color-jade)] underline">{en ? "Help centre" : "مركز المساعدة"}</Link>
          </nav>
          <header className="space-y-2">
            <h1 className="m-0 text-3xl font-extrabold text-[var(--color-ink)]">{t.title}</h1>
            <p className="m-0 text-[var(--color-muted)]">{t.summary}</p>
          </header>

          {t.sections.map((s, i) => (
            <section key={i} className="space-y-3 leading-relaxed text-[var(--color-text-secondary)]">
              {s.heading ? <h2 className="m-0 text-lg font-extrabold text-[var(--color-ink)]">{s.heading}</h2> : null}
              {s.paragraphs.map((p, j) => (
                <p key={j} className="m-0">{p}</p>
              ))}
              {s.bullets ? (
                <ul className="m-0 list-disc space-y-1.5 ps-5">
                  {s.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          {article.related ? (
            <Link href={article.related.href} className="btn btn-primary">
              {en ? article.related.en : article.related.ar}
            </Link>
          ) : null}

          <p className="m-0 border-t border-[var(--color-line)] pt-6 text-sm text-[var(--color-subtle)]">
            {en ? "Didn't answer your question? Email " : "لسه عندك سؤال؟ ابعت على "}
            <a href={SUPPORT_MAILTO} className="text-[var(--color-jade)] underline" dir="ltr">{SUPPORT_EMAIL}</a>
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
