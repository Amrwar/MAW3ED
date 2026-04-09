"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "هل يمكنني إلغاء الحجز؟",
    a: "نعم، يمكنك إلغاء الحجز قبل ٢٤ ساعة من الموعد بدون أي رسوم. للإلغاء أقل من ٢٤ ساعة تواصل معنا مباشرة وسيساعدك فريقنا.",
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
    <div
      id="faq"
      className="rounded-3xl border p-6 md:p-8"
      style={{
        background:  "#FFFFFF",
        borderColor: "#E2E8F0",
        boxShadow:   "0 2px 12px rgba(15,23,42,0.04)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-1 h-6 rounded-full shrink-0"
          style={{ background: "linear-gradient(to bottom, #1D4ED8, #3B82F6)" }}
        />
        <h2 className="text-xl font-black text-[#0F172A]">الأسئلة الشائعة</h2>
      </div>

      {/* Accordion items */}
      <div className="space-y-2.5">
        {FAQS.map((faq, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="rounded-2xl border overflow-hidden transition-all duration-200"
              style={{
                borderColor:      isOpen ? "rgba(59,130,246,0.30)" : "#E2E8F0",
                borderInlineStart: isOpen ? "3px solid #3B82F6" : "3px solid transparent",
                background:       isOpen ? "#FAFCFF" : "#F8FAFC",
                boxShadow:        isOpen
                  ? "0 4px 16px rgba(59,130,246,0.08)"
                  : "0 1px 4px rgba(15,23,42,0.02)",
              }}
            >
              {/* Question button */}
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-start gap-3"
              >
                <span
                  className="text-sm font-semibold leading-snug transition-colors duration-150"
                  style={{ color: isOpen ? "#1D4ED8" : "#0F172A" }}
                >
                  {faq.q}
                </span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{
                    background: isOpen ? "#DBEAFE" : "#F1F5F9",
                  }}
                >
                  <ChevronDown
                    size={15}
                    style={{
                      color:     isOpen ? "#1D4ED8" : "#94A3B8",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.25s ease, color 0.15s ease",
                    }}
                  />
                </div>
              </button>

              {/* Answer — CSS grid-rows smooth reveal */}
              <div
                style={{
                  display:             "grid",
                  gridTemplateRows:    isOpen ? "1fr" : "0fr",
                  transition:          "grid-template-rows 0.28s ease",
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  <div className="px-5 pb-5 pt-0">
                    {/* Top hairline */}
                    <div
                      className="mb-3"
                      style={{
                        height:     "1px",
                        background: "linear-gradient(to left, transparent, rgba(59,130,246,0.20), transparent)",
                      }}
                    />
                    <p className="text-sm text-[#475569] leading-loose">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
