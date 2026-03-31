import { handlers } from "@/auth";
import type { NextRequest } from "next/server";

// Wrap NextAuth handlers to match Next.js 16 route handler signature
export function GET(req: NextRequest) {
  return handlers.GET(req);
}

export function POST(req: NextRequest) {
  return handlers.POST(req);
}
