/**
 * Where to send somebody after they sign in.
 *
 * Only ever a path on this site. "?next=" arrives in the URL, so without
 * this a link like /account-login?next=https://not-maw3ed.example would
 * walk a customer straight onto somebody else's page at the exact moment
 * they have just proved their phone number and trust what they are
 * looking at. The cases that have to be refused:
 *
 *   - an absolute URL, "https://elsewhere.example";
 *   - a protocol-relative one, "//elsewhere.example", which a browser
 *     treats as absolute even though it starts with a slash;
 *   - the backslash variants, which browsers normalise to slashes;
 *   - a scheme with no slashes at all, "javascript:…" or "mailto:…".
 *
 * Anything that is not a plain same-site path becomes the account home,
 * which is always a safe place to land.
 */
export function safeNext(raw: string | null | undefined): string {
  const HOME = "/account";
  if (!raw) return HOME;

  // A browser ignores control characters and whitespace when resolving a
  // URL, so "/\tevil.example" and "java\nscript:…" have to be judged by
  // what is left once they are gone.
  const cleaned = raw.replace(/[\u0000- \u007f]/g, "");
  if (!cleaned) return HOME;

  // Backslashes read as slashes, so normalise before deciding the shape.
  const probe = cleaned.replace(/\\/g, "/");

  if (!probe.startsWith("/")) return HOME;
  if (probe.startsWith("//")) return HOME;

  return probe;
}
