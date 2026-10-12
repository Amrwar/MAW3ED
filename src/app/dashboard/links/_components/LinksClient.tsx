"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  AtSign,
  Download,
  ExternalLink,
  Globe,
  MessageCircle,
  QrCode,
  Search,
  Share2,
  ThumbsUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TrafficSource } from "@prisma/client";
import { SOURCE_LABELS, SRC_PARAM, type LinkableSource } from "@/lib/attribution/source";
import type { AttributionReport } from "@/lib/dashboard/attribution";
import { cn } from "@/lib/utils";

// Lucide dropped its brand marks, so these are the nearest neutral
// shapes rather than logos. The label beside each one carries the name.
const CHANNEL_ICON: Record<LinkableSource, LucideIcon> = {
  INSTAGRAM: AtSign,
  WHATSAPP: MessageCircle,
  FACEBOOK: ThumbsUp,
  GOOGLE: Search,
  WEBSITE: Globe,
  QR: QrCode,
};

const CHANNEL_HINT: Record<LinkableSource, string> = {
  INSTAGRAM: "حطه في البايو وفي الاستوري",
  WHATSAPP: "ابعته في الرد التلقائي وفي حالتك",
  FACEBOOK: "زرار الحجز على الصفحة",
  GOOGLE: "رابط الحجز في ملفك على جوجل",
  WEBSITE: "زرار «احجز» على موقعك",
  QR: "اطبعه وحطه على الكاشير أو على الباب",
};

/**
 * One link per channel, a printable code, and what each one brought in.
 *
 * The links are the point: the same page with a different ?src=, so the
 * business can tell afterwards which of the places it put itself is
 * actually sending people. Without them everything arrives as "direct"
 * and there is nothing to learn.
 */
