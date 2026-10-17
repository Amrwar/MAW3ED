"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";

type State = "idle" | "sending" | "sent" | "error";

/**
 * Asks the server for a fresh verification link. The server throttles
 * per account, so a 429 here is expected and gets its own message
 * rather than a generic failure.
 */
export default function ResendVerificationButton() {
  const { t } = useLanguage();
  const v = t.auth.verifyEmail;
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
          data.alreadyVerified ? v.alreadyVerified : v.linkSent,
        );
        return;
      }

      if (res.status === 401) {
        setState("error");
        setMessage(v.signInFirst);
        return;
      }

      setState("error");
      // The server words its own errors in Arabic; in English the
      // generic sentence is the honest fallback.
      setMessage(t.lang === "ar" && data.error ? data.error : v.sendFailed);
    } catch {
      setState("error");
      setMessage(v.offline);
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
        {state === "sent" ? v.sent : v.resend}
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
