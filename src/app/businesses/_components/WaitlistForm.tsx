"use client";

import { useId, useState } from "react";
import { BellRing, Check } from "lucide-react";
import type { Lang } from "@/lib/i18n";

/**
 * "Tell me when one joins" — under a search that found nothing.
 *
 * Email only, and the sentence above the field says exactly what it is
 * for. Saved to WaitlistRequest (POST /api/public/waitlist), and counted
 * only once the link in the confirmation email is followed.
 */
export default function WaitlistForm({ query, city, lang }: { query: string; city: string; lang: Lang }) {
  const id = useId();
  const en = lang === "en";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "check-inbox" | "already" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/public/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, query, city: city || undefined, lang }),
      });
      const data = await res.json().catch(() => null);
      setState(!res.ok ? "error" : data?.confirmed ? "already" : "check-inbox");
    } catch {
      setState("error");
    }
  }

  if (state === "check-inbox" || state === "already") {
    return (
      <p role="status" className="m-0 flex items-center justify-center gap-2 text-[0.875rem] font-bold text-[var(--color-ok)]">
        <Check size={16} aria-hidden="true" />
        {state === "already"
          ? en ? "You're already on the list for this." : "إنت متسجّل للتنبيه ده خلاص."
          : en ? "Check your inbox and confirm, then we'll email you once when one joins." : "افتح إيميلك وأكّد، وبعدها هنبعتلك إيميل واحد أول ما يتضاف."}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md text-center">
      <label htmlFor={id} className="flex items-center justify-center gap-2 text-[0.875rem] font-bold text-[var(--color-ink)]">
        <BellRing size={16} aria-hidden="true" className="text-[var(--color-jade)]" />
        {en ? `Tell me when “${query}” is on Maw3ed` : `بلّغني لما «${query}» يبقى على موعد`}
      </label>
      <p className="m-0 mt-1 text-[0.75rem] text-[var(--color-subtle)]">
        {en ? "One email when it's listed. Nothing else." : "إيميل واحد لما يتضاف، ومش هنستخدمه في حاجة تانية."}
      </p>
      <div className="mt-3 flex gap-2">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
          placeholder="name@example.com"
          className="input min-w-0 flex-1"
        />
        <button type="submit" disabled={state === "sending"} className="btn btn-primary btn-sm shrink-0">
          {en ? "Notify me" : "بلّغني"}
        </button>
      </div>
      {state === "error" && (
        <p role="alert" className="field-error mt-2">
          {en ? "Couldn't save that. Check the email and try again." : "متحفظش. راجع الإيميل وجرّب تاني."}
        </p>
      )}
    </form>
  );
}
