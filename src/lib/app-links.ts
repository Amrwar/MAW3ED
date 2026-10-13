/**
 * The files that let a maw3ed.net link open the app.
 *
 * iOS fetches /.well-known/apple-app-site-association and Android
 * /.well-known/assetlinks.json from the domain when the app is
 * installed; only if the file names the app does tapping a link open it
 * rather than the browser. Built here, from the environment, because
 * the two identifiers in them — the Apple team and the Android signing
 * certificate — exist only once the app is set up with Apple and Google.
 *
 * Production app only. Staging and development builds have their own
 * bundle ids (see mobile/app.config.ts) and open links through the
 * maw3ed:// scheme instead, so a tester's phone never claims real
 * customers' links.
 */

export const APP_ID = "net.maw3ed.app";

/**
 * The paths the app handles. The rest of the site stays in the browser:
 * a link to /pricing or /dashboard should not throw somebody into an
 * app with nothing to show for it. Matches the Android intent filters
 * in mobile/app.config.ts.
 */
export const APP_LINK_PATHS = ["/company/*", "/booking/*"] as const;

export function appleAppSiteAssociation(teamId: string | undefined) {
  const team = teamId?.trim();
  if (!team) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [`${team}.${APP_ID}`],
          components: APP_LINK_PATHS.map((path) => ({ "/": path })),
        },
      ],
    },
  };
}

export function androidAssetLinks(fingerprints: string | undefined) {
  const certs = (fingerprints ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  if (certs.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: APP_ID,
        sha256_cert_fingerprints: certs,
      },
    },
  ];
}
