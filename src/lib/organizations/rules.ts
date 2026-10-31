import { z } from "zod";
import { IMAGE_HOSTS } from "@/lib/security/csp";

/** Input rules for organizations. */

/** Public URL namespaces and words that would collide or confuse. */
export const RESERVED_ORG_SLUGS = new Set([
  "new", "register", "admin", "api", "maw3ed", "official", "support", "help",
  "venues", "groups", "dashboard", "login", "signup", "app",
]);

export const orgSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "الرابط قصير جدًا")
  .max(60, "الرابط طويل جدًا")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "الرابط حروف إنجليزية صغيرة وأرقام وشرطات")
  .refine((s) => !RESERVED_ORG_SLUGS.has(s), "الرابط ده محجوز");

const name = z.string().trim().min(2).max(120);
/**
 * An uploaded image: https on a host the page's CSP will actually show.
 * Anything else would render as a broken image at best and, through the
 * Open Graph tags, hand crawlers a URL of the registrant's choosing.
 */
function isOurUpload(u: string): boolean {
  // In production this is our own Cloudinary cloud's upload path — not
  // any account's, which would still be a URL of the registrant's
  // choosing. Without Cloudinary configured (local development), any
  // image host the CSP allows.
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloud) return u.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`);
  return IMAGE_HOSTS.some((h) => u.startsWith(`${h}/`));
}

const imageUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((u) => isOurUpload(u), "الصورة لازم تكون مرفوعة على موعد")
  .nullable()
  .optional();
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const webUrl = z
  .string()
  .trim()
  .url()
  .max(300)
  .refine((u) => /^https?:\/\//i.test(u), "الرابط لازم يبدأ بـ http أو https")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const ORG_KINDS = [
  "MALL", "COMPOUND", "BUSINESS_GROUP", "RESTAURANT_GROUP", "CLINIC_GROUP", "FRANCHISE", "COMMERCIAL_BUILDING", "OTHER",
] as const;

/**
 * New rows take one of the three relationship types. The labels used
 * before relationship semantics are still accepted from older clients
 * and mean what the migration made of stored rows: TENANT and PARTNER
 * are hosted, FRANCHISE is managed.
 */
const LEGACY_RELATION: Record<string, string> = { TENANT: "HOSTED", PARTNER: "HOSTED", FRANCHISE: "MANAGED" };
const relationship = z.preprocess(
  (v) => (typeof v === "string" && v in LEGACY_RELATION ? LEGACY_RELATION[v] : v),
  z.enum(["OWNED", "HOSTED", "MANAGED"]),
);
const scopeList = z.array(z.enum(["RESERVATIONS", "CUSTOMERS", "SERVICES", "STAFF", "SCHEDULES", "PROFILE", "REPORTS", "FINANCE"])).max(8);
/** A grant's end: a future instant, or null for "until revoked". */
const grantExpiry = z
  .string()
  .datetime({ offset: true })
  .refine((v) => new Date(v).getTime() > Date.now(), "تاريخ الانتهاء لازم يكون في المستقبل")
  .transform((v) => new Date(v))
  .nullable()
  .optional();

export const orgRegisterSchema = z.object({
  slug: orgSlugSchema,
  kind: z.enum(ORG_KINDS),
  nameAr: name,
  nameEn: optText(120),
});

export const orgProfileSchema = z
  .object({
    nameAr: name,
    nameEn: optText(120),
    kind: z.enum(ORG_KINDS),
    descriptionAr: optText(2000),
    descriptionEn: optText(2000),
    logoImage: imageUrl,
    coverImage: imageUrl,
    phone: optText(30),
    email: z.string().trim().toLowerCase().email().max(200).optional().nullable().or(z.literal("").transform(() => null)),
    instagram: optText(100),
    facebook: optText(100),
    address: optText(300),
    cityId: z.string().min(1).nullable().optional(),
    website: webUrl,
  })
  .partial();

export const inviteBusinessSchema = z.object({
  /** The business's public slug, exactly as its page shows it. */
  businessSlug: z.string().trim().toLowerCase().min(3).max(60),
  branchId: z.string().min(1).nullable().optional(),
  relation: relationship.default("HOSTED"),
  /** What the organization asks to operate (OWNED/MANAGED). The business decides. */
  requestedScopes: scopeList.default([]),
  note: optText(500),
});

export const emailInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  relation: relationship.default("OWNED"),
  requestedScopes: scopeList.default([]),
});

/** The business owner's side: answer, pause, resume, leave, or change grants. */
export const businessResponseSchema = z.object({
  action: z.enum(["accept", "decline", "leave", "suspend", "resume", "grant"]),
  scopes: scopeList.optional(),
  expiresAt: grantExpiry,
});

/** A business asking to join, with what it grants up front. */
export const joinRequestSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().min(1).nullable().optional(),
  relation: relationship.default("HOSTED"),
  scopes: scopeList.default([]),
  expiresAt: grantExpiry,
});

/**
 * Optional text that stays absent when the key is absent. zod runs the
 * transform on an omitted key too, so plain optText would turn "not
 * sent" into null — and a decision that merely omitted `section` would
 * wipe the stored one.
 */
const decisionText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => (v === undefined ? undefined : v ? v : null));

export const associationDecisionSchema = z.object({
  action: z.enum(["approve", "reject", "remove", "organize", "suspend", "resume"]),
  section: decisionText(60),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  note: decisionText(500),
});

/** How many associations one console page lists. */
export const ASSOCIATIONS_PAGE_SIZE = 50;

/** How long an email invitation stays usable. */
export const INVITE_DAYS = 14;

export const DIRECTORY_PAGE_SIZE = 24;
