import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Logo from "@/components/shared/Logo";
import { guestPassView } from "@/lib/access/passes";
import { passQr } from "@/lib/access/customer";
import PassCard from "@/components/access/PassCard";

export const metadata: Metadata = { title: "تصريح دخول", robots: { index: false, follow: false } };

/**
 * A guest's own visitor pass, from the link the booking holder shared:
 * this guest's pass and the venue's instructions — nothing about the
 * booking, the business or the other guests. Server-rendered; reload
 * for the latest state.
 */
export default async function GuestPassPage({ params }: { params: Promise<{ inviteToken: string }> }) {
  const { inviteToken } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(inviteToken)) notFound();
  const view = await guestPassView(inviteToken);
  if (!view) notFound();
  const pass = await passQr(view.pass);
  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]" dir="rtl">
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-line)]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center"><Logo size="sm" /></div>
      </header>
      <main id="main" className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <h1 className="text-lg font-bold">تصريح دخول{view.venue ? ` ${view.venue.name}` : ""}</h1>
        {view.sandbox && (
          <p className="rounded-[var(--radius-sm)] bg-[var(--color-warn-soft)] px-3 py-2 text-xs font-bold text-[var(--color-star)]">
            بيئة تجريبية: التصريح ده مش صالح عند أي بوابة حقيقية.
          </p>
        )}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 space-y-3">
          <PassCard v={pass} />
          {view.venue?.instructions && <p className="text-xs whitespace-pre-line">{view.venue.instructions}</p>}
          <p className="text-[0.7rem] text-[var(--color-muted)]">حدّث الصفحة عشان تشوف آخر حالة للتصريح.</p>
        </div>
      </main>
    </div>
  );
}
