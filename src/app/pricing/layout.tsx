import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";

/**
 * The page itself is a client component, so it cannot export metadata.
 * Without this it inherited the site-wide default and went to Google
 * titled with the site-wide default, competing with the
 * home page for the same words and carrying no canonical, so every
 * campaign link with a tracking parameter was a separate URL to index.
 */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return lang === "en"
    ? buildMetadata({
        title: "Pricing",
        description: "Maw3ed plans for business owners — a free plan, paid plans, and a detailed comparison of what each includes.",
        path: "/pricing",
        lang,
      })
    : buildMetadata({
        title: "الأسعار",
        description:
          "خطط موعد لأصحاب الأعمال — خطة مجانية وخطط مدفوعة، ومقارنة تفصيلية للمزايا بينها.",
        path: "/pricing",
      });
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
