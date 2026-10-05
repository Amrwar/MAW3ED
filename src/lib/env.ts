import { z } from "zod";

/**
 * Environment validation.
 *
 * The app reads 22 environment variables across ~12 files, mostly as
 * `process.env.X ?? "some-fallback"`. That meant a missing or
 * misspelled variable surfaced as a confusing runtime failure deep in
 * a request rather than as a clear error.
 *
 * Validation is LAZY, and that is deliberate. Next's build imports
 * every route module to collect page data, so validating at module
 * scope made the production build depend on runtime secrets being
 * present at build time — a missing AUTH_SECRET failed the build
 * rather than the request. Nothing here throws until something
 * actually reads a required value, which only happens at runtime.
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

let cached: Env | null = null;

/**
 * Validates and returns the environment. Throws on the first call if a
 * required variable is missing, naming every problem at once.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const result = schema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${lines}`);
  }

  cached = result.data;
  return cached;
}

/**
 * Reads like a plain object but validates on first property access, so
 * importing this module is free and a build never touches secrets.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, key: string) {
    return getEnv()[key as keyof Env];
  },
  has(_target, key: string) {
    return key in getEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(getEnv());
  },
  getOwnPropertyDescriptor(_target, key) {
    return { value: getEnv()[key as keyof Env], enumerable: true, configurable: true };
  },
});

/**
 * Explicit startup check. Call from somewhere that runs at request
 * time if you want to fail loudly and early; nothing calls it during
 * the build.
 */
export function assertEnv(): void {
  getEnv();
}

/* ─── Integration readiness ──────────────────────────────── */

export interface Integrations {
  email: boolean;
  payments: boolean;
  whatsapp: boolean;
  uploads: boolean;
}

/**
 * True only when every variable the integration needs is present, so a
 * half-configured integration is caught before it fails on first use.
 *
 * Reads process.env directly rather than the validated object: whether
 * an optional integration is wired is a question worth answering even
 * when a required variable is missing.
 */
export function getIntegrations(): Integrations {
  const has = (k: string) => Boolean(process.env[k]);
  return {
    email: has("RESEND_API_KEY") && has("EMAIL_FROM"),
    payments:
      has("PAYMOB_API_KEY") &&
      has("PAYMOB_HMAC_SECRET") &&
      has("PAYMOB_IFRAME_ID") &&
      has("PAYMOB_INTEGRATION_ID"),
    whatsapp: has("WHATSAPP_ACCESS_TOKEN") && has("WHATSAPP_PHONE_NUMBER_ID"),
    uploads:
      has("CLOUDINARY_CLOUD_NAME") &&
      has("CLOUDINARY_API_KEY") &&
      has("CLOUDINARY_API_SECRET"),
  };
}

/* ─── Public origin ──────────────────────────────────────── */

/**
 * The public origin, without a trailing slash.
 *
 * Canonical URLs, the sitemap, robots.txt, JSON-LD, referral links and
 * password-reset emails all derive from this, so one resolution order
 * is defined here instead of each caller inventing its own fallback.
 *
 * Deliberately reads process.env directly and never validates: it is
 * needed at build time to generate the sitemap and canonical tags, and
 * must not drag secret validation into the build.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://maw3ed.net";
  return raw.replace(/\/+$/, "");
}

/**
 * Convenience binding for the common case. Evaluated at module load,
 * which is safe because it touches no secrets.
 */
export const siteUrl: string = getSiteUrl();

export const isProduction = process.env.NODE_ENV === "production";
export const isTest = process.env.NODE_ENV === "test";
