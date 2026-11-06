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
export const BUSINESS_ADDRESS = "508-1445 Rue du Fort, Montréal, QC H3H 2C3, Canada";

/**
 * Who legally operates Maw3ed. Shown in the site footer and on the privacy
 * and terms pages: required by law (the operator must be identifiable) and
 * by Meta business verification, which checks the business name is on the
 * website. Source: Québec enterprise register, NEQ 2282749953 (registered
 * 2026-11-05, sole proprietorship). In Québec a sole proprietorship's legal
 * name is its owner's; the business trades under its registered other
 * name, "Plateforme Maw3ed". The line names both, as the register does.
 */
export const OPERATOR_BUSINESS_NAME = "Plateforme Maw3ed";
export const OPERATOR_LEGAL_NAME = "Amr Hefny";
export const OPERATOR_LEGAL_NAME_AR = "عمرو حفني";
export const OPERATOR_NEQ = "2282749953";

export function operatorLine(lang: "ar" | "en"): string {
  return lang === "ar"
    ? `موعد (Maw3ed) تديرها ${OPERATOR_BUSINESS_NAME}، منشأة فردية مملوكة لـ${OPERATOR_LEGAL_NAME_AR} (${OPERATOR_LEGAL_NAME}) ومسجّلة في كيبك، كندا (رقم المنشأة NEQ ${OPERATOR_NEQ}).`
    : `Maw3ed is operated by ${OPERATOR_BUSINESS_NAME}, a sole proprietorship of ${OPERATOR_LEGAL_NAME} registered in Québec, Canada (NEQ ${OPERATOR_NEQ}).`;
}
