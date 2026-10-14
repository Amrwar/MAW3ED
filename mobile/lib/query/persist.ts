import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";
import { VERSION_LABEL } from "@/constants/version";

/**
 * What survives the app being closed: the public catalogue, and nothing
 * else.
 *
 * Measured before: every cold start showed skeletons until five
 * discovery requests came back, and offline there was nothing to show
 * at all. Keeping the last discovery results on the phone lets Home and
 * a business page draw at once from them, then refresh in the
 * background (they are already stale by then, so they always refetch).
 *
 * Only what anybody can see on the public site is kept — business
 * lists, business pages, categories and cities. Never a person's
 * bookings, favourites, profile, notifications, payments or anything
 * on the business side; never "near me", whose key holds where the
 * person stood. AsyncStorage is not encrypted, so that line is the
 * whole of the rule. Tokens live in the secure store, never here.
 */

/** The first key segment of everything that may be kept. */
const PUBLIC = new Set(["businesses", "facets"]);

export function isPersistable(query: Pick<Query, "queryKey" | "state">): boolean {
  const [root, kind] = query.queryKey as unknown[];
  if (typeof root !== "string" || !PUBLIC.has(root)) return false;
  if (root === "businesses" && kind === "nearby") return false;
  return query.state.status === "success";
}

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "maw3ed.query-cache",
  // Writes are batched: one write a second at most, not one per query.
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  // A day-old catalogue is still a fine first frame; older is dropped.
  maxAge: 24 * 60 * 60 * 1000,
  // A new app version starts clean, in case a response shape changed.
  buster: VERSION_LABEL,
  dehydrateOptions: { shouldDehydrateQuery: isPersistable },
};
