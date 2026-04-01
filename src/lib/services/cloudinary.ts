import crypto from "crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY    = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

/**
 * Upload a raw image buffer to Cloudinary using the signed upload API.
 * Returns the secure HTTPS URL of the uploaded image.
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  filename: string,
  folder: string,
): Promise<string> {
  const timestamp     = Math.round(Date.now() / 1000).toString();
  const paramsToSign  = `folder=${folder}&timestamp=${timestamp}`;
  const signature     = crypto
    .createHash("sha256")
    .update(paramsToSign + API_SECRET)
    .digest("hex");

  const form = new FormData();
  form.append("file",      new Blob([buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)]), filename);
  form.append("api_key",   API_KEY);
  form.append("timestamp", timestamp);
  form.append("folder",    folder);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed (${res.status}): ${detail}`);
  }

  const json = await res.json();
  return json.secure_url as string;
}
