"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Alert from "@/components/ui/Alert";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Deleting the account, in two steps: a fresh code to the account's own
 * phone, then the code. The server decides everything — who may delete
 * (owners and admins may not), what goes and what stays with the
 * businesses (lib/account/deletion.ts). This only asks and reports.
 */
export default function DeleteAccount() {
  const { t } = useLanguage();
  const s = t.account.settings;
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete/code", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? s.deleteError);
        return;
      }
      setStep("code");
    } catch {
      setError(s.deleteError);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), confirm: "DELETE" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? s.deleteError);
        return;
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setError(s.deleteError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {step === "idle" ? (
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="rounded-[var(--radius-md)] border border-[var(--color-danger)] px-4 py-2 text-[0.875rem] font-bold text-[var(--color-danger)] disabled:opacity-60"
        >
          {busy ? "…" : s.deleteStart}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="m-0 text-[0.84375rem] text-[var(--color-muted)]">{s.deleteSent}</p>
          <label className="block text-[0.8125rem] font-bold text-[var(--color-ink)]" htmlFor="delete-code">
            {s.deleteCode}
          </label>
          <input
            id="delete-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-40 rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-white px-3 py-2 text-center tracking-[0.3em]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={busy || code.length < 4}
              className="rounded-[var(--radius-md)] bg-[var(--color-danger)] px-4 py-2 text-[0.875rem] font-bold text-white disabled:opacity-60"
            >
              {busy ? "…" : s.deleteConfirm}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setCode("");
                setError(null);
              }}
              disabled={busy}
              className="rounded-[var(--radius-md)] px-4 py-2 text-[0.875rem] font-bold text-[var(--color-muted)]"
            >
              {s.deleteCancel}
            </button>
          </div>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
