import QRCode from "qrcode";
import { requireBusiness, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { siteUrl } from "@/lib/url";
import { SRC_PARAM, type LinkableSource, LINKABLE_SOURCES } from "@/lib/attribution/source";

/**
 * GET /api/business/qr?src=qr&format=svg
 *
 * A QR code for this business's public booking page, as a file the
 * owner can put on a card, a window or a receipt.
 *
 * SVG by default, because this gets printed: a vector stays sharp at
 * whatever size it ends up, and a PNG scaled up on a shopfront sticker
 * is the kind of thing nobody notices until it is already printed.
 *
 * The code always carries a source, so a scan is attributable — a
 * printed code defaults to src=qr, and a business that wants a separate
 * one for its Instagram bio can ask for that channel instead.
 *
 * Error correction is set high rather than default. A sticker in a
 * barbershop gets scuffed, and H survives about 30% of the code being
 * damaged; L does not survive a thumbprint.
 */
export async function GET(req: Request) {
  try {
    const { business } = await requireBusiness();

    const url = new URL(req.url);
    const raw = (url.searchParams.get("src") ?? "qr").toLowerCase();
    const source =
      (LINKABLE_SOURCES.find((s) => SRC_PARAM[s] === raw) as LinkableSource | undefined) ?? "QR";
    const format = url.searchParams.get("format") === "png" ? "png" : "svg";

    const target = siteUrl(`/company/${business.slug}?src=${SRC_PARAM[source]}`);
    const filename = `maw3ed-${business.slug}-${SRC_PARAM[source]}.${format}`;

    const options = {
      errorCorrectionLevel: "H" as const,
      margin: 2,
      width: 1024,
      color: { dark: "#0A5F47", light: "#FFFFFF" },
    };

    if (format === "png") {
      const buffer = await QRCode.toBuffer(target, { ...options, type: "png" });
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const svg = await QRCode.toString(target, { ...options, type: "svg" });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business qr]", e);
    return err("تعذّر إنشاء الكود", 500);
  }
}
