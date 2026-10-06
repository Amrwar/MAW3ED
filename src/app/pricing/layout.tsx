import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/meta";

/**
 * The page itself is a client component, so it cannot export metadata.
 * Without this it inherited the site-wide default and went to Google
 * titled "موعد | MAW3ED — منصة الحجز الأولى في مصر", competing with the
 * home page for the same words and carrying no canonical, so every
 * campaign link with a tracking parameter was a separate URL to index.
 */
export const metadata: Metadata = buildMetadata({
  title: "الأسعار",
  description:
    "خطط موعد لأصحاب الأعمال — خطة مجانية وخطط مدفوعة، ومقارنة تفصيلية للمزايا بينها.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
