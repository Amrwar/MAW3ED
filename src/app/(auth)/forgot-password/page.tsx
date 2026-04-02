"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email,       setEmail]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [error,       setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("أدخل بريدك الإلكتروني"); return; }

    setLoading(true);
    setError("");

    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "حدث خطأ، حاول مرة أخرى"); return; }
      setSent(true);
    } catch {
      setError("تعذّر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ─────────────────────────────────────────
  if (sent) {
    return (
      <div className="card p-7 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--color-text-primary)] mb-1">
            تحقق من بريدك الإلكتروني
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            أرسلنا رابط إعادة التعيين إلى{" "}
            <strong className="text-[var(--color-text-primary)]">{email}</strong>
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            الرابط صالح لمدة ساعة واحدة. تحقق من مجلد الرسائل غير المرغوب فيها إذا لم تجده.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)] hover:underline"
        >
          <ArrowRight size={14} />
          العودة لتسجيل الدخول
        </Link>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────
  return (
    <div className="card p-7">
      <div className="text-center mb-7">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-light)] flex items-center justify-center mx-auto mb-4">
          <Mail size={22} className="text-[var(--color-accent)]" />
        </div>
        <h1 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">
          نسيت كلمة المرور؟
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            البريد الإلكتروني
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            dir="ltr"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            className="input w-full"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full gap-2 mt-2"
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" /> جاري الإرسال...</>
            : "إرسال رابط إعادة التعيين"
          }
        </button>
      </form>

      <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
        تذكّرت كلمة المرور؟{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
        >
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
