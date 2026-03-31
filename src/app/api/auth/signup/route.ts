import { db } from "@/lib/db";
import { signUpSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = signUpSchema.safeParse(body);

    if (!parsed.success) {
      return err(parsed.error.issues[0].message, 422);
    }

    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return err("هذا البريد الإلكتروني مسجل بالفعل", 409);
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: { name, email, password: hashed },
      select: { id: true, email: true, name: true },
    });

    return ok({ user }, 201);
  } catch (e) {
    console.error("[signup]", e);
    return err("حدث خطأ أثناء إنشاء الحساب", 500);
  }
}
