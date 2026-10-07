import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Providers from "./providers";
import type { Lang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: {
    default: "موعد | MAW3ED — منصة الحجز الأولى في مصر",
    template: "%s | موعد MAW3ED",
  },
  description:
    "احجز مواعيدك في ثوانٍ مع أفضل العيادات والصالونات والمراكز الصحية في مصر. موعد — المنصة العربية الأولى للحجز الذكي.",
  keywords: ["حجز مواعيد", "عيادات", "صالونات", "مصر", "booking", "maw3ed", "موعد"],
  authors: [{ name: "MAW3ED Team" }],
  creator: "MAW3ED",
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: "موعد | MAW3ED",
    title: "موعد | MAW3ED — منصة الحجز الأولى في مصر",
    description: "احجز مواعيدك في ثوانٍ مع أفضل العيادات والصالونات والمراكز الصحية في مصر.",
  },
  twitter: {
    card: "summary_large_image",
    title: "موعد | MAW3ED",
    description: "احجز مواعيدك في ثوانٍ مع أفضل العيادات والصالونات في مصر.",
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
