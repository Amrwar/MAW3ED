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
});

/**
 * NextAuth v5 accepts AUTH_SECRET or the v4 name NEXTAUTH_SECRET, and
 * this project was set up with the latter. Requiring only the new name
 * is what failed the Vercel build: the secret was present all along,
 * under the name NextAuth still supports.
 */
const authSecret = z
  .object({
    AUTH_SECRET: z.string().min(16).optional(),
    NEXTAUTH_SECRET: z.string().min(16).optional(),
  })
  .refine((v) => Boolean(v.AUTH_SECRET || v.NEXTAUTH_SECRET), {
    message:
      "AUTH_SECRET (or NEXTAUTH_SECRET) is required and must be at least 16 characters",
    path: ["AUTH_SECRET"],
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

  // The address the contact page and FAQ send users to. Declared here
  // so the audit of what this deployment depends on is complete; the
  // value itself is read in src/lib/support.ts, which the client
  // bundle can import.
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().optional(),

  // Payments (Paymob)
  PAYMOB_API_KEY: z.string().optional(),
  PAYMOB_HMAC_SECRET: z.string().optional(),
  PAYMOB_IFRAME_ID: z.string().optional(),
  PAYMOB_INTEGRATION_ID: z.string().optional(),

  // Push (Expo). Optional: with "enhanced push security" on in the Expo
  // dashboard, Expo refuses pushes that do not carry this token.
  EXPO_ACCESS_TOKEN: z.string().optional(),

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

  // SMS. No gateway is configured; the channel reports
  // "sms-not-configured" and the ledger says so, rather than pretending
  // a message went out. Wiring one is the single send() in
  // notifications/channels.ts.
  SMS_API_URL: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),

  // App links. Served at /.well-known so a maw3ed.net link opens the
  // app rather than the browser. Unset: those files answer 404 and
  // links open in the browser, which is the correct fallback.
  // The Apple developer team that signs the iOS app (10 characters).
  APPLE_TEAM_ID: z.string().optional(),
  // SHA-256 fingerprints of the Android signing certificate(s),
  // comma-separated, as `eas credentials` prints them.
  ANDROID_CERT_SHA256: z.string().optional(),

  // Error tracking. Empty leaves Sentry inert: no events, and the build
  // wrapper is a no-op. The DSN identifies a project and is safe in a
  // browser; the auth token uploads source maps and is not.
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // The bare domain shown in copy and used for canonical links.
  // NEXT_PUBLIC_ because a client component prints it; a domain name
  // is not a secret.
  NEXT_PUBLIC_SITE_HOST: z.string().optional(),

  // The number the contact page offers. Unset hides the card rather
  // than showing one with nothing behind it.
  NEXT_PUBLIC_SUPPORT_WHATSAPP: z.string().optional(),
});

const schema = required.merge(optional).and(authSecret);

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
  /** No gateway is wired; the channel is dormant, not broken. */
  sms: boolean;
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
    sms: has("SMS_API_URL") && has("SMS_API_KEY"),
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

/** The signing secret, under whichever name it is configured. */
export function getAuthSecret(): string {
  const e = getEnv();
  return e.AUTH_SECRET ?? e.NEXTAUTH_SECRET ?? "";
}

export const isProduction = process.env.NODE_ENV === "production";
export const isTest = process.env.NODE_ENV === "test";
