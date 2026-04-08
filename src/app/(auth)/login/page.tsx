"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginSchema } from "@/lib/validations";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";

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

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card p-7">
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">{l.title}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{l.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {l.email}
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            dir="ltr"
            className="input"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              {l.password}
            </label>
            <Link href="/forgot-password" className="text-xs text-[var(--color-accent)] hover:underline">
              {l.forgotPassword}
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="input pe-10"
              {...register("password")}
            />
            <button
              type="button"
              className="absolute inset-y-0 end-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {serverError}
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} className="mt-2">
          <LogIn size={15} />
          {l.submit}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
        {l.noAccount}{" "}
        <Link
          href="/signup"
          className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
        >
          {l.createAccount}
        </Link>
      </p>
    </div>
  );
}
