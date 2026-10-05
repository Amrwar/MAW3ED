/**
 * Turning a stored phone number into a link a device will act on.
 *
 * Owners type numbers the way people write them — "0111 1908224",
 * "+20 111 190 8224", "011-119-08224". A tel: URI with a space in it is
 * not a valid URI, and some dialers drop everything after the space, so
 * the number has to be cleaned before it goes in an href rather than
 * displayed as typed.
 */

/** Keeps the digits and a leading +, which is all a dialer needs. */
export function telHref(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  // A + is only meaningful at the front; anything later is a typo.
  const normalised = cleaned.startsWith("+")
    ? "+" + cleaned.slice(1).replace(/\+/g, "")
    : cleaned.replace(/\+/g, "");
  return `tel:${normalised}`;
}

/**
 * wa.me wants digits only, in international form with no plus.
 *
 * Egyptian mobiles are written locally as 01XXXXXXXXX; WhatsApp needs
 * 201XXXXXXXXX. Dropping the leading zero without adding the country
 * code produces a link that silently opens a chat with nobody.
 */
export function whatsappHref(raw: string, countryCode = "20"): string {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = countryCode + digits.slice(1);
  else if (!digits.startsWith(countryCode)) digits = countryCode + digits;

  return `https://wa.me/${digits}`;
}
