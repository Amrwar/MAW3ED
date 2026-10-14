"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, CheckCircle2, Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { useLanguage } from "@/contexts/LanguageContext";

// useSearchParams must be wrapped in Suspense (Next.js requirement)
function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";
  const { lang }     = useLanguage();
  const ar           = lang === "ar";
  const T            = (a: string, e: string) => (ar ? a : e);
  // An expired or used link: the way forward is a new one, not a retry.
  const [deadLink,     setDeadLink]     = useState(false);

  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [done,         setDone]         = useState(false);
  const [error,        setError]        = useState("");

  // Redirect to forgot-password if no token in URL
  useEffect(() => {
    if (!token) router.replace("/forgot-password");
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(T("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Use at least 8 characters"));
      return;
    }
    if (password !== confirm) {
      setError(T("كلمتا المرور غير متطابقتين", "The passwords don't match"));
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const dead = data.code === "invalid-token" || data.code === "expired-token";
        setDeadLink(dead);
        setError(
          ar
            ? dead
              ? "الرابط ده انتهى أو اتستخدم قبل كده، اطلب رابط جديد."
              : res.status === 429
                ? "محاولات كتير، استنى شوية وجرّب تاني."
                : (data.error ?? "حصلت مشكلة، جرّب تاني.")
            : dead
              ? "This link has expired or was already used. Request a new one."
              : res.status === 429
                ? "Too many attempts. Please wait and try again."
                : "Something went wrong. Please try again.",
        );
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError(T("تعذّر الاتصال بالخادم، حاول مرة أخرى", "Couldn't reach the server. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ─────────────────────────────────────────
  if (done) {
    return (
      <div className="card p-7 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[var(--color-ok-soft)] flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-[var(--color-ok)]" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">
            {T("تم تغيير كلمة المرور", "Password changed")}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {T("يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة", "You can now sign in with your new password")}
          </p>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">{T("جاري التحويل لصفحة الدخول...", "Taking you to sign in…")}</p>
      </div>
    );
  }

  // ── No token (redirect pending) ───────────────────────────
  if (!token) return null;

  // ── Form ──────────────────────────────────────────────────
  return (
    <div className="card p-7">
      <div className="text-center mb-7">
        <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--color-accent-light)] flex items-center justify-center mx-auto mb-4">
          <Lock size={22} className="text-[var(--color-accent)]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)] mb-1">
          {T("كلمة مرور جديدة", "New password")}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {T("أدخل كلمة مرورك الجديدة أدناه", "Enter your new password below")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* New password */}
        <div>
          <label className="field-label" htmlFor="rp-new">
            {T("كلمة المرور الجديدة", "New password")}
          </label>
          <div className="relative">
            <input
              id="rp-new"
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              placeholder={T("8 أحرف على الأقل", "At least 8 characters")}
              className="input w-full pe-10"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? T("إخفاء كلمة المرور", "Hide password") : T("إظهار كلمة المرور", "Show password")}
              className="absolute inset-y-0 end-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="field-label" htmlFor="rp-confirm">
            {T("تأكيد كلمة المرور", "Confirm password")}
          </label>
          <input
            id="rp-confirm"
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            placeholder={T("أعد كتابة كلمة المرور", "Type it again")}
            className="input w-full"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          />
          {/* Inline match indicator */}
          {confirm.length > 0 && (
            <p className={`mt-1 text-xs ${password === confirm ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>
              {password === confirm
                ? T("✓ كلمتا المرور متطابقتان", "✓ Passwords match")
                : T("كلمتا المرور غير متطابقتين", "The passwords don't match")}
            </p>
          )}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        {deadLink && (
          <Link href="/forgot-password" className="btn btn-outline w-full">
            {T("اطلب رابط جديد", "Request a new link")}
          </Link>
        )}

        <button
          type="submit"
          disabled={loading || password.length < 8 || password !== confirm}
          className="btn btn-primary w-full gap-2 mt-2"
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> {T("جاري التحديث...", "Saving…")}</>
            : T("تعيين كلمة المرور الجديدة", "Set new password")
          }
        </button>
      </form>

      <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
        <Link
          href="/login"
          className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
        >
          {T("العودة لتسجيل الدخول", "Back to sign in")}
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
