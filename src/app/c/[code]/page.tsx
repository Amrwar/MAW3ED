import type { Metadata } from "next";
import Link from "@/components/shared/LocaleLink";
import Logo from "@/components/shared/Logo";
import { auth } from "@/auth";
import { getLang } from "@/lib/lang-server";
import { localName } from "@/lib/lang";
import { resolveBusinessAccess } from "@/lib/business-access";
import { extractCode } from "@/lib/access/check-in";
import CheckInDesk from "@/components/access/CheckInDesk";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === "en" ? "Check-in code" : "كود تسجيل وصول", robots: { index: false, follow: false } };
}

/**
 * Where a booking QR's URL lands when scanned with an ordinary phone
 * camera. The URL carries an opaque code and nothing else, and this page
 * shows nothing about it to anyone but the business's own signed-in
 * staff — who get the check-in desk, which asks the server (scoped to
 * their own diary) what the code is.
 */
export default async function ScannedCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const valid = extractCode(code);
  const session = await auth();
  const staff = session?.user?.id ? await resolveBusinessAccess(session.user.id) : null;
  const en = (await getLang()) === "en";

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]" dir={en ? "ltr" : "rtl"}>
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-line)]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center"><Logo size="sm" /></div>
      </header>
      <main id="main" className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {staff && valid ? (
          <>
            <h1 className="text-lg font-bold">
              {en ? "Check-in" : "تسجيل وصول"} — {localName(en, staff.business.nameAr, staff.business.nameEn)}
            </h1>
            <CheckInDesk initialCode={valid} />
          </>
        ) : (
          <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 space-y-3">
            <h1 className="text-lg font-bold">{en ? "This is a booking check-in code" : "ده كود تسجيل وصول لحجز"}</h1>
            <p className="text-sm text-[var(--color-muted)]">
              {en
                ? "Show it at reception at the place you booked with when you arrive. The code shows no details to anyone but that place's own team."
                : "اعرضه على استقبال المكان اللي حجزت فيه لما توصل. الكود مش بيعرض أي بيانات لحد غير فريق المكان نفسه."}
            </p>
            {!session?.user?.id && (
              <Link href={`/login?next=/c/${encodeURIComponent(code)}`} className="text-sm text-[var(--color-brand)] underline">
                {en ? "Work there? Sign in to check the customer in" : "شغال في المكان؟ سجّل دخولك عشان تسجّل الوصول"}
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
