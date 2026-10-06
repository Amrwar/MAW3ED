import type { Metadata } from "next";
import PhoneLogin from "./_components/PhoneLogin";

export const metadata: Metadata = {
  title: "الدخول لحسابك",
  description: "ادخل على حسابك في موعد عشان تشوف حجوزاتك ومحفوظاتك.",
  robots: { index: false, follow: true },
};

export default function AccountLoginPage() {
  return <PhoneLogin />;
}
