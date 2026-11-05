/**
 * Maw3ed's own social accounts, for the "Follow us" icons.
 *
 * Each comes from its NEXT_PUBLIC_ variable and is shown only when set.
 * Only an http(s) address is used: the value lands in an href, and a
 * "javascript:" one would run when somebody clicked it.
 */
export interface SocialLinks {
  instagram: string | null;
  facebook: string | null;
}

export function webUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function socialLinks(): SocialLinks {
  return {
    instagram: webUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
    facebook: webUrl(process.env.NEXT_PUBLIC_FACEBOOK_URL),
  };
}
