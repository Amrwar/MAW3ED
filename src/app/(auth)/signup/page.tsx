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

const formSchema = signUpSchema.extend({
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "كلمتا المرور غير متطابقتين",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(formSchema) });

  async function onSubmit(data: FormData) {
    setServerError(null);

    // 1. Create account
    const res = await fetch("/api/auth/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:     data.name,
        email:    data.email,
        password: data.password,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setServerError(json.error ?? "حدث خطأ أثناء إنشاء الحساب");
      return;
    }

    // 2. Auto sign-in
    const result = await signIn("credentials", {
      email:    data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError("تم إنشاء الحساب. سجّل دخولك الآن.");
      router.push("/login");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="card p-7">
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">
          ابدأ مجانًا
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          أنشئ حسابك وأضف عملك في دقائق
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            الاسم الكامل
          </label>
          <input
            type="text"
            autoComplete="name"
            placeholder="محمد أحمد"
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
            البريد الإلكتروني
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
            كلمة المرور
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="٨ أحرف على الأقل"
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
            تأكيد كلمة المرور
          </label>
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            className="input"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-500">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Server error */}
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {serverError}
          </div>
        )}

        <Button
          type="submit"
          variant="accent"
          fullWidth
          isLoading={isSubmitting}
          className="mt-2"
        >
          <UserPlus size={15} />
          إنشاء الحساب
        </Button>

        <p className="text-center text-xs text-[var(--color-text-muted)]">
          بالتسجيل توافق على{" "}
          <Link href="/terms" className="underline">
            شروط الاستخدام
          </Link>{" "}
          و{" "}
          <Link href="/privacy" className="underline">
            سياسة الخصوصية
          </Link>
        </p>
      </form>

      <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
        لديك حساب؟{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
        >
          سجّل دخولك
        </Link>
      </p>
    </div>
  );
}
