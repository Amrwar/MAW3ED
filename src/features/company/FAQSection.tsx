"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "هل يمكنني إلغاء الحجز؟",
    a: "نعم، يمكنك إلغاء الحجز قبل ٢٤ ساعة من الموعد بدون أي رسوم. للإلغاء أقل من ٢٤ ساعة تواصل معنا مباشرة.",
  },
  {
    q: "كيف أحصل على تأكيد الحجز؟",
    a: "سيصلك تأكيد الحجز فورًا على رقم الواتساب الذي أدخلته، كما ستحصل على تذكير قبل موعدك بساعة.",
  },
  {
    q: "هل هناك رسوم للحجز عبر موعد؟",
    a: "لا، الحجز عبر موعد مجاني تمامًا للعملاء. تدفع فقط قيمة الخدمة في مكان العمل.",
  },
  {
    q: "ماذا لو كان العمل مغلقًا في موعدي؟",
    a: "في حالة أي تعديل على موعدك، ستتلقى إشعارًا فوريًا من فريق العمل. يمكنك أيضًا التواصل معنا مباشرة.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="py-8 border-b border-[var(--color-border)]">
      <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-6">
        الأسئلة الشائعة
      </h2>

      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="border border-[var(--color-border)] rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-start hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {faq.q}
              </span>
              <ChevronDown
                size={16}
                className={cn(
                  "text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ms-3",
                  open === i && "rotate-180"
                )}
              />
            </button>
            {open === i && (
              <div className="px-5 pb-4">
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {faq.a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
