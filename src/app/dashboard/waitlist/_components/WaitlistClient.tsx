"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Link from "@/components/shared/LocaleLink";
import { Field, INPUT, PageHeader, StatusChip, cairoToday, useLoad, useSay } from "@/components/dashboard/kit";
import { clock, time } from "@/lib/fmt";

type Named = { id: string; nameAr: string; nameEn: string | null };

interface Entry {
  id: string;
  serviceId: string;
  staffMemberId: string | null;
  fromTime: string;
  toTime: string;
  partySize: number | null;
  customerName: string;
  customerPhone: string;
  status: "WAITING" | "OFFERED" | "BOOKED" | "EXPIRED" | "CANCELLED";
  offeredTime: string | null;
  offerExpiresAt: string | null;
  offers: number;
  bookingId: string | null;
  createdAt: string;
}

const STATUS: Record<Entry["status"], { tone: "jade" | "warn" | "muted" | "danger" | "info"; ar: string; en: string }> = {
  WAITING: { tone: "info", ar: "مستني", en: "Waiting" },
  OFFERED: { tone: "warn", ar: "اتعرض عليه ميعاد", en: "Offered" },
  BOOKED: { tone: "jade", ar: "حجز", en: "Booked" },
  EXPIRED: { tone: "muted", ar: "العرض انتهى", en: "Expired" },
  CANCELLED: { tone: "danger", ar: "اتلغى", en: "Cancelled" },
};

export default function WaitlistClient({
  services,
  staff,
  enabled,
  offerMinutes,
}: {
  services: Named[];
  staff: Named[];
  enabled: boolean;
  offerMinutes: number;
}) {
  const { lang, say } = useSay();
  const [date, setDate] = useState(cairoToday);
  const { data, error, loading } = useLoad<{ date: string; entries: Entry[] }>(
    /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/api/business/waitlist?date=${date}` : null,
  );
  const name = (list: Named[], id: string | null) => {
    const x = id ? list.find((s) => s.id === id) : null;
    return x ? (lang === "en" && x.nameEn ? x.nameEn : x.nameAr) : null;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={say("قائمة الانتظار", "Waitlist")}
        sub={say(
          `لما ميعاد يفضى، بيتعرض أوتوماتيك على اللي مستنيين، الأقدم الأول، ومحجوز له ${offerMinutes} دقيقة يأكّد فيها. لو مأكّدش، بيتعرض على اللي بعده.`,
          `When a time frees up it is offered automatically to those waiting, oldest first, and held for ${offerMinutes} minutes. If they do not confirm, it goes to the next.`,
        )}
      />

      {!enabled && (
        <Alert tone="info">
          {say("قائمة الانتظار مقفولة. تقدر تفتحها من ", "The waitlist is off. Turn it on in ")}
          <Link href="/dashboard/operations" className="font-bold underline">{say("التشغيل اليومي", "Operations")}</Link>.
        </Alert>
      )}

      <div className="card max-w-xs p-4">
        <Field label={say("اليوم", "Day")} htmlFor="wl-date">
          <input id="wl-date" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </Field>
      </div>

      {loading && (
        <p className="text-sm text-[var(--color-subtle)]">
          <Loader2 size={14} className="me-1 inline animate-spin" aria-hidden="true" />
          {say("بيحمّل…", "Loading…")}
        </p>
      )}
      {error && <Alert tone="danger">{error === "network" ? say("تعذّر الاتصال", "Could not connect") : error}</Alert>}

      {data && data.entries.length === 0 && (
        <div className="card p-8 text-center text-[0.875rem] text-[var(--color-subtle)]">
          {say("مفيش حد مستني اليوم ده.", "Nobody is waiting for this day.")}
        </div>
      )}

      {data && data.entries.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] text-[0.8125rem]">
            <thead>
              <tr className="text-[0.75rem] text-[var(--color-subtle)]">
                <th className="p-3 text-start font-semibold">#</th>
                <th className="p-3 text-start font-semibold">{say("العميل", "Customer")}</th>
                <th className="p-3 text-start font-semibold">{say("الخدمة", "Service")}</th>
                <th className="p-3 text-start font-semibold">{say("الوقت المطلوب", "Wanted between")}</th>
                <th className="p-3 text-start font-semibold">{say("الحالة", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => {
                const st = STATUS[e.status];
                const who = name(staff, e.staffMemberId);
                return (
                  <tr key={e.id} className="border-t border-[var(--color-line)] align-top">
                    <td className="num p-3 text-[var(--color-subtle)]">{i + 1}</td>
                    <td className="p-3">
                      <p className="m-0 font-bold text-[var(--color-ink)]">{e.customerName}</p>
                      <a href={`tel:${e.customerPhone}`} className="num text-[0.75rem] text-[var(--color-jade)]" dir="ltr">{e.customerPhone}</a>
                      {e.partySize ? <p className="num m-0 text-[0.6875rem] text-[var(--color-subtle)]">{say(`${e.partySize} أفراد`, `party of ${e.partySize}`)}</p> : null}
                    </td>
                    <td className="p-3">
                      {name(services, e.serviceId) ?? "—"}
                      {who && <p className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">{say("مع ", "with ")}{who}</p>}
                    </td>
                    <td className="num p-3" dir="ltr">{clock(e.fromTime)} – {clock(e.toTime)}</td>
                    <td className="p-3">
                      <StatusChip tone={st.tone}>{say(st.ar, st.en)}</StatusChip>
                      {e.status === "OFFERED" && e.offeredTime && (
                        <p className="num m-0 mt-1 text-[0.6875rem] text-[var(--color-subtle)]">
                          {say("ميعاد ", "Time ")}{clock(e.offeredTime)}
                          {e.offerExpiresAt && say(` · لحد ${time(e.offerExpiresAt)}`, ` · until ${time(e.offerExpiresAt)}`)}
                        </p>
                      )}
                      {e.offers > 0 && e.status !== "OFFERED" && (
                        <p className="num m-0 mt-1 text-[0.6875rem] text-[var(--color-subtle)]">
                          {say(`اتعرض عليه ${e.offers} مرة`, `${e.offers} offers so far`)}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
