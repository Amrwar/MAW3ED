import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const VALID_TYPES = ["GENERAL", "RESTAURANT", "BARBERSHOP"] as const;

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessType } = await req.json();
  if (!VALID_TYPES.includes(businessType)) {
    return NextResponse.json({ error: "نوع العمل غير صالح" }, { status: 400 });
  }

  const business = await db.business.update({
    where: { id: session.user.businessId },
    data:  { businessType },
    select: { businessType: true },
  });

  return NextResponse.json(business);
}
