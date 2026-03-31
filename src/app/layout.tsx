import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

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
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
