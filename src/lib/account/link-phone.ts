import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { newHolderOf } from "@/lib/auth/login-code";

/**
 * Giving a signed-in account the phone its bookings are found by.
 *
 * Somebody who signs in with Google has an email and no phone, and the
 * customer area finds bookings by phone (lib/account/queries.ts). So
 * they are asked for the number, prove it with a WhatsApp code, and
 * this attaches it. Only ever called after verifyLoginCode() has
 * accepted that code: the caller controls the number.
 *
 * Three outcomes:
 *
 *   linked  nobody holds the number: it becomes this account's, with
 *           the history fence and the name a phone sign-in would have
 *           given a new account (newHolderOf).
 *
 *   merged  another account (P) holds it, and this one (G) is nothing
 *           but a Google sign-in: no password, no business, no staff
 *           seat, no venue role, no admin role, no app sessions. G's
 *           Google link moves to P and G is deleted, in one transaction;
 *           the browser then signs in with Google again and lands in P.
 *
 *           Why that is safe: the code just proved the caller holds the
 *           number, and a phone sign-in with that same code would have
 *           opened P outright (accountForVerifiedPhone). Moving the
 *           Google link gives them nothing that code did not; it only
 *           saves them a second account. Nothing of value goes with G,
 *           which is why every check above must pass: an account with
 *           any of those things is somebody's, and is never deleted to
 *           make room.
 *
 *   refused everything else, notably a number held by another account
 *           while this one is an owner, staff member or administrator.
 *           Two real accounts are not merged by a code.
 */

export type LinkPhoneResult =
  | { outcome: "linked" }
  | { outcome: "merged"; into: string }
  | { outcome: "refused"; reason: "taken" | "has-phone" | "gone" };

export async function linkVerifiedPhone(userId: string, phone: string): Promise<LinkPhoneResult> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, phone: true, phoneVerifiedAt: true },
  });
  if (!me) return { outcome: "refused", reason: "gone" };

  if (me.phoneVerifiedAt && me.phone === phone) return { outcome: "linked" };
  // Already a customer under another number. Changing the number would
  // move every booking the account shows, which is not what "add your
  // number" is for (the profile route keeps the phone fixed for the
  // same reason).
  if (me.phoneVerifiedAt && me.phone) return { outcome: "refused", reason: "has-phone" };

  for (let attempt = 0; attempt < 2; attempt++) {
    const holder = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (holder && holder.id !== me.id) return mergeInto(me.id, holder.id);

    const fresh = await newHolderOf(phone);
    try {
      await db.user.update({
        where: { id: me.id },
        data: {
          phone,
          phoneVerifiedAt: new Date(),
          historySince: fresh.historySince,
          ...(me.name ? {} : { name: fresh.name }),
        },
      });
      log.info("[account] phone linked", { userId: me.id });
      return { outcome: "linked" };
    } catch (e) {
      // Somebody signed in with the number between the read and the
      // write: look again, and this time it is held.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { outcome: "refused", reason: "taken" };
}

async function mergeInto(fromId: string, intoId: string): Promise<LinkPhoneResult> {
  return db.$transaction(async (tx) => {
    // Read inside the transaction, so nothing can be added to G between
    // deciding it is empty and deleting it.
    const from = await tx.user.findUnique({
      where: { id: fromId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        password: true,
        adminRole: true,
        isAdmin: true,
        business: { select: { id: true } },
        staffMember: { select: { id: true } },
        _count: { select: { venueRoles: true, mobileSessions: true, accounts: true } },
      },
    });
    if (!from) return { outcome: "refused", reason: "gone" } as const;
    if (!isOnlyASignIn(from)) return { outcome: "refused", reason: "taken" } as const;

    const into = await tx.user.findUnique({ where: { id: intoId }, select: { id: true, name: true, email: true } });
    if (!into) return { outcome: "refused", reason: "gone" } as const;

    await tx.account.updateMany({ where: { userId: from.id }, data: { userId: into.id } });

    // Places saved while signed in with Google come along; the rest of
    // G (an empty notification feed, an unfinished onboarding draft)
    // goes with it.
    const saved = await tx.favorite.findMany({ where: { userId: from.id }, select: { businessId: true } });
    if (saved.length > 0) {
      await tx.favorite.createMany({
        data: saved.map((f) => ({ userId: into.id, businessId: f.businessId })),
        skipDuplicates: true,
      });
    }

    // Deleted before P takes the address: email is unique.
    await tx.user.delete({ where: { id: from.id } });

    const takeEmail = !into.email && !!from.email;
    await tx.user.update({
      where: { id: into.id },
      data: {
        phoneVerifiedAt: new Date(),
        ...(takeEmail ? { email: from.email!.toLowerCase(), emailVerified: from.emailVerified ?? new Date() } : {}),
        ...(!into.name && from.name ? { name: from.name } : {}),
      },
    });

    log.info("[account] Google sign-in merged into the phone's account", { from: from.id, into: into.id });
    return { outcome: "merged", into: into.id } as const;
  });
}

/** True when an account holds nothing but its external sign-in. */
export function isOnlyASignIn(u: {
  password: string | null;
  adminRole: unknown;
  isAdmin: boolean;
  business: unknown;
  staffMember: unknown;
  _count: { venueRoles: number; mobileSessions: number; accounts: number };
}): boolean {
  return (
    !u.password &&
    !u.adminRole &&
    !u.isAdmin &&
    !u.business &&
    !u.staffMember &&
    u._count.venueRoles === 0 &&
    u._count.mobileSessions === 0 &&
    // Something to carry over: without a Google link there is no way
    // back in as P except the phone, and nothing to merge.
    u._count.accounts > 0
  );
}
