import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Providers from "./providers";
import type { Lang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: {
    default: "موعد | Maw3ed — احجز ميعادك أونلاين في مصر",
    template: "%s | موعد · Maw3ed",
  },
  description:
    "احجز في عيادات وصالونات وجيمات ومراكز في مصر في ثواني، من غير مكالمات. شوف المواعيد الفاضية واحجز على طول.",
  keywords: ["حجز مواعيد", "عيادات", "صالونات", "مصر", "booking", "maw3ed", "موعد"],
  authors: [{ name: "Maw3ed" }],
  creator: "Maw3ed",
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: "موعد · Maw3ed",
    title: "موعد | Maw3ed — احجز ميعادك أونلاين في مصر",
    description: "احجز في عيادات وصالونات وجيمات ومراكز في مصر في ثواني، من غير مكالمات.",
  },
  twitter: {
    card: "summary_large_image",
    title: "موعد | Maw3ed",
    description: "احجز في عيادات وصالونات وجيمات ومراكز في مصر في ثواني، من غير مكالمات.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAFAF7",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
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
