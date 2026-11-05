import { NextResponse } from "next/server";
import { err, requireBusiness } from "@/lib/api";
import { db } from "@/lib/db";

const VALID_TYPES = ["GENERAL", "RESTAURANT", "BARBERSHOP"] as const;

export async function PUT(req: Request) {
  try {
    // requireBusiness: accepts the app's bearer token, which auth()
    // refused, and re-checks ownership against the database rather
    // than trusting an id carried in a long-lived token.
    const { business: owned } = await requireBusiness();

  const { businessType } = await req.json();
  if (!VALID_TYPES.includes(businessType)) {
    return err("نوع العمل غير صالح", 400);
  }

  const business = await db.business.update({
    where: { id: owned.id },
    data:  { businessType },
    select: { businessType: true },
  });

    return NextResponse.json(business);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
