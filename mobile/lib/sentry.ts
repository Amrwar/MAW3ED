import type { ComponentType } from "react";
import { Platform } from "react-native";
import * as Sentry from "@sentry/react-native";
import { config } from "@/lib/config";
import { scrubBreadcrumb, scrubEvent } from "@/lib/scrub";

/**
 * Crash reporting.
 *
 * Off unless the build has a DSN (EXPO_PUBLIC_SENTRY_DSN, an EAS
 * environment variable — a DSN is public, it only lets you *send*), and
 * off in development, where the red screen already says what broke.
 * Off on web too: the web preview is a development aid, and the website
 * has its own reporting.
 *
 * No personal data: sendDefaultPii is off, and every event and
 * breadcrumb goes through lib/scrub.ts, which drops request bodies and
 * headers and redacts phone numbers and booking tokens.
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;

export const sentryEnabled = Boolean(dsn) && config.appEnv !== "development" && Platform.OS !== "web";

export function initSentry(): void {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn,
    enabled: sentryEnabled,
    environment: config.appEnv,
    // Release and dist are left to the SDK, which reads them from the
    // native app: the same names the build plugin uploads source maps
    // and debug files under. A hand-made name here would not match.
    sendDefaultPii: false,
    // No performance tracing: transactions skip beforeSend, and their
    // http spans carry request URLs, booking tokens included. Errors
    // only, until spans are scrubbed too.
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });
}

/** Reports an error caught somewhere Sentry's global handlers cannot see. */
export function reportError(error: unknown): void {
  if (!sentryEnabled) return;
  Sentry.captureException(error);
}

/** Sentry's root wrapper on native when enabled; the component unchanged otherwise. */
export function withSentry(Component: ComponentType<Record<string, unknown>>): ComponentType<Record<string, unknown>> {
  return sentryEnabled ? Sentry.wrap(Component) : Component;
}
