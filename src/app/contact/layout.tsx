import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/meta";

/** Client page, so the metadata lives here. See the pricing layout. */
export const metadata: Metadata = buildMetadata({
  title: "تواصل معنا",
  description: "تواصل مع فريق دعم موعد عبر البريد الإلكتروني أو واتساب.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
