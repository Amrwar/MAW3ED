/** The cookie the language switch writes: the visitor's saved choice. */
export const LANG_COOKIE = "maw3ed-lang";

/** How long the choice is kept: a year, in seconds. */
export const LANG_COOKIE_MAX_AGE = 31536000;

/**
 * The request header carrying the language the proxy resolved for this
 * request (src/proxy.ts). Set on every request, so it is never one the
 * client sent.
 */
export const LANG_HEADER = "x-maw3ed-lang";
