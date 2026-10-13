"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginSchema } from "@/lib/validations";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";
import Alert from "@/components/ui/Alert";

type LoginForm = { email: string; password: string };

export default function LoginPage() {
  const { t } = useLanguage();
  const l = t.auth.login;
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setServerError(null);
    const result = await signIn("credentials", {
      email:    data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError(l.invalidCredentials);
      return;
    }

    router.push(await homeAfterLogin());
    router.refresh();
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-raised)]">

      <div className="mb-8">
        <h1 className="m-0 text-[1.75rem] font-light tracking-tight text-[var(--color-ink)]">
          {l.title}
        </h1>
        <p className="m-0 mt-2 text-[0.875rem] text-[var(--color-subtle)]">{l.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="login-email" className="field-label">{l.email}</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            dir="ltr"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            className={`input text-start${errors.email ? " input-error" : ""}`}
            {...register("email")}
          />
          {errors.email && (
            <p id="login-email-error" className="field-error">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="mb-[0.4375rem] flex items-baseline justify-between gap-3">
            <label htmlFor="login-password" className="field-label mb-0">{l.password}</label>
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-xs font-bold text-[var(--color-jade)]">
              {l.forgotPassword}
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              className={`input pe-12${errors.password ? " input-error" : ""}`}
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              className="absolute inset-y-0 end-1 flex w-11 items-center justify-center text-[var(--color-subtle)] transition-colors hover:text-[var(--color-ink)]"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" className="field-error">{errors.password.message}</p>
          )}
        </div>

        {serverError && <Alert tone="danger">{serverError}</Alert>}

        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} className="mt-1">
          <LogIn size={16} aria-hidden="true" />
          {l.submit}
        </Button>
      </form>

      <p className="m-0 mt-7 text-center text-[0.84375rem] text-[var(--color-subtle)]">
        {l.noAccount}{" "}
        <Link href="/signup" className="font-bold text-[var(--color-jade)]">
          {l.createAccount}
        </Link>
      </p>

      {/* This form is for business owners. A customer has no password —
          they sign in with a code — and nothing here said so. */}
      <p className="m-0 mt-3 border-t border-[var(--color-line)] pt-5 text-center text-[0.8125rem] text-[var(--color-subtle)]">
        <Link href="/account-login" className="font-bold text-[var(--color-jade)]">
          {t.account.customerSignIn}
        </Link>
      </p>
    </div>
  );
}

/**
 * Where a successful login goes: back to the dashboard page that sent
 * the person here (NextAuth's callbackUrl), else the home of what the
 * account is — the dashboard for an owner, the admin for an
 * administrator without a business, onboarding for an owner who has not
 * set one up yet. Only same-site dashboard paths are honoured.
 */
async function homeAfterLogin(): Promise<string> {
  const session = await getSession();
  const user = session?.user as { businessId?: string | null; adminRole?: string | null } | undefined;
  if (!user?.businessId) return user?.adminRole ? "/admin" : "/onboarding";

  const raw = new URLSearchParams(window.location.search).get("callbackUrl");
  if (raw) {
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith("/dashboard")) {
        return url.pathname + url.search;
      }
    } catch {
      /* not a URL: ignored */
    }
  }
  return "/dashboard";
}
