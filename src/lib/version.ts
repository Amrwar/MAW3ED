/**
 * Which build this is.
 *
 * There was no way to tell. Asked "where can I see the app version",
 * the honest answer was nowhere — not in the UI, not in a header, not
 * in an endpoint. That matters the first time somebody reports a bug
 * that is already fixed, or says a deploy "didn't work": without a
 * version you are guessing whether they are even looking at the build
 * you think they are.
 *
 * Two parts, because they answer different questions. The version says
 * which release this is meant to be, and comes from package.json. The
 * commit says which code is actually running, and comes from Vercel,
 * which sets VERCEL_GIT_COMMIT_SHA on every deployment.
 *
 * NEXT_PUBLIC_ on both: a version string is not a secret, and the
 * footer that shows it is a client component. The short SHA tells
 * somebody which public commit is deployed, which is already visible
 * in the repository.
 */

/** From package.json at build time. Falls back rather than showing "undefined". */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

/**
 * Seven characters of the deployed commit, or null when unknown —
 * a local `npm run build`, where there is no Vercel to tell us.
 */
export const APP_COMMIT =
  process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7) || null;

/**
 * What to print. "v0.1.0 · a1b2c3d" when the commit is known, just
 * "v0.1.0" when it is not, so a local build does not show a stray
 * separator with nothing after it.
 */
export const VERSION_LABEL = APP_COMMIT
  ? `v${APP_VERSION} · ${APP_COMMIT}`
  : `v${APP_VERSION}`;
