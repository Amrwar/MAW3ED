"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { z } from "zod";
import { signUpSchema } from "@/lib/validations";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";

const formSchema = signUpSchema.extend({
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export default function SignupPage() {
  const { t } = useLanguage();
  const s = t.auth.signup;
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(formSchema) });

  async function onSubmit(data: FormData) {
    setServerError(null);

    const res = await fetch("/api/auth/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: data.name, email: data.email, password: data.password }),
    });

    const json = await res.json();
    if (!res.ok) {
      setServerError(json.error ?? s.createError);
      return;
    }

    const result = await signIn("credentials", {
      email:    data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError(s.accountCreated);
      router.push("/login");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="card p-7">
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">{s.title}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{s.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {s.fullName}
          </label>
          <input
            type="text"
            autoComplete="name"
            placeholder={s.namePlaceholder}
            className="input"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {s.email}
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
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {s.password}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={s.passwordHint}
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

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {s.confirmPassword}
          </label>
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            className="input"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {serverError}
          </div>
        )}

        <Button type="submit" variant="accent" fullWidth isLoading={isSubmitting} className="mt-2">
          <UserPlus size={15} />
          {s.submit}
        </Button>

        <p className="text-center text-xs text-[var(--color-text-muted)]">
          {s.termsPrefix}{" "}
          <Link href="/terms" className="underline">{s.termsLink}</Link>
          {" "}&{" "}
          <Link href="/privacy" className="underline">{s.privacyLink}</Link>
        </p>
      </form>

      <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
        {s.hasAccount}{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
        >
          {s.loginLink}
        </Link>
      </p>
    </div>
  );
}
