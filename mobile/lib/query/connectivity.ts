import { AppState, Platform, type AppStateStatus } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from "expo-network";

/**
 * Tells the query layer what the phone already knows: whether there is a
 * connection, and whether the app is in front of the person.
 *
 * Without this, React Query assumes it is always online and always
 * focused. Measured before: offline, every screen fired its requests,
 * each failed, and was retried three times into the void; back online,
 * nothing refetched until the person pulled to refresh.
 *
 * Online: requests wait while there is no connection (the screen keeps
 * what it has, with the offline banner) and the ones that matter run
 * again the moment it returns. Focus: coming back to the app refetches
 * the queries on screen that are older than their staleTime — one
 * minute — and nothing else, so it costs a request or two, not a reload.
 */

function online(s: Pick<NetworkState, "isConnected" | "isInternetReachable">): boolean {
  // Unknown counts as online: a false "offline" blocks the app, a false
  // "online" only costs a failed request.
  return s.isConnected !== false && s.isInternetReachable !== false;
}

let installed = false;

export function installConnectivity() {
  if (installed) return;
  installed = true;

  // The web build already gets this from the browser's online/offline
  // and visibility events, which React Query listens to by itself.
  if (Platform.OS === "web") return;

  onlineManager.setEventListener((setOnline) => {
    getNetworkStateAsync()
      .then((s) => setOnline(online(s)))
      .catch(() => undefined);
    const sub = addNetworkStateListener((s) => setOnline(online(s)));
    return () => sub.remove();
  });

  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => setFocused(s === "active"));
    return () => sub.remove();
  });
}
