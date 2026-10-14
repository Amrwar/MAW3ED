"use client";

import { useMounted } from "@/hooks/useMounted";
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
import Alert from "@/components/ui/Alert";

const formSchema = signUpSchema.extend({
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  // A key, worded at render time in the page's language.
  message: "mismatch",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export default function SignupPage() {
  const { t, lang } = useLanguage();
  // The submit stays disabled until React has hydrated. Before then a
  // press would be a native form submission that never reaches
  // onSubmit; with method="post" nothing would land in the URL anyway,
  // but the credentials should not leave the page at all.
  const hydrated = useMounted();
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
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-raised)]">

      <div className="mb-8">
        <h1 className="m-0 text-[1.75rem] font-light tracking-tight text-[var(--color-ink)]">
          {s.title}
        </h1>
        <p className="m-0 mt-2 text-[0.875rem] text-[var(--color-subtle)]">{s.subtitle}</p>
      </div>

      <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>

        <div>
          <label htmlFor="su-name" className="field-label">{s.fullName}</label>
          <input
            id="su-name"
            type="text"
            autoComplete="name"
            placeholder={s.namePlaceholder}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "su-name-error" : undefined}
            className={`input${errors.name ? " input-error" : ""}`}
            {...register("name")}
          />
          {errors.name && <p id="su-name-error" className="field-error">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="su-email" className="field-label">{s.email}</label>
          <input
            id="su-email"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            dir="ltr"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "su-email-error" : undefined}
            className={`input text-start${errors.email ? " input-error" : ""}`}
            {...register("email")}
          />
          {errors.email && <p id="su-email-error" className="field-error">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="su-password" className="field-label">{s.password}</label>
          <div className="relative">
            <input
              id="su-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={s.passwordHint}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "su-password-error" : undefined}
              className={`input pe-12${errors.password ? " input-error" : ""}`}
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
              className="absolute inset-y-0 end-1 flex w-11 items-center justify-center text-[var(--color-subtle)] transition-colors hover:text-[var(--color-ink)]"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
          {errors.password && <p id="su-password-error" className="field-error">{errors.password.message}</p>}
        </div>

        <div>
          <label htmlFor="su-confirm" className="field-label">{s.confirmPassword}</label>
          <input
            id="su-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? true : undefined}
            aria-describedby={errors.confirmPassword ? "su-confirm-error" : undefined}
            className={`input${errors.confirmPassword ? " input-error" : ""}`}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p id="su-confirm-error" className="field-error">
              {errors.confirmPassword.message === "mismatch"
                ? lang === "ar"
                  ? "كلمتا المرور مش متطابقتين"
                  : "Passwords do not match"
                : errors.confirmPassword.message}
            </p>
          )}
        </div>

        {serverError && <Alert tone="danger">{serverError}</Alert>}

        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} disabled={!hydrated} className="mt-1">
          <UserPlus size={16} aria-hidden="true" />
          {s.submit}
        </Button>

        <p className="m-0 text-center text-xs leading-relaxed text-[var(--color-subtle)]">
          {s.termsPrefix}{" "}
          <Link href="/terms" className="font-bold text-[var(--color-jade)]">{s.termsLink}</Link>
          {" · "}
          <Link href="/privacy" className="font-bold text-[var(--color-jade)]">{s.privacyLink}</Link>
        </p>
      </form>

      <p className="m-0 mt-7 text-center text-[0.84375rem] text-[var(--color-subtle)]">
        {s.hasAccount}{" "}
        <Link href="/login" className="font-bold text-[var(--color-jade)]">
          {s.loginLink}
        </Link>
      </p>
    </div>
  );
}
