"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ForgotPasswordPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const [email,       setEmail]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [error,       setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError(T("أدخل بريدك الإلكتروني", "Enter your email address")); return; }

    setLoading(true);
    setError("");

    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The server's words are Arabic; in English, say what kind of failure it was.
        setError(
          ar
            ? res.status === 429
              ? "طلبات كتير، استنى شوية وجرّب تاني."
              : res.status === 503
                ? "الإيميل مش شغال دلوقتي، كلّم الدعم."
                : (data.error ?? "حصلت مشكلة، جرّب تاني.")
            : res.status === 429
              ? "Too many requests. Please wait a while and try again."
              : res.status === 503
                ? "Email isn't available right now. Please contact support."
                : "Something went wrong. Please try again.",
        );
        return;
      }
      setSent(true);
    } catch {
      setError(T("تعذّر الاتصال بالخادم، حاول مرة أخرى", "Couldn't reach the server. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ─────────────────────────────────────────
  if (sent) {
    return (
      <div className="card p-7 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[var(--color-ok-soft)] flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-[var(--color-ok)]" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">
            {T("تحقق من بريدك الإلكتروني", "Check your email")}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {T("لو في حساب بالبريد ده، بعتنا عليه رابط إعادة التعيين:", "If an account uses this address, we've sent a reset link to")}{" "}
            <strong className="text-[var(--color-text-primary)]" dir="ltr">{email}</strong>
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {T(
              "الرابط صالح لمدة ساعة واحدة. تحقق من مجلد الرسائل غير المرغوب فيها إذا لم تجده.",
              "The link works for one hour. Check your spam folder if you can't find it.",
            )}
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)] hover:underline"
        >
          <ArrowRight size={14} aria-hidden="true" className="ltr:rotate-180" />
          {T("العودة لتسجيل الدخول", "Back to sign in")}
        </Link>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────
  return (
    <div className="card p-7">
      <div className="text-center mb-7">
        <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--color-accent-light)] flex items-center justify-center mx-auto mb-4">
          <Mail size={22} className="text-[var(--color-accent)]" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)] mb-1">
          {T("نسيت كلمة المرور؟", "Forgot your password?")}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {T("أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين", "Enter your email and we'll send you a reset link")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="field-label" htmlFor="fp-email">
            {T("البريد الإلكتروني", "Email")}
          </label>
          <input
            id="fp-email"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            dir="ltr"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            className="input w-full"
          />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full gap-2 mt-2"
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> {T("جاري الإرسال...", "Sending…")}</>
            : T("إرسال رابط إعادة التعيين", "Send reset link")
          }
        </button>
      </form>

      <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
        {T("تذكّرت كلمة المرور؟", "Remembered it?")}{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
        >
          {T("سجّل الدخول", "Sign in")}
        </Link>
      </p>
    </div>
  );
}
