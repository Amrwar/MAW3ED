import type { Metadata } from "next";
import Link from "next/link";
import { Star, Store } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getAccountUser, getMyReviews } from "@/lib/account/queries";
import { translations, type Lang } from "@/lib/i18n";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "تقييماتي", robots: { index: false, follow: false } };

export default async function MyReviewsPage() {
  const user = await getAccountUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  const reviews = await getMyReviews(user.phone);

  if (reviews.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Star size={24} strokeWidth={1.7} />}
          title={t.account.emptyReviews}
          body={t.account.emptyReviewsBody}
          action={
            <Link href="/account/history" className="btn btn-primary btn-sm">
              {t.account.nav.history}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <ul className="m-0 list-none space-y-4 p-0">
      {reviews.map((r) => (
        <li key={r.id}>
          <article className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">
                <Link
                  href={`/company/${r.business.slug}`}
                  className="inline-flex min-h-6 items-center text-inherit transition-colors hover:text-[var(--color-jade)]"
                >
                  {r.business.nameAr}
                </Link>
              </h2>
              <span className="num text-[0.75rem] text-[var(--color-subtle)]">
                {r.createdAt.toISOString().slice(0, 10)}
              </span>
            </div>

            <div
              className="mt-2 flex gap-0.5"
              role="img"
              aria-label={t.reviews.outOfFive.replace("{n}", String(r.rating))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={13}
                  aria-hidden="true"
                  className={
                    n <= r.rating
                      ? "fill-[var(--color-star)] text-[var(--color-star)]"
                      : "fill-[var(--color-line)] text-[var(--color-line)]"
                  }
                />
              ))}
            </div>

            {r.booking.service && (
              <p className="m-0 mt-2 text-[0.75rem] text-[var(--color-subtle)]">
                {t.reviews.forService} {r.booking.service.nameAr}
              </p>
            )}

            {r.comment && (
              <p className="m-0 mt-2.5 whitespace-pre-line text-[0.90625rem] leading-[1.8] text-[var(--color-ink-2)]">
                {r.comment}
              </p>
            )}

            {/* The owner's reply, where they have written one. */}
            {r.response && r.respondedAt && (
              <div className="mt-3.5 rounded-[var(--radius-md)] border-s-[3px] border-[var(--color-jade)] bg-[var(--color-surface-2)] px-4 py-3">
                <p className="m-0 flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--color-ok)]">
                  <Store size={12} strokeWidth={2} aria-hidden="true" />
                  {t.reviews.ownerReply}
                </p>
                <p className="m-0 mt-1.5 whitespace-pre-line text-[0.84375rem] leading-[1.75] text-[var(--color-muted)]">
                  {r.response}
                </p>
              </div>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
