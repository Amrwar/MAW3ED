"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { arCount } from "@/lib/fmt";

interface Props {
  /**
   * Hours before the appointment until which the customer can cancel or
   * move it themselves — CUTOFF_HOURS, which the cancel and reschedule
   * routes enforce.
   */
  changeCutoffHours: number;
  /** Whether this business has online deposits switched on. */
  depositEnabled: boolean;
  depositPercent: number;
}

type Faq = { q: string; a: string };

/**
 * Each answer states what the product does, not what it might: the
 * cancel window is the one the API applies, a deposit is mentioned only
 * where this business takes one, and nothing promises a refund the code
 * does not make (deposits are refunded by hand, if at all).
 */
function faqs(lang: "ar" | "en", p: Props): Faq[] {
  const h = p.changeCutoffHours;
  const takesDeposit = p.depositEnabled && p.depositPercent > 0;

  if (lang === "en") {
    const hours = `${h} ${h === 1 ? "hour" : "hours"}`;
    return [
      {
        q: "Can I cancel or change my booking?",
        a: `Yes. From your booking page (the link you get after booking) you can cancel or move it yourself up to ${hours} before the appointment. Closer than that, contact the business directly.` +
          (takesDeposit ? " A deposit is not refunded automatically when you cancel; ask the business about it." : ""),
      },
      {
        q: "How do I get my booking confirmation?",
        a: "Your booking details and booking number appear on screen as soon as you book. If you gave an email, the details and a link to manage the booking go there too, and depending on the business you may also get it on WhatsApp. You'll be notified when the business confirms, and reminded before the appointment.",
      },
      {
        q: "Does booking through Maw3ed cost anything?",
        a: takesDeposit
          ? `Booking through Maw3ed is free. This business may ask for a ${p.depositPercent}% deposit, paid online when you book; you pay the rest to the business.`
          : "No, booking through Maw3ed is free. You pay the business for the service.",
      },
      {
        q: "What if the business cancels or changes my appointment?",
        a: "You'll be notified straight away. You can book another time from this page whenever you like.",
      },
    ];
  }

  const hours = arCount(h, { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" });
  return [
    {
      q: "أقدر ألغي الحجز أو أغيّر ميعاده؟",
      a: `أيوه. من صفحة الحجز (الرابط اللي بيظهرلك بعد الحجز) تقدر تلغي أو تغيّر الميعاد بنفسك لحد ${hours} قبله. لو فاضل أقل من كده، كلّم المكان مباشرة.` +
        (takesDeposit ? " العربون مش بيترجع تلقائيًا لو لغيت، اسأل المكان عليه." : ""),
    },
    {
      q: "التأكيد بيوصلني إزاي؟",
      a: "تفاصيل الحجز ورقمه بيظهروا على الشاشة أول ما تحجز. لو كتبت إيميلك، بيوصلك عليه التفاصيل ورابط إدارة الحجز، وحسب المكان ممكن يوصلك كمان على واتساب. وبيوصلك إشعار لما المكان يأكد الحجز، وتذكير قبل الميعاد.",
    },
    {
      q: "الحجز على موعد بفلوس؟",
      a: takesDeposit
        ? `الحجز على موعد ببلاش. المكان ده ممكن يطلب عربون ${p.depositPercent}% تدفعه أونلاين وقت الحجز، والباقي بتدفعه للمكان.`
        : "لأ، الحجز على موعد ببلاش. بتدفع تمن الخدمة للمكان.",
    },
    {
      q: "لو المكان لغى الميعاد أو غيّره؟",
      a: "هيوصلك إشعار على طول، وتقدر تحجز ميعاد تاني من الصفحة دي في أي وقت.",
    },
  ];
}

export default function FAQSection(props: Props) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);
  const FAQS = faqs(lang, props);

  return (
    <section id="faq">
      <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">
        {lang === "en" ? "FAQ" : "الأسئلة الشائعة"}
      </h2>

      <div className="flex flex-col gap-2.5">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          const panelId = `biz-faq-panel-${i}`;
          const btnId = `biz-faq-btn-${i}`;

          return (
            <div
              key={item.q}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]"
            >
              <h3 className="m-0">
                <button
                  id={btnId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-5 px-5 py-4 text-start"
                >
                  <span className="text-[0.9375rem] font-bold text-[var(--color-ink)]">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={17}
                    strokeWidth={2}
                    aria-hidden="true"
                    className={`shrink-0 text-[var(--color-subtle)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </h3>

              {isOpen && (
                <div id={panelId} role="region" aria-labelledby={btnId} className="px-5 pb-5">
                  <p className="m-0 max-w-[62ch] text-[0.875rem] leading-[1.85] text-[var(--color-muted)]">
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
