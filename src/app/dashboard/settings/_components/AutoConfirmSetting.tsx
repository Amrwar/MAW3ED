"use client";

import { useState } from "react";
import Toggle from "@/components/ui/Toggle";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Confirm online bookings on the spot, or review each one first.
 *
 * Saves as it is flipped: one switch does not need a Save button, and
 * a failed save puts the switch back so it never shows a setting that
 * is not the one in force.
 */
export default function AutoConfirmSetting({ initial, monthlyLimit }: { initial: boolean; monthlyLimit: number | null }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const [on, setOn] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function change(next: boolean) {
    setOn(next);
    setState("saving");
    try {
      const res = await fetch("/api/business/settings/booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoConfirm: next }),
      });
      if (!res.ok) throw new Error();
      setState("saved");
    } catch {
      setOn(!next);
      setState("error");
    }
  }

  return (
    <div className="card mb-6 p-5">
      <Toggle
        label={en ? "Confirm online bookings automatically" : "تأكيد الحجوزات الأونلاين تلقائيًا"}
        hint={
          en
            ? `On: a booking is confirmed the moment it is made. Off: each one waits for you to confirm or decline it.${monthlyLimit !== null ? ` On the free plan this covers ${monthlyLimit} bookings a month; after that they wait for you.` : ""}`
            : `مفعّل: الحجز بيتأكد أول ما يتعمل. مقفول: كل حجز بيستناك تأكده أو ترفضه.${monthlyLimit !== null ? ` في الباقة المجانية ده لأول ${monthlyLimit} حجز في الشهر، وبعدها بيستنوك.` : ""}`
        }
        checked={on}
        disabled={state === "saving"}
        onChange={change}
      />
      <p role="status" className="m-0 mt-1 min-h-5 px-2 text-[0.75rem]">
        {state === "saved" && <span className="text-[var(--color-ok)]">{en ? "Saved" : "اتحفظ"}</span>}
        {state === "error" && <span className="text-[var(--color-danger)]">{en ? "Couldn't save. Try again." : "متحفظش، جرّب تاني."}</span>}
      </p>
    </div>
  );
}
