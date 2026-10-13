import { appleAppSiteAssociation } from "@/lib/app-links";

/**
 * Served without an extension and as JSON, which is what iOS requires.
 * 404 until APPLE_TEAM_ID is set — links then open in Safari.
 */
export function GET() {
  const body = appleAppSiteAssociation(process.env.APPLE_TEAM_ID);
  if (!body) return new Response(null, { status: 404 });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
