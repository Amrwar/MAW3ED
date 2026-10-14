import type { ComponentType } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
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
 * headers and redacts anything that looks like a phone number.
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;
const version = Constants.expoConfig?.version ?? "0.0.0";
const runtime = Constants.expoConfig?.runtimeVersion;

export const sentryEnabled = Boolean(dsn) && config.appEnv !== "development" && Platform.OS !== "web";

export function initSentry(): void {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn,
    enabled: sentryEnabled,
    environment: config.appEnv,
    release: `maw3ed-mobile@${version}`,
    ...(typeof runtime === "string" ? { dist: runtime } : {}),
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
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
