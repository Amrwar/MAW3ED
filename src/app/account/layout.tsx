import { getLang } from "@/lib/lang-server";
import { localizePath } from "@/lib/locale-path";
import { redirect } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { auth } from "@/auth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Alert from "@/components/ui/Alert";
import { getAccountUser, getNotifications } from "@/lib/account/queries";
import { translations } from "@/lib/i18n";
import { Suspense } from "react";
import AccountNav from "./_components/AccountNav";
import NoBusinessNotice from "./_components/NoBusinessNotice";

/**
 * The customer area.
 *
 * A customer is a User with a verified phone. Somebody signed in as a
 * business owner lands here with no phone and no bookings to show, so
 * rather than an account that looks broken they get told plainly what
 * to do — sign in with the number they book with.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const lang = await getLang();
  if (!session?.user?.id) redirect(localizePath("/account-login?next=/account", lang));

  const t = translations[lang] ?? translations.ar;

  const user = await getAccountUser();

  if (!user) {
    return (
      <>
        <Navbar />
        <main id="main" className="min-h-screen bg-[var(--color-ground)] pt-20">
          <div className="container-app max-w-[40rem] py-14">
            <Alert tone="info" title={t.account.title}>
              {t.account.ownerNotice}
            </Alert>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/account-login" className="btn btn-primary">
                {t.accountLogin.title}
              </Link>
              {session.user.businessId && (
                <Link href="/dashboard" className="btn btn-outline">
                  {t.account.goToDashboard}
                </Link>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const { unread } = await getNotifications(user.id, 1);

  return (
    <>
      <Navbar />
      <main id="main" className="min-h-screen bg-[var(--color-ground)] pt-20">
        <div className="container-app py-8">
          <Suspense fallback={null}>
            <NoBusinessNotice />
          </Suspense>
          <header className="mb-6">
            <h1 className="m-0 text-[1.5rem] font-light tracking-tight text-[var(--color-ink)]">
              {user.name
                ? t.account.greeting.replace("{name}", user.name)
                : t.account.greetingNoName}
            </h1>
          </header>

          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            <aside className="lg:w-[14rem] lg:shrink-0">
              <AccountNav unread={unread} />
            </aside>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
