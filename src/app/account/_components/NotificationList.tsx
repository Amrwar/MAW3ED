"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CheckCheck,
  CreditCard,
  Star,
  TriangleAlert,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { groupByDay } from "@/lib/notifications/grouping";

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, typeof Bell> = {
  BOOKING_CREATED: CalendarPlus,
  BOOKING_CONFIRMED: CalendarCheck,
  BOOKING_REJECTED: CalendarX,
  BOOKING_CANCELLED: CalendarX,
  BOOKING_RESCHEDULED: CalendarClock,
  BOOKING_REMINDER: CalendarClock,
  BOOKING_STARTING_SOON: BellRing,
  BOOKING_COMPLETED: CheckCheck,
  REVIEW_REQUEST: Star,
  PAYMENT_RECEIVED: CreditCard,
  PAYMENT_FAILED: TriangleAlert,
  SUBSCRIPTION_RENEWAL_DUE: TriangleAlert,
  SUBSCRIPTION_EXPIRED: TriangleAlert,
  SUBSCRIPTION_RENEWED: CheckCheck,
  GENERAL: Bell,
};

/**
 * What has happened to this customer's bookings.
 *
 * Opening one marks it read, because that is what reading it means.
 * The list does not reorder underneath them when it happens.
 */
export default function NotificationList({
  initial,
  initialUnread,
}: {
  initial: NotificationRow[];
  initialUnread: number;
}) {
  const { t, lang } = useLanguage();
  const a = t.account;

  const [rows, setRows] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [, startTransition] = useTransition();

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;

    // Optimistic: the badge should drop the moment it is tapped.
    startTransition(() => {
      const now = new Date().toISOString();
      setRows((prev) =>
        prev.map((r) => (ids.includes(r.id) && !r.readAt ? { ...r, readAt: now } : r)),
      );
      setUnread((n) => Math.max(0, n - ids.filter((id) => rows.find((r) => r.id === id && !r.readAt)).length));
    });

    await fetch("/api/account/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Bell size={24} strokeWidth={1.7} />}
          title={a.emptyNotifications}
          body={a.emptyNotificationsBody}
        />
      </div>
    );
  }

  const when = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));

  return (
    <div className="space-y-4">
      {unread > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => markRead(rows.filter((r) => !r.readAt).map((r) => r.id))}
            className="min-h-11 text-[0.8125rem] font-bold text-[var(--color-jade)] hover:underline"
          >
            {a.markAllRead}
          </button>
        </div>
      )}

      {groupByDay(rows).map((group) => (
        <section key={group.bucket}>
          <h2 className="mb-2 mt-1 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--color-faint)]">
            {group.bucket === "today"
              ? a.groupToday
              : group.bucket === "yesterday"
                ? a.groupYesterday
                : a.groupEarlier}
          </h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {group.items.map((r) => {
          const Icon = ICONS[r.kind] ?? Bell;
          const unreadRow = !r.readAt;

          const inner = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  unreadRow
                    ? "bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
                    : "bg-[var(--color-surface-3)] text-[var(--color-subtle)]",
                )}
              >
                <Icon size={17} strokeWidth={1.8} />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[0.875rem]",
                    unreadRow
                      ? "font-bold text-[var(--color-ink)]"
                      : "text-[var(--color-muted)]",
                  )}
                >
                  {r.title}
                </span>
                {r.body && (
                  <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-[var(--color-subtle)]">
                    {r.body}
                  </span>
                )}
                <span className="num mt-1 block text-[0.6875rem] text-[var(--color-faint)]">
                  {when(r.createdAt)}
                </span>
              </span>

              {unreadRow && (
                <span
                  aria-hidden="true"
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-jade)]"
                />
              )}
            </>
          );

          const className = cn(
            "flex w-full items-start gap-3 rounded-[var(--radius-lg)] border px-4 py-3.5 text-start transition-colors",
            unreadRow
              ? "border-[var(--color-jade-line)] bg-[var(--color-jade-tint)]"
              : "border-[var(--color-line)] bg-[var(--color-surface)]",
          );

          return (
            <li key={r.id}>
              {r.href ? (
                <Link href={r.href} onClick={() => markRead([r.id])} className={className}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={() => markRead([r.id])} className={className}>
                  {inner}
                </button>
              )}
            </li>
          );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
