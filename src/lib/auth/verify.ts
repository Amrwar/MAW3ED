import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Checking an email and password, in one place.
 *
 * Lifted out of the NextAuth Credentials provider so the mobile login
 * route can ask the same question without a second copy of it. Two
 * implementations of "is this password right" is exactly the kind of
 * duplication that ends with one of them forgetting to check whether
 * the account has a password at all.
 *
 * Returns null for every failure — wrong email, wrong password, an
 * account that signs in by phone and has no password set. The caller
 * says "those credentials did not work" and nothing more specific,
 * because anything more specific tells an attacker which half to keep.
 */

export interface VerifiedUser {
  id: string;
  email: string | null;
  name: string | null;
  businessId: string | null;
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function verifyEmailPassword(
  credentials: unknown,
): Promise<VerifiedUser | null> {
  const parsed = schema.safeParse(credentials);
  if (!parsed.success) return null;

  // Case-insensitive, as an email address is.
  const user = await db.user.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" } },
    include: { business: { select: { id: true } } },
  });

  // No password means the account signs in another way; it is not an
  // invitation to skip the check.
  if (!user?.password) return null;

  const valid = await bcrypt.compare(parsed.data.password, user.password);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    businessId: user.business?.id ?? null,
  };
}
