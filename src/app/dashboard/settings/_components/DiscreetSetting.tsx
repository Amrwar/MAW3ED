"use client";

import { useState } from "react";
import Toggle from "@/components/ui/Toggle";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Keep the business's name off a venue's security desk (P23-A5).
 *
 * Only matters at a venue that issues visitor passes: its desk sees who
 * is expected, and normally where they are going. A medical business is
 * discreet unless its owner says otherwise; any business may choose.
 * Saves as it is flipped, like the auto-confirm switch, and a failed save
 * puts the switch back.
 */
export default function DiscreetSetting({ initial, byDefault }: { initial: boolean | null; byDefault: boolean }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const [on, setOn] = useState(initial ?? byDefault);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function change(next: boolean) {
    setOn(next);
    setState("saving");
    try {
      const res = await fetch("/api/business/settings/booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessDiscreet: next }),
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
        label={en ? "Keep my business's name off the venue's security desk" : "متظهرش اسم نشاطي لأمن المكان"}
        hint={
          en
            ? `Only matters if your business is in a venue that issues visitor passes. On: the venue's desk sees that a visitor is expected, not that they are coming to you. ${byDefault ? "On by default for medical businesses." : "Off by default."}`
            : `بيفرق بس لو نشاطك جوه مكان بيطلّع تصاريح دخول للزوار. مفعّل: أمن المكان بيشوف إن فيه زائر جاي، من غير ما يعرف إنه جايلك. ${byDefault ? "مفعّل تلقائيًا للأنشطة الطبية." : "مقفول تلقائيًا."}`
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
