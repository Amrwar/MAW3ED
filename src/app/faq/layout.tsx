import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/meta";

/** Client page, so the metadata lives here. See the pricing layout. */
export const metadata: Metadata = buildMetadata({
  title: "الأسئلة الشائعة",
  description:
    "إجابات على أكثر الأسئلة شيوعًا حول موعد — إزاي تحجز، إزاي تضيف نشاطك التجاري، والفرق بين الخطط.",
  path: "/faq",
});

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
