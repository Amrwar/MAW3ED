import Constants from "expo-constants";
import { config } from "@/lib/config";

/**
 * Which build of the app this is.
 *
 * The same reasoning as the web's src/lib/version.ts, and it matters
 * more here: a phone keeps whatever version it last installed, so
 * "it's broken" from a user and "that's fixed" from you can easily be
 * about different builds. On the web you can at least force a reload.
 *
 * expo-constants reads these from app.config.ts at build time. The
 * runtime version is the one that changes with an over-the-air update,
 * so it is shown when present: it answers "which JavaScript is running"
 * where `version` only answers "which binary did you install".
 */

const version = Constants.expoConfig?.version ?? "0.0.0";
const runtime = Constants.expoConfig?.runtimeVersion;
const env = config.appEnv;



/**
 * "v0.1.0" in production, "v0.1.0 · staging" elsewhere.
 *
 * The environment is appended only when it is not production, so a
 * tester can tell at a glance which build they are holding and a real
 * user never sees a word that means nothing to them.
 */
export const VERSION_LABEL =
  env === "production"
    ? `v${version}`
    : `v${version} · ${env}${typeof runtime === "string" ? ` · ${runtime}` : ""}`;
