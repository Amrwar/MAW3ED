import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { log } from "@/lib/logger";

const schema = z.object({
  /** An Expo push token: ExponentPushToken[…] or ExpoPushToken[…]. */
  token: z.string().trim().min(10).max(255),
  platform: z.enum(["ios", "android"]),
});

/**
 * POST /api/mobile/devices
 *
 * Register this device for push, or refresh its registration.
 *
 * Upserted on the token, which is unique: a device that reinstalls or
 * reopens the app re-registers the same token and updates its row
 * rather than adding a second one and being sent to twice.
 *
 * The token moving to a different account is a real case — a shared
 * phone, or somebody signing out and a colleague signing in — so the
 * row's userId is reassigned rather than the write being refused.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("طلب غير صالح", 422);

    await db.deviceToken.upsert({
      where: { token: parsed.data.token },
      create: {
        token: parsed.data.token,
        platform: parsed.data.platform,
        userId: session.user.id,
      },
      update: {
        userId: session.user.id,
        platform: parsed.data.platform,
        lastSeenAt: new Date(),
        // A token that comes back was not dead after all.
        disabledAt: null,
      },
    });

    return ok({ registered: true });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[device register]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/**
 * DELETE /api/mobile/devices
 *
 * Stop sending push to this device. Called on sign-out, so the next
 * person to use the phone does not receive somebody else's bookings.
 */
export async function DELETE(req: Request) {
  try {
    const session = await requireSession();

    const parsed = z
      .object({ token: z.string().trim().min(10).max(255) })
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("طلب غير صالح", 422);

    await db.deviceToken.deleteMany({
      where: { token: parsed.data.token, userId: session.user.id },
    });

    return ok({ removed: true });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[device remove]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
