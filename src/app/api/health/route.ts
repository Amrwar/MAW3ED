import { timingSafeEqual } from "crypto";
import { healthReport, liveness } from "@/lib/ops/health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — for uptime monitors and alerting.
 *
 * Without credentials: { status } and 200, or 503 when the database does
 * not answer — enough for a monitor, nothing for anyone else. With
 * `Authorization: Bearer <CRON_SECRET>`: the full report (job freshness,
 * queue depths). Counts only, never personal data.
 */
function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!expected || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(req)) {
    // Anonymous: one cheap query. Anyone can poll this; the full report
    // (twenty-odd counts) is only for the holder of the cron secret.
    const live = await liveness();
    return Response.json({ status: live }, { status: live === "down" ? 503 : 200, headers });
  }
  const report = await healthReport();
  return Response.json({ ...report, at: new Date().toISOString() }, { status: report.status === "down" ? 503 : 200, headers });
}
