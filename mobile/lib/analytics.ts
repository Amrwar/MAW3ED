import { config } from "@/lib/config";

/**
 * Product analytics, as an interface rather than a vendor.
 *
 * The app reports what happened — a screen seen, a sign-in, a booking —
 * through `track` and `screen`, and a sink decides where it goes. No
 * sink is installed yet: choosing a provider is a product and privacy
 * decision, not a foundation one, and adding its SDK means one
 * `setAnalyticsSink` call rather than a change in every screen.
 *
 * Never put personal data in properties — no names, phones, emails or
 * tokens. Ids of things (a business slug, a booking reference) are fine.
 */

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsSink {
  track(event: string, props?: AnalyticsProps): void;
  screen(path: string): void;
}

/** In development, events are printed so they can be checked by eye. */
const devSink: AnalyticsSink = {
  track: (event, props) => console.log(`[analytics] ${event}`, props ?? ""),
  screen: (path) => console.log(`[analytics] screen ${path}`),
};

const noopSink: AnalyticsSink = { track: () => undefined, screen: () => undefined };

let sink: AnalyticsSink = config.appEnv === "development" ? devSink : noopSink;

export function setAnalyticsSink(next: AnalyticsSink) {
  sink = next;
}

/** Fire and forget. A broken sink must never break the app. */
export function track(event: string, props?: AnalyticsProps) {
  try {
    sink.track(event, props);
  } catch {
    /* swallow */
  }
}

export function screen(path: string) {
  try {
    sink.screen(path);
  } catch {
    /* swallow */
  }
}
