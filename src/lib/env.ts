import { z } from "zod";

/**
 * Environment validation.
 *
 * The app reads 22 environment variables across ~12 files, mostly as
 * `process.env.X ?? "some-fallback"`. That meant a missing or
 * misspelled variable surfaced as a confusing runtime failure deep in
 * a request — a booking that silently didn't send, a payment that
 * couldn't verify — rather than as a clear error at boot.
 *
 * Required variables are checked eagerly. Optional integrations
 * (WhatsApp, Paymob, Cloudinary, Resend) are grouped, and each group
 * reports whether it is fully configured, so a half-configured
 * integration is caught instead of failing on first use.
 *
 * Server only. Never import this from a client component — it would
 * pull secrets into the browser bundle. Client code should read
 * `NEXT_PUBLIC_*` directly.
 */

const required = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required — the Postgres connection string"),
  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET is required and must be at least 16 characters"),
});

const optional = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Public origin, used for canonical URLs, sitemap, auth and email links. */
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  DATABASE_URL_UNPOOLED: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Payments (Paymob)
  PAYMOB_API_KEY: z.string().optional(),
  PAYMOB_HMAC_SECRET: z.string().optional(),
  PAYMOB_IFRAME_ID: z.string().optional(),
  PAYMOB_INTEGRATION_ID: z.string().optional(),

  // WhatsApp Cloud API
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().optional(),
  WHATSAPP_DEFAULT_LANGUAGE_CODE: z.string().optional(),
  WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMATION: z.string().optional(),
  WHATSAPP_TEMPLATE_CUSTOMER_REMINDER: z.string().optional(),
  WHATSAPP_TEMPLATE_BUSINESS_NEW_BOOKING: z.string().optional(),

  // Images (Cloudinary)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const schema = required.merge(optional);

export type Env = z.infer<typeof schema>;

function parseEnv(): Env {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const lines = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // Thrown at import time so a misconfigured deploy fails fast and
    // loudly, rather than at the first request that happens to need it.
    throw new Error(`Invalid environment configuration:\n${lines}`);
  }

  return result.data;
}

export const env: Env = parseEnv();

/* ─── Integration readiness ──────────────────────────────── */

/** True only when every variable the integration needs is present. */
export const integrations = {
  email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  payments: Boolean(
    env.PAYMOB_API_KEY &&
      env.PAYMOB_HMAC_SECRET &&
      env.PAYMOB_IFRAME_ID &&
      env.PAYMOB_INTEGRATION_ID,
  ),
  whatsapp: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
  uploads: Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  ),
} as const;

/**
 * The public origin, without a trailing slash.
 *
 * Canonical URLs, the sitemap, robots.txt, JSON-LD, referral links and
 * password-reset emails all derive from this, so one resolution order
 * is defined here instead of each caller inventing its own fallback.
 */
export const siteUrl: string = (
  env.AUTH_URL ??
  env.NEXTAUTH_URL ??
  env.NEXT_PUBLIC_SITE_URL ??
  "https://maw3ed.net"
).replace(/\/+$/, "");

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
