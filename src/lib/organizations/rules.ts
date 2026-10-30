import { z } from "zod";

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

export const ORG_KINDS = ["MALL", "COMPOUND", "BUSINESS_GROUP", "FRANCHISE", "COMMERCIAL_BUILDING", "OTHER"] as const;

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
    logoImage: z.string().url().max(500).nullable().optional(),
    coverImage: z.string().url().max(500).nullable().optional(),
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
  relation: z.enum(["OWNED", "FRANCHISE", "TENANT", "PARTNER"]).default("TENANT"),
  note: optText(500),
});

export const emailInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  relation: z.enum(["OWNED", "FRANCHISE", "TENANT", "PARTNER"]).default("OWNED"),
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
  action: z.enum(["approve", "reject", "remove", "organize"]),
  section: decisionText(60),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  relation: z.enum(["OWNED", "FRANCHISE", "TENANT", "PARTNER"]).optional(),
  note: decisionText(500),
});

/** How long an email invitation stays usable. */
export const INVITE_DAYS = 14;

export const DIRECTORY_PAGE_SIZE = 24;
