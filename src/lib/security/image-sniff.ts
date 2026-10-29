/**
 * What an uploaded file actually is, from its first bytes.
 *
 * The Content-Type a browser sends with a file is whatever the client
 * said it was; a script can label anything "image/png". The bytes
 * cannot lie about the format they are in, so an upload is accepted
 * only when its declared type and its magic number agree.
 */
export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Where an upload may land. The client names a folder so the owner's
 * media is grouped; it may not name any other, or a path outside the
 * account's area of the media store.
 */
export const UPLOAD_FOLDERS = new Set(["maw3ed/businesses", "maw3ed/services", "maw3ed/staff", "maw3ed/reviews", "maw3ed/resources"]);
