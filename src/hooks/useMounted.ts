"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to — the value never changes after hydration. */
const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False on the server and through hydration, true afterwards.
 *
 * A component that portals into document.body must not branch on
 * `typeof document` to decide whether to render: the server skips the
 * portal, the client's hydration pass includes it, and React reports
 * the trees as mismatched. useSyncExternalStore gives React an
 * explicit server snapshot, so hydration matches and the portal
 * appears on the commit after.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}
