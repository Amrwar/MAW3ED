import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import { getLang } from "@/lib/lang-server";
import { DEFAULT_OG_IMAGE, ogLocale } from "@/lib/seo/meta";
import { siteUrl } from "@/lib/url";

// The defaults every page inherits, in the language the page is served
// in. They were Arabic over an English page for anyone who had switched,
// so the title, description and og:locale disagreed with <html lang>.
const META = {
  ar: {
    title: "موعد | Maw3ed — احجز ميعادك أونلاين في مصر",
    description:
      "احجز في عيادات وصالونات وجيمات ومراكز في مصر في ثواني، من غير مكالمات. شوف المواعيد الفاضية واحجز على طول.",
    short: "احجز في عيادات وصالونات وجيمات ومراكز في مصر في ثواني، من غير مكالمات.",
  },
  en: {
    title: "Maw3ed — Book appointments online in Egypt",
    description:
      "Book clinics, salons, gyms and centres in Egypt in seconds, without phone calls. See the free times and book straight away.",
    short: "Book clinics, salons, gyms and centres in Egypt in seconds, without phone calls.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const m = META[lang];
  return {
    metadataBase: new URL(siteUrl("/")),
    title: {
      default: m.title,
      template: lang === "en" ? "%s | Maw3ed" : "%s | موعد · Maw3ed",
    },
    description: m.description,
    keywords: ["حجز مواعيد", "عيادات", "صالونات", "مصر", "booking", "maw3ed", "موعد"],
    authors: [{ name: "Maw3ed" }],
    creator: "Maw3ed",
    appleWebApp: { capable: true, title: "موعد", statusBarStyle: "default" },
    openGraph: {
      type: "website",
      locale: ogLocale(lang),
      siteName: "موعد · Maw3ed",
      title: m.title,
      description: m.short,
      images: [{ url: DEFAULT_OG_IMAGE.url, ...DEFAULT_OG_IMAGE.size, alt: "موعد · Maw3ed" }],
    },
    twitter: {
      card: "summary_large_image",
      title: lang === "en" ? "Maw3ed" : "موعد | Maw3ed",
      description: m.short,
      images: [DEFAULT_OG_IMAGE.url],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The navbar's own colour, so the browser chrome on a phone continues it.
  themeColor: "#11201C",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();
  const dir  = lang === "en" ? "ltr" : "rtl";

  return (
    <html lang={lang} dir={dir}>
      <body className="antialiased min-h-screen">
        {/*
          Skip to the content.
          
          Every page puts a header, a nav and a language switcher before
          the thing the visitor came for — forty-odd tab stops on a
          business profile. Without this, reaching the booking widget by
          keyboard means passing all of them, on every page, every time.

          Off-screen until focused, which is the point: it is the first
          tab stop, and the first Tab press reveals it.
        */}
        <a href="#main" className="skip-link">
          {lang === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}
        </a>
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
