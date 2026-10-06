import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { translations, type Lang } from "@/lib/i18n";
import NotificationList from "../account/_components/NotificationList";

export const metadata: Metadata = {
  title: "الإشعارات",
  robots: { index: false, follow: false },
};

/**
 * One notification centre for everybody.
 *
 * A notification belongs to a User, and a business owner is a User —
 * so somebody who runs a salon and also books haircuts elsewhere sees
 * both here, in one list, newest first. That is the honest answer: they
 * are one person. Each row carries its own destination, so tapping a
 * new-booking alert opens the dashboard and tapping a reminder opens
 * the booking, without the page having to pick a side.
 */
export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/account-login?next=/notifications");

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[var(--color-ground)] pt-20">
        <div className="container-app max-w-[46rem] py-8">
          <header className="mb-6">
            <h1 className="m-0 text-[1.5rem] font-light tracking-tight text-[var(--color-ink)]">
              {t.account.notificationsTitle}
            </h1>
            <p className="mt-1 text-[0.875rem] text-[var(--color-subtle)]">
              {t.account.notificationsSub}
            </p>
          </header>

          <NotificationList
            initial={items.map((n) => ({
              id: n.id,
              kind: n.kind,
              title: n.title,
              body: n.body,
              href: n.href,
              readAt: n.readAt ? n.readAt.toISOString() : null,
              createdAt: n.createdAt.toISOString(),
            }))}
            initialUnread={unread}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
