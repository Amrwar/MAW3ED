import * as Sentry from "@sentry/nextjs";
import { addSink } from "@/lib/logger";
import { SENTRY_ENABLED } from "@/lib/sentry-shared";

/**
 * Runs once per server/edge runtime at startup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  if (!SENTRY_ENABLED) return;

  // The whole reason the logger takes sinks: every error already routes
  // through `log`, so forwarding them is one subscription rather than an
  // edit to 32 route handlers. Records arrive already redacted.
  addSink((record) => {
    if (record.level !== "error" && record.level !== "warn") return;

    Sentry.withScope((scope) => {
      scope.setLevel(record.level === "error" ? "error" : "warning");
      scope.setExtras(record.fields);

      if (record.error instanceof Error) {
        Sentry.captureException(record.error);
      } else if (record.error) {
        Sentry.captureException(new Error(`${record.message}: ${JSON.stringify(record.error)}`));
      } else {
        Sentry.captureMessage(record.message);
      }
    });
  });
}

/** Surfaces errors thrown inside server components and route handlers. */
export const onRequestError = Sentry.captureRequestError;
