/**
 * Saves a QR code (an SVG made on our server) as a PNG the customer keeps
 * outside the browser — their photos, files or a chat — so it can be shown
 * with no connection at all.
 *
 * Drawn in the browser from the SVG already on the page, so it works
 * offline too. Phones get the share sheet (where "Save image" puts it in
 * the photos); elsewhere the file downloads. The picture is made ahead of
 * the tap (buildQrPng), because a share sheet must open straight from the
 * tap: Safari refuses one that follows slow work. Browser only.
 */

export type SaveResult = "shared" | "downloaded" | "cancelled" | "failed";

const QR_PX = 720;
const PAD = 48;
const LINE_PX = 40;

/** The SVG with explicit pixel size: some browsers draw a size-less SVG at 0×0. */
export function sizedSvg(svg: string, px = QR_PX): string {
  return svg.replace(/<svg\b([^>]*)>/, (whole, attrs: string) => {
    const clean = attrs.replace(/\s(width|height)="[^"]*"/g, "");
    return `<svg${clean} width="${px}" height="${px}">`;
  });
}

/** The QR on white, with caption lines under it (business, day, times, number). */
export async function buildQrPng(svg: string, caption: string[] = []): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([sizedSvg(svg)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("qr image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = QR_PX + 2 * PAD;
    canvas.height = QR_PX + 2 * PAD + caption.length * LINE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    // White all round: a code on a dark photo background will not scan.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, PAD, PAD, QR_PX, QR_PX);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    caption.forEach((line, i) => {
      // Arabic lines read right to left; the rest (numbers, times) left to right.
      ctx.direction = /\p{Script=Arabic}/u.test(line) ? "rtl" : "ltr";
      ctx.fillText(line, canvas.width / 2, QR_PX + PAD + 8 + (i + 1) * LINE_PX - 12, canvas.width - 2 * PAD);
    });
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Hands a ready picture to the share sheet, or downloads it. Call straight from the tap. */
export async function deliverQrImage(blob: Blob, fileName: string): Promise<SaveResult> {
  const file = new File([blob], fileName, { type: "image/png" });
  // Phones: the share sheet saves to photos. A refusal to share (desktop
  // browsers, older phones) falls through to a download.
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Long enough for the browser to start the download.
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return "downloaded";
  } catch {
    return "failed";
  }
}

/** Builds and delivers in one go, for when no picture was made ahead. */
export async function saveQrImage(svg: string, opts: { fileName: string; caption?: string[] }): Promise<SaveResult> {
  try {
    return await deliverQrImage(await buildQrPng(svg, opts.caption ?? []), opts.fileName);
  } catch {
    return "failed";
  }
}
