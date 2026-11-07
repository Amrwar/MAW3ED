import { z } from "zod";

/**
 * The contact form's rules, shared by the page and the API route so the
 * two can never disagree about what is accepted. Client-safe: no server
 * imports.
 */

export const CONTACT_ROLES = ["customer", "business", "other"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const CONTACT_TOPICS = [
  "booking",
  "account",
  "listing",
  "billing",
  "partnership",
  "other",
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 2000;

/**
 * A field real people never see or fill. A form that arrives with it
 * set came from a script, and is answered as if it were sent.
 */
export const CONTACT_TRAP_FIELD = "website";

/** The trap field's own check, kept outside the schema so a bot is never told. */
export function isTrapped(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const v = (body as Record<string, unknown>)[CONTACT_TRAP_FIELD];
  return typeof v === "string" && v.trim().length > 0;
}

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  // Digits, spaces and the usual punctuation of a phone number; optional.
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/)
    .optional()
    .transform((v) => v || undefined),
  role: z.enum(CONTACT_ROLES),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(CONTACT_MESSAGE_MIN).max(CONTACT_MESSAGE_MAX),
  lang: z.enum(["ar", "en"]).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** The field each validation problem belongs to, for inline messages. */
export function contactFieldErrors(error: z.ZodError): Partial<Record<keyof ContactInput, true>> {
  const out: Partial<Record<keyof ContactInput, true>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string") out[field as keyof ContactInput] = true;
  }
  return out;
}
