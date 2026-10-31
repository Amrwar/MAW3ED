import QRCode from "qrcode";
import { siteUrl } from "@/lib/url";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle } from "@/lib/organizations/route";

/**
 * GET /api/organizations/:id/qr?format=svg|png
 *
 * The organization's public directory QR: a plain link to
 * /groups/<slug>?src=qr, for signs and print. Marketing, not a
 * credential — it proves nothing and admits nobody; scans are counted
 * as QR visits. High error correction, like the business QR, because
 * printed codes get scuffed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org qr GET", async () => {
    const { id } = await params;
    const { organization } = await requireOrgAccess(id, "org.view");
    const format = new URL(req.url).searchParams.get("format") === "png" ? "png" : "svg";
    const target = siteUrl(`/groups/${organization.slug}?src=qr`);
    const filename = `maw3ed-${organization.slug}-directory.${format}`;
    const options = { errorCorrectionLevel: "H" as const, margin: 2, width: 1024 };
    if (format === "png") {
      const png = await QRCode.toBuffer(target, { ...options, type: "png" });
      return new Response(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${filename}"` },
      });
    }
    const svg = await QRCode.toString(target, { ...options, type: "svg" });
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  });
}

