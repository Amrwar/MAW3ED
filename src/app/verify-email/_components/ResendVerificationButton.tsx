"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";
import Button from "@/components/ui/Button";

type State = "idle" | "sending" | "sent" | "error";

/**
 * Asks the server for a fresh verification link. The server throttles
 * per account, so a 429 here is expected and gets its own message
 * rather than a generic failure.
 */
export default function ResendVerificationButton() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/verify-email/send", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setState("sent");
        setMessage(
          data.alreadyVerified
            ? "بريدك مؤكّد بالفعل."
            : "بعتنالك رابط جديد — شوف بريدك.",
        );
        return;
      }

      if (res.status === 401) {
        setState("error");
        setMessage("سجّل دخولك الأول عشان نبعتلك الرابط.");
        return;
      }

      setState("error");
      setMessage(data.error ?? "مقدرناش نبعت الرابط دلوقتي.");
    } catch {
      setState("error");
      setMessage("مفيش اتصال بالسيرفر. حاول تاني.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="primary"
        fullWidth
        onClick={resend}
        isLoading={state === "sending"}
        disabled={state === "sent"}
      >
        {state === "sent" ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Mail size={16} aria-hidden="true" />
        )}
        {state === "sent" ? "تم الإرسال" : "ابعت رابط جديد"}
      </Button>

      {message && (
        <p
          role="status"
          className={
            state === "error"
              ? "m-0 text-[0.8125rem] text-[var(--color-danger)]"
              : "m-0 text-[0.8125rem] text-[var(--color-ok)]"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
