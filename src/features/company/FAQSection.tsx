"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "هل يمكنني إلغاء الحجز؟",
    a: "نعم، يمكنك إلغاء الحجز قبل 24 ساعة من الموعد بدون أي رسوم. للإلغاء أقل من 24 ساعة تواصل معنا مباشرة وسيساعدك فريقنا.",
  },
  {
    q: "كيف أحصل على تأكيد الحجز؟",
    a: "سيصلك تأكيد الحجز فورًا على رقم الواتساب الذي أدخلته. كما ستحصل على تذكير تلقائي قبل موعدك بساعة حتى لا تفوّته.",
  },
  {
    q: "هل هناك رسوم للحجز عبر موعد؟",
    a: "لا، الحجز عبر منصة موعد مجاني تمامًا للعملاء. تدفع فقط قيمة الخدمة في مكان العمل عند حضورك.",
  },
  {
    q: "ماذا لو كان العمل مغلقًا في موعدي؟",
    a: "في حالة أي تعديل أو إلغاء من طرف مقدم الخدمة، ستتلقى إشعارًا فوريًا. يمكنك أيضًا التواصل مع الفريق مباشرة لإعادة الجدولة.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq">
      <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">
        الأسئلة الشائعة
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
