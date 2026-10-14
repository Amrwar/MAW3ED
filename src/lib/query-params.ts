import { z } from "zod";
import { err } from "@/lib/api";

/**
 * Query-string parsing for API routes.
 *
 * A parameter the caller got wrong is a 400 with a code, never a 500:
 * `?page=abc` used to reach Prisma as NaN and `?status=NOPE` as an enum
 * it does not have, and both came back as "something went wrong on our
 * side". Empty values count as absent, so `?page=` is the default page.
 */
export function parseQuery<S extends z.ZodType>(
  params: URLSearchParams,
  schema: S,
): { ok: true; data: z.infer<S> } | { ok: false; response: Response } {
  const raw: Record<string, string> = {};
  for (const [k, v] of params.entries()) if (v !== "") raw[k] = v;

  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };

  const issue = parsed.error.issues[0];
  const field = issue?.path.join(".") || "query";
  return {
    ok: false,
    response: err(`قيمة غير صالحة: ${field}`, 400, { code: "bad-params", field }),
  };
}

/** A 1-based page number. */
export const pageParam = z.coerce.number().int().min(1).max(100_000);

/** YYYY-MM-DD that is also a real calendar day. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "invalid date");
