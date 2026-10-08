import { APP_VERSION, APP_COMMIT } from "@/lib/version";

/**
 * GET /api/version
 *
 * Which build is answering. Public, because none of it is secret: the
 * version is in package.json and the commit is in a public repository.
 *
 * It exists because verifying a deploy otherwise means guessing. After
 * the last release I confirmed the new code was live by checking
 * whether a response carried a Content-Security-Policy header — which
 * worked, but only because that release happened to add one. This
 * answers the question directly, and keeps answering it.
 *
 * Deliberately says nothing about the environment's contents: no
 * integration health, no configuration, no counts. Those belong behind
 * the admin guard. This is only "which code is this".
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      version: APP_VERSION,
      commit: APP_COMMIT,
      // So a reader can tell a cached answer from a fresh one.
      at: new Date().toISOString(),
    },
    {
      // Never cached: a cached version endpoint reports the previous
      // deployment, which is worse than having none at all.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
