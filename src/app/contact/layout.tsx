import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";

/** Client page, so the metadata lives here. See the pricing layout. */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return lang === "en"
    ? buildMetadata({
        title: "Contact us",
        description: "Reach the Maw3ed support team by email or WhatsApp.",
        path: "/contact",
        lang,
      })
    : buildMetadata({
        title: "تواصل معنا",
        description: "تواصل مع فريق دعم موعد عبر البريد الإلكتروني أو واتساب.",
        path: "/contact",
      });
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
