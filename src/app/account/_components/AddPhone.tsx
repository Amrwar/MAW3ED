"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight, Languages, MessageCircle, Sparkles } from "lucide-react";
import Logo from "@/components/shared/Logo";
import Link from "@/components/shared/LocaleLink";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMounted } from "@/hooks/useMounted";
import { countText } from "@/lib/i18n";

type Step = "phone" | "code";

/** Seconds before another code may be requested. Matches the server. */
const RESEND_SECONDS = 60;

/**
 * "Add your mobile number", for an account signed in without one: a
 * Google sign-in, or an owner who signed in with email.
 *
 * Bookings are found by the number they were made with, so the customer
 * area has nothing to show until the number is proved. The same two
 * steps as a phone sign-in (the same code, from /api/auth/phone/send),
 * then POST /api/account/phone attaches it:
 *
 *   { linked }  the number is this account's now: the session is told
 *               (its token carries the phone) and the page reloads.
 *   { merged }  the number had an account and this one was only a
 *               Google sign-in, now folded into it: signing in with
 *               Google again lands there. Google does not ask again.
 */
export default function AddPhone({ isOwner }: { isOwner: boolean }) {
  const { t, lang } = useLanguage();
  const hydrated = useMounted();
  const a = t.accountLogin;
  const p = t.account.addPhone;
  const router = useRouter();
  const { update } = useSession();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchFailed, setSwitchFailed] = useState(false);
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

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? p.failed);
        setCode("");
        codeRef.current?.focus();
        setBusy(false);
        return;
      }
      if (data.merged) {
        await switchToMergedAccount();
        return;
      }
      // The token carries the phone; refresh it now rather than at its
      // next periodic check, then draw the account.
      await update();
      router.refresh();
    } catch {
      setError(p.failed);
      setBusy(false);
    }
  }

  /**
   * After a merge this account no longer exists; signing in with Google
   * again opens the one that holds the number. If that cannot start (a
   * network failure), say so and offer the button again rather than
   * leave "signing you in…" on screen for good. The merge itself is
   * done, so the retry is only the sign-in.
   */
  async function switchToMergedAccount() {
    setSwitching(true);
    setSwitchFailed(false);
    try {
      await signIn("google", { redirectTo: "/account" });
    } catch {
      setSwitching(false);
      setSwitchFailed(true);
      setBusy(false);
    }
  }

  if (switchFailed) {
    return (
      <Frame>
        <h1 className="auth-title">{p.title}</h1>
        <div className="mt-5 flex flex-col gap-4">
          <Alert tone="danger">{p.switchFailed}</Alert>
          <Button type="button" variant="primary" fullWidth onClick={switchToMergedAccount}>
            {t.auth.google.continue}
          </Button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <header className="mb-6">
        <h1 className="auth-title">{step === "phone" ? p.title : p.codeTitle}</h1>
        <p className="auth-sub">
          {step === "phone" ? p.subtitle : a.codeSubtitle.replace("{phone}", phone.trim())}
        </p>
      </header>

      {switching ? (
        <p role="status" className="m-0 text-[0.9375rem] text-[var(--color-ink)]">
          {p.switching}
        </p>
      ) : step === "phone" ? (
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
        </form>
      ) : (
        <form method="post" onSubmit={confirm} className="flex flex-col gap-4">
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
            {p.submit}
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

      {isOwner && (
        <div className="mt-6 border-t border-[var(--color-line)] pt-5">
          <p className="m-0 mb-3 text-[0.8125rem] text-[var(--color-subtle)]">{p.ownerHint}</p>
          <Link href="/dashboard" className="btn btn-outline">
            {t.account.goToDashboard}
          </Link>
        </div>
      )}
    </Frame>
  );
}

/**
 * The sign-in pages' look (AuthShell) as one card inside the account
 * page, which keeps the site's header and footer: the dark brand panel
 * beside the form, stacked above it on a phone. Same classes, so the
 * fields and the button take the same shape as on /account-login.
 */
function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const b = t.auth.brand;
  return (
    <div className="auth-card">
      <aside className="auth-card-brand" aria-label={b.label}>
        <Logo size="md" variant="white" className="auth-brand-logo" />
        <p className="auth-headline">{b.headline}</p>
        <ul className="auth-facts">
          <li>
            <MessageCircle size={16} strokeWidth={1.8} aria-hidden="true" />
            {b.factWhatsApp}
          </li>
          <li>
            <Languages size={16} strokeWidth={1.8} aria-hidden="true" />
            {b.factLanguages}
          </li>
          <li>
            <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
            {b.factFree}
          </li>
        </ul>
      </aside>
      <div className="auth-pane auth-card-form">{children}</div>
    </div>
  );
}
