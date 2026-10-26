import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";

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

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
