import { z } from "zod";

/** Input rules for the platform administrator's venue screens. */

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "الرابط حروف إنجليزية صغيرة وأرقام وشرطات");
const name = z.string().trim().min(2).max(120);
const optName = z.string().trim().max(120).optional().nullable().transform((v) => (v ? v : null));

export const organizationCreateSchema = z.object({
  slug,
  nameAr: name,
  nameEn: optName,
  website: z.string().trim().url().max(300).optional().nullable().or(z.literal("").transform(() => null)),
});

export const compoundCreateSchema = z.object({
  slug,
  nameAr: name,
  nameEn: optName,
  organizationId: z.string().min(1).nullable().optional(),
  cityId: z.string().min(1),
  neighborhoodId: z.string().min(1).nullable().optional(),
});

export const venueCreateSchema = z.object({
  slug,
  kind: z.enum(["MALL", "OFFICE_COMPLEX", "BUSINESS_PARK", "MIXED_USE", "COMMUNITY_CENTER", "OTHER"]).default("MALL"),
  nameAr: name,
  nameEn: optName,
  organizationId: z.string().min(1).nullable().optional(),
  compoundId: z.string().min(1).nullable().optional(),
  cityId: z.string().min(1).optional(),
  neighborhoodId: z.string().min(1).nullable().optional(),
});

export const venueAdminPatchSchema = z
  .object({
    status: z.enum(["DRAFT", "ACTIVE", "SUSPENDED"]),
    isPublished: z.boolean(),
    organizationId: z.string().min(1).nullable(),
    compoundId: z.string().min(1).nullable(),
  })
  .partial();

export const venueRoleGrantSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    kind: z.enum(["ORGANIZATION_ADMIN", "COMPOUND_ADMIN", "VENUE_MANAGER"]),
    organizationId: z.string().min(1).optional(),
    compoundId: z.string().min(1).optional(),
    venueId: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      (v.kind === "ORGANIZATION_ADMIN" && !!v.organizationId && !v.compoundId && !v.venueId) ||
      (v.kind === "COMPOUND_ADMIN" && !!v.compoundId && !v.organizationId && !v.venueId) ||
      (v.kind === "VENUE_MANAGER" && !!v.venueId && !v.organizationId && !v.compoundId),
    { message: "الدور لازم يكون على نطاق واحد مناسب له" },
  );
