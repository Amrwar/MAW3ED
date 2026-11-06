"use client";

import { useMounted } from "@/hooks/useMounted";
import { useEffect, useRef, useState } from "react";
import { countText } from "@/lib/i18n";
import Link from "@/components/shared/LocaleLink";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import GoogleButton from "@/components/auth/GoogleButton";
import AuthErrorNotice from "@/components/auth/AuthErrorNotice";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/contexts/LanguageContext";
import { safeNext } from "@/lib/account/safe-next";
import { USE_PASSWORD_CODE } from "@/lib/auth/phone-signin-policy";

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
  const { t, lang } = useLanguage();
  // The submit stays disabled until React has hydrated. Before then a
  // press would be a native form submission that never reaches
  // onSubmit; with method="post" nothing would land in the URL anyway,
  // but the credentials should not leave the page at all.
  const hydrated = useMounted();
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
        // or exhausted it was; neither does this. It does say when the
        // code was right but the account is an owner's or admin's.
        setError(result.code === USE_PASSWORD_CODE ? a.usePassword : a.codeError);
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
      <header className="mb-6">
        <h1 className="auth-title">{step === "phone" ? a.title : a.codeTitle}</h1>
        <p className="auth-sub">
          {step === "phone" ? a.subtitle : a.codeSubtitle.replace("{phone}", phone.trim())}
        </p>
      </header>

      {/* Errors from a Google sign-in started here and sent back. */}
      <div className="mb-4 empty:hidden">
        <AuthErrorNotice />
      </div>

      {/* Google first, the phone below it. A Google account has no
          phone yet: the account area asks for it next (AddPhone). */}
      {step === "phone" && (
        <div className="mb-4 empty:hidden">
          <GoogleButton redirectTo={next} divider={t.auth.google.orPhone} />
        </div>
      )}

      {step === "phone" ? (
        <form method="post" onSubmit={sendCode} className="flex flex-col gap-4">
          <Input
            label={a.phoneLabel}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            hint={a.phoneHint}
            required
          />

          {error && <Alert tone="danger">{error}</Alert>}

          <Button type="submit" variant="primary" fullWidth isLoading={busy} disabled={!hydrated}>
            {a.sendCode}
            <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
          </Button>

          <p className="m-0 text-center text-[0.75rem] leading-relaxed text-[var(--color-subtle)]">
            {a.whyPhone}
          </p>
        </form>
      ) : (
        <form method="post" onSubmit={verify} className="flex flex-col gap-4">
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

          <Button type="submit" variant="primary" fullWidth isLoading={busy} disabled={!hydrated || code.length < 4}>
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
              {cooldown > 0 ? countText(lang, cooldown, a.resendIn) : a.resend}
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
