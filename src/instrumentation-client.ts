import * as Sentry from "@sentry/nextjs";
import { sharedOptions } from "@/lib/sentry-shared";

/**
 * Browser runtime. Session replay is deliberately not enabled: it would
 * record Egyptian customers' names and phone numbers as they are typed
 * into the booking form, and the bundle cost matters on a mobile-first
 * audience.
 */
Sentry.init({
  ...sharedOptions,
  tracesSampleRate: 0.05,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
