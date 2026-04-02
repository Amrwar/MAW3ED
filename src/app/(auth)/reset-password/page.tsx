"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

// useSearchParams must be wrapped in Suspense (Next.js requirement)
function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

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
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
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
      if (!res.ok) { setError(data.error ?? "حدث خطأ، حاول مرة أخرى"); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("تعذّر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ─────────────────────────────────────────
  if (done) {
    return (
      <div className="card p-7 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--color-text-primary)] mb-1">
            تم تغيير كلمة المرور
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة
          </p>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">جاري التحويل لصفحة الدخول...</p>
      </div>
    );
  }

  // ── No token (redirect pending) ───────────────────────────
  if (!token) return null;

  // ── Form ──────────────────────────────────────────────────
  return (
    <div className="card p-7">
      <div className="text-center mb-7">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-light)] flex items-center justify-center mx-auto mb-4">
          <Lock size={22} className="text-[var(--color-accent)]" />
        </div>
        <h1 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">
          كلمة مرور جديدة
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          أدخل كلمة مرورك الجديدة أدناه
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            كلمة المرور الجديدة
          </label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              placeholder="8 أحرف على الأقل"
              className="input w-full pe-10"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute inset-y-0 end-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            تأكيد كلمة المرور
          </label>
          <input
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            placeholder="أعد كتابة كلمة المرور"
            className="input w-full"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          />
          {/* Inline match indicator */}
          {confirm.length > 0 && (
            <p className={`mt-1 text-xs ${password === confirm ? "text-green-600" : "text-red-500"}`}>
              {password === confirm ? "✓ كلمتا المرور متطابقتان" : "كلمتا المرور غير متطابقتين"}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || password.length < 8 || password !== confirm}
          className="btn btn-primary w-full gap-2 mt-2"
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" /> جاري التحديث...</>
            : "تعيين كلمة المرور الجديدة"
          }
        </button>
      </form>

      <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
        <Link
          href="/login"
          className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
        >
          العودة لتسجيل الدخول
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
