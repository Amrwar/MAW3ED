import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import PhoneLogin from "./_components/PhoneLogin";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "Customer sign in" : "الدخول لحسابك",
    description: en
      ? "Sign in to Maw3ed to see your bookings and saved places."
      : "ادخل على حسابك في موعد عشان تشوف حجوزاتك ومحفوظاتك.",
    robots: { index: false, follow: true },
  };
}

export default function AccountLoginPage() {
  return <PhoneLogin />;
}
