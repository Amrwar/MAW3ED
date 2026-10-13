import Constants from "expo-constants";
import { z } from "zod";

/**
 * The build's configuration, read once and checked.
 *
 * Everything here comes from app.config.ts `extra`, which is compiled
 * into the binary — so it is public by definition and holds addresses
 * and identifiers, never a secret. Read through this module rather than
 * from expo-constants directly, so a missing or malformed value is
 * reported once, by name, instead of surfacing as a confusing failure
 * on whichever screen first needs it.
 */

const schema = z.object({
  appEnv: z.enum(["development", "staging", "production"]),
  apiUrl: z.string().url(),
  // Optional, and only ever used when it is a string. Its shape is not
  // ours to rely on — the web build hands over an object where native
  // has null — and an optional id must never stop the app from starting.
  eas: z.object({ projectId: z.unknown() }).partial().passthrough().optional(),
});

export type AppConfig = {
  appEnv: "development" | "staging" | "production";
  apiUrl: string;
  /** Needed for an Expo push token. null until `eas init` has run. */
  easProjectId: string | null;
};

export function parseConfig(extra: unknown): AppConfig {
  const parsed = schema.safeParse(extra);
  if (!parsed.success) {
    // Loud and early: an app pointed at nowhere fails on every screen
    // with a different symptom; this names the cause once.
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`[config] invalid app config — ${detail}`);
  }
  return {
    appEnv: parsed.data.appEnv,
    apiUrl: parsed.data.apiUrl.replace(/\/$/, ""),
    easProjectId: typeof parsed.data.eas?.projectId === "string" ? parsed.data.eas.projectId : null,
  };
}

export const config: AppConfig = parseConfig(Constants.expoConfig?.extra);
