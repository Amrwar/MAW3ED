/**
 * Where a user is told to go when they need a human.
 *
 * This address was hardcoded in four places in i18n.ts — two contact
 * cards and two FAQ answers — which made it an invisible dependency:
 * the contact page and the FAQ promise a reply within 24 hours at a
 * mailbox nothing in the codebase mentions owning, and if it stops
 * being monitored there is no single place that says so.
 *
 * It lives here so the promise has exactly one definition, and is
 * overridable because a deployment that is not maw3ed.net — a fork, a
 * staging environment, a preview build — should not be directing
 * people at the production support inbox.
 *
 * NEXT_PUBLIC_ because the contact page and the FAQ are client
 * components; Next inlines it at build time, which is fine, since an
 * address printed on a public page is public by definition.
 *
 * Not a secret, and not required: the default is the real production
 * address, so an unconfigured deployment behaves exactly as before
 * rather than rendering an empty string where an email should be.
 */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@maw3ed.net";

/** `mailto:` form, for links rather than displayed text. */
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

/**
 * The business's own phone and address, as registered with Meta for the
 * WhatsApp Business account. Meta reviews the website against that
 * profile, so the contact page shows the same details.
 */
export const SUPPORT_PHONE = "+1 514 553 4360";
export const BUSINESS_ADDRESS = "1445 Rue du Fort, Montréal, QC H3H 2C3, Canada";
