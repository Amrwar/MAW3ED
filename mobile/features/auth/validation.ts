import { z } from "zod";

/**
 * What the sign-in fields accept before anything is sent.
 *
 * Only to keep a button disabled and say what is wrong without a round
 * trip. The server decides: it normalises the number itself
 * (normaliseEgyptianMobile in the web's src/lib/verification.ts) and
 * its message is the one shown when it refuses. The format here mirrors
 * that rule — 01 then 0, 1, 2 or 5, then eight digits, with or without
 * +20 — and nothing beyond it.
 */

const digits = (s: string) => s.replace(/\D/g, "");

export const egyptianMobile = z
  .string()
  .transform(digits)
  .refine((d) => /^(?:20|0)?1[0125]\d{8}$/.test(d), "رقم غير صحيح — لازم يكون رقم موبايل مصري");

export const loginCode = z
  .string()
  .transform(digits)
  .refine((d) => d.length === 6, "الكود 6 أرقام");

export const emailLogin = z.object({
  email: z.string().trim().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});
