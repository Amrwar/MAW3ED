"use client";

import { MapPin, Clock, Phone, MessageCircle } from "lucide-react";
import type { Business } from "@/types/business";
import { clock } from "@/lib/fmt";

export default function BusinessInfoRow({ business }: { business: Business }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayHours = business.hours?.find((h) => h.day === today);

  const hasAny =
    business.address || todayHours || business.phone || business.whatsapp;

  if (!hasAny) return null;

  const pill =
    "flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-[0.84375rem] text-[var(--color-ink)]";

  return (
    <div className="border-b border-[var(--color-line)] bg-[var(--color-ground)]">
      <div className="container-app py-4">
        <ul className="flex flex-wrap gap-2.5">

          {business.address && (
            <li className={pill}>
              <MapPin size={15} strokeWidth={1.8} className="shrink-0 text-[var(--color-jade)]" aria-hidden="true" />
              {business.address}
            </li>
          )}

          {todayHours && (
            <li className={pill}>
              <Clock size={15} strokeWidth={1.8} className="shrink-0 text-[var(--color-jade)]" aria-hidden="true" />
              <span className="text-[var(--color-subtle)]">اليوم</span>
              {todayHours.closed ? (
                <span className="font-bold">مغلق</span>
              ) : (
                <span className="num font-bold">
                  {clock(todayHours.open)} — {clock(todayHours.close)}
                </span>
              )}
            </li>
          )}

          {business.phone && (
            <li>
              <a href={`tel:${business.phone}`} className={`${pill} hover:border-[var(--color-line-2)]`}>
                <Phone size={15} strokeWidth={1.8} className="shrink-0 text-[var(--color-jade)]" aria-hidden="true" />
                <span className="num font-bold">{business.phone}</span>
              </a>
            </li>
          )}

          {business.whatsapp && (
            <li>
              <a
                href={`https://wa.me/${business.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-jade-line)] bg-[var(--color-jade-soft)] px-4 py-3 text-[0.84375rem] font-bold text-[var(--color-ok)]"
              >
                <MessageCircle size={15} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
                تواصل عبر واتساب
              </a>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
