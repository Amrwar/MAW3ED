"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, MessageCircle, Smartphone } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/contexts/LanguageContext";
import { safeNext } from "@/lib/account/safe-next";

type Step = "phone" | "code";

/** Seconds before another code may be requested. Matches the server. */
const RESEND_SECONDS = 60;


/**
 * Signing in with a phone.
 *
 * Two steps, because that is what it is: say who you are, then prove
 * it. The code box only appears once a code has actually been sent, so
 * nobody is ever staring at a field they have nothing to put in.
 */
export default function PhoneLogin() {
  const { t } = useLanguage();
  const a = t.accountLogin;
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? a.sendError);
        return;
      }

      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch {
      setError(a.sendError);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await signIn("phone-otp", {
        phone: phone.trim(),
        code: code.trim(),
        redirect: false,
      });

      if (result?.error) {
        // The server deliberately does not say which of wrong, expired
        // or exhausted it was; neither does this.
        setError(a.codeError);
        setCode("");
        codeRef.current?.focus();
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError(a.codeError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <header className="mb-7 text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
        >
          {step === "phone" ? (
            <Smartphone size={24} strokeWidth={1.8} />
          ) : (
            <MessageCircle size={24} strokeWidth={1.8} />
          )}
        </span>

        <h1 className="m-0 text-[1.5rem] font-light tracking-tight text-[var(--color-ink)]">
          {step === "phone" ? a.title : a.codeTitle}
        </h1>
        <p className="m-0 mx-auto mt-2.5 max-w-[34ch] text-[0.875rem] leading-relaxed text-[var(--color-subtle)]">
          {step === "phone" ? a.subtitle : a.codeSubtitle.replace("{phone}", phone.trim())}
        </p>
      </header>

      {step === "phone" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <Input
            label={a.phoneLabel}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            required
          />

          {error && <Alert tone="danger">{error}</Alert>}

          <Button type="submit" variant="primary" fullWidth isLoading={busy}>
            {a.sendCode}
            <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
          </Button>

          <p className="m-0 text-center text-[0.75rem] leading-relaxed text-[var(--color-subtle)]">
            {a.whyPhone}
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <Input
            ref={codeRef}
            label={a.codeLabel}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="______"
            className="num text-center text-[1.5rem] tracking-[0.5em]"
            required
          />

          {error && <Alert tone="danger">{error}</Alert>}

          <Button type="submit" variant="primary" fullWidth isLoading={busy} disabled={code.length < 4}>
            {a.verify}
          </Button>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="min-h-11 text-[0.8125rem] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              {a.changeNumber}
            </button>

            <button
              type="button"
              onClick={() => sendCode()}
              disabled={cooldown > 0 || busy}
              className="min-h-11 text-[0.8125rem] font-bold text-[var(--color-jade)] disabled:text-[var(--color-faint)]"
            >
              {cooldown > 0 ? a.resendIn.replace("{n}", String(cooldown)) : a.resend}
            </button>
          </div>
        </form>
      )}

      {/* A business owner who lands here signs in with an email and a
          password, not a code, and had no way through from this page. */}
      <p className="mt-7 text-center text-[0.8125rem] text-[var(--color-subtle)]">
        <Link href="/login" className="font-bold text-[var(--color-jade)] hover:underline">
          {t.account.ownerSignIn}
        </Link>
      </p>
    </div>
  );
}
