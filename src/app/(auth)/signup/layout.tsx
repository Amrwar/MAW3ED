import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { bounceSignedIn } from "@/lib/auth/signed-in-home";

// The page is a client component, so its title lives here. Without one it
// showed the site's home title, and could not be told apart from the
// customer sign-in (/account-login) in a tab or a search result.
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "List your business" : "سجّل نشاطك",
    description: en ? "Create an account for your business and take bookings online on Maw3ed." : "أنشئ حساب لنشاطك واستقبل حجوزات أونلاين على موعد.",
    robots: { index: false, follow: true },
  };
}

export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  await bounceSignedIn();
  return children;
}
