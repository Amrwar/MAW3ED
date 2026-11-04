import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import { translations } from "@/lib/i18n";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { requestNonce } from "@/lib/security/nonce";

/** Client page, so the metadata lives here. See the pricing layout. */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return lang === "en"
    ? buildMetadata({
        title: "Frequently asked questions",
        description: "Answers to the most common questions about Maw3ed — how to book, how to add your business, and how the plans differ.",
        path: "/faq",
        lang,
      })
    : buildMetadata({
        title: "الأسئلة الشائعة",
        description:
          "إجابات على أكثر الأسئلة شيوعًا حول موعد — إزاي تحجز، إزاي تضيف نشاطك التجاري، والفرق بين الخطط.",
        path: "/faq",
      });
}

/**
 * FAQPage structured data: the same questions and answers the page shows,
 * in the page's language, from the same translations. Nothing here the
 * reader cannot see.
 */
export default async function FaqLayout({ children }: { children: React.ReactNode }) {
  const [lang, nonce] = await Promise.all([getLang(), requestNonce()]);
  const f = translations[lang].faq;
  const items = [...f.items, ...f.customerItems, ...f.businessItems];
  return (
    <>
      {children}
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            inLanguage: lang,
            mainEntity: items.map((i) => ({
              "@type": "Question",
              name: i.q,
              acceptedAnswer: { "@type": "Answer", text: i.a },
            })),
          }),
        }}
      />
    </>
  );
}