export default function LinksClient({
  plainUrl,
  businessName,
  links,
  report,
}: {
  plainUrl: string;
  businessName: string;
  links: { source: LinkableSource; url: string }[];
  report: AttributionReport;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [copied, setCopied] = useState<string | null>(null);

  function copy(key: string, text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    });
  }

  function setDays(days: number) {
    const next = new URLSearchParams(params.toString());
    next.set("days", String(days));
    router.push(`/dashboard/links?${next.toString()}`);
  }

  const shareText = `احجز في ${businessName} من هنا: ${plainUrl}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="m-0 text-[1.375rem] font-bold text-[var(--color-ink)]">روابط الحجز</h1>
        <p className="m-0 mt-1.5 max-w-[62ch] text-[0.875rem] leading-relaxed text-[var(--color-subtle)]">
          رابط مخصص لكل مكان بتحط نفسك فيه. نفس الصفحة، بس كل رابط بيقول لنا إنت جايب
          الزبون منين — عشان تعرف بعد كده إيه اللي شغّال فعلًا.
        </p>
      </header>

      {/* ── Performance ── */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-[1rem] font-bold text-[var(--color-ink)]">الأداء</h2>
          <div className="flex gap-1.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-pressed={report.days === d}
                className={cn(
                  "num min-h-9 rounded-full border px-3 text-[0.78125rem] transition-colors",
                  report.days === d
                    ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
                    : "border-[var(--color-line)] text-[var(--color-muted)]",
                )}
              >
                {d} يوم
              </button>
            ))}
          </div>
        </div>

        {report.rows.length === 0 ? (
          <p className="m-0 py-6 text-center text-[0.875rem] text-[var(--color-subtle)]">
            لسه مفيش زيارات متسجّلة. ابدأ وزّع الروابط اللي تحت وهتشوف الأرقام هنا.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.84375rem]">
                <thead>
                  <tr className="text-start text-[0.75rem] text-[var(--color-subtle)]">
                    <th className="pb-2 text-start font-normal">المصدر</th>
                    <th className="pb-2 text-end font-normal">زيارات</th>
                    <th className="pb-2 text-end font-normal">حجوزات</th>
                    <th className="pb-2 text-end font-normal">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.source} className="border-t border-[var(--color-line)]">
                      <td className="py-2.5 font-bold text-[var(--color-ink)]">
                        {SOURCE_LABELS[row.source as TrafficSource].ar}
                      </td>
                      <td className="num py-2.5 text-end text-[var(--color-muted)]">{row.views}</td>
                      <td className="num py-2.5 text-end font-bold text-[var(--color-ink)]">
                        {row.bookings}
                      </td>
                      <td className="num py-2.5 text-end text-[var(--color-muted)]">
                        {row.rate === null ? "—" : `${(row.rate * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {report.unattributedBookings > 0 && (
              <p className="num m-0 mt-3 text-[0.75rem] text-[var(--color-subtle)]">
                + {report.unattributedBookings} حجز من غير مصدر معروف — دول حجوزات اتعملت قبل
                ما نبدأ نتابع، أو وصلت من رابط من غير مصدر. مش بنوزّعهم على المصادر بالتخمين.
              </p>
            )}

            {/* The honest footnote. Views and bookings are two counts
                over the same window joined on a channel name, not one
                person followed from a tap to a booking — because there
                is no visitor record to follow. */}
            <p className="m-0 mt-2 text-[0.6875rem] leading-relaxed text-[var(--color-subtle)]">
              النسبة دي بتقارن عدد الزيارات بعدد الحجوزات في نفس الفترة لكل مصدر. مش بنتتبّع
              أشخاص: مفيش كوكيز ولا بيانات بتتخزن عن أي زائر، فالرقم مؤشّر على المصدر مش
              حساب دقيق لكل شخص.
            </p>
          </>
        )}
      </section>

      {/* ── The links ── */}
      <section className="card p-5">
        <h2 className="m-0 mb-1 text-[1rem] font-bold text-[var(--color-ink)]">الروابط</h2>
        <p className="m-0 mb-4 text-[0.8125rem] text-[var(--color-subtle)]">
          انسخ الرابط وحطه في المكان بتاعه.
        </p>

        <ul className="m-0 list-none space-y-2.5 p-0">
          {links.map(({ source, url }) => {
            const Icon = CHANNEL_ICON[source];
            return (
              <li
                key={source}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
                >
                  <Icon size={17} strokeWidth={1.8} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] font-bold text-[var(--color-ink)]">
                    {SOURCE_LABELS[source].ar}
                  </span>
                  <span className="block text-[0.6875rem] text-[var(--color-subtle)]">
                    {CHANNEL_HINT[source]}
                  </span>
                </span>

                <input
                  readOnly
                  value={url}
                  dir="ltr"
                  aria-label={`رابط ${SOURCE_LABELS[source].ar}`}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full min-w-0 flex-[1_1_18rem] rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-[0.6875rem]"
                />

                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(source, url)}
                    className="btn btn-outline btn-sm"
                  >
                    {copied === source ? <Check size={13} /> : <Copy size={13} />}
                    {copied === source ? "اتنسخ" : "نسخ"}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`افتح رابط ${SOURCE_LABELS[source].ar}`}
                    className="btn btn-ghost btn-sm"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── QR + sharing ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="m-0 mb-1 flex items-center gap-2 text-[1rem] font-bold text-[var(--color-ink)]">
            <QrCode size={17} strokeWidth={1.8} aria-hidden="true" className="text-[var(--color-jade)]" />
            كود QR
          </h2>
          <p className="m-0 mb-4 text-[0.8125rem] leading-relaxed text-[var(--color-subtle)]">
            اطبعه وحطه على الكاشير أو على الباب. أي حد يصوّره بيروح على صفحة الحجز،
            والزيارة بتتسجّل باسم «كود QR».
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/business/qr?src=${SRC_PARAM.QR}&format=svg`}
              className="btn btn-primary btn-sm"
              download
            >
              <Download size={14} aria-hidden="true" />
              SVG للطباعة
            </a>
            <a
              href={`/api/business/qr?src=${SRC_PARAM.QR}&format=png`}
              className="btn btn-outline btn-sm"
              download
            >
              <Download size={14} aria-hidden="true" />
              PNG
            </a>
          </div>
          <p className="m-0 mt-3 text-[0.6875rem] text-[var(--color-subtle)]">
            الـ SVG أحسن للطباعة — بيفضل واضح مهما كبّرته.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="m-0 mb-1 flex items-center gap-2 text-[1rem] font-bold text-[var(--color-ink)]">
            <Share2 size={17} strokeWidth={1.8} aria-hidden="true" className="text-[var(--color-jade)]" />
            مشاركة سريعة
          </h2>
          <p className="m-0 mb-4 text-[0.8125rem] leading-relaxed text-[var(--color-subtle)]">
            ابعت صفحتك لحد على طول.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              <MessageCircle size={14} aria-hidden="true" />
              واتساب
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(plainUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              <ThumbsUp size={14} aria-hidden="true" />
              فيسبوك
            </a>
            <button
              type="button"
              onClick={() => copy("share", shareText)}
              className="btn btn-ghost btn-sm"
            >
              {copied === "share" ? <Check size={14} /> : <Copy size={14} />}
              {copied === "share" ? "اتنسخ" : "انسخ الرسالة"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
