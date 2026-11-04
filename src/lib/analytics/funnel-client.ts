"use client";

import { useEffect } from "react";
import type { FunnelStep, TrafficSource } from "@prisma/client";
import { resolveSource } from "@/lib/attribution/source";

/**
 * Reporting a funnel step from the browser (server side: funnel.ts).
 *
 *   - The tab id is random, made here, and kept in sessionStorage: it
 *     dies with the tab, is not a cookie, and is never tied to an account.
 *   - The channel is the tab's first page: its ?src= or referrer, read
 *     once (lib/attribution/source.ts) and kept for the tab, so a visitor
 *     who came from Instagram and then browsed is still an Instagram
 *     visit at the booking step.
 *   - A step already sent from this tab today is not sent again: re-renders,
 *     React's double effects in development, back and forward, a language
 *     switch. The server deduplicates as well; this saves the request.
 *   - Fire and forget. Nothing here can throw into a page, block it, or
 *     retry in a loop.
 */

const TAB_KEY = "mw:tab";
const SRC_KEY = "mw:src";
const SENT_PREFIX = "mw:f:";

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null; // storage disabled: no dedup key, so nothing is sent
  }
}

function tabId(s: Storage): string {
  let id = s.getItem(TAB_KEY);
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    s.setItem(TAB_KEY, id);
  }
  return id;
}

/** The channel this tab arrived through, decided on its first page. */
export function tabSource(s: Storage | null = store()): TrafficSource {
  const saved = s?.getItem(SRC_KEY);
  if (saved) return saved as TrafficSource;
  const source = resolveSource({
    src: new URLSearchParams(window.location.search).get("src"),
    referrer: document.referrer || null,
    ownHosts: [window.location.hostname],
  });
  s?.setItem(SRC_KEY, source);
  return source;
}

function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

export interface FunnelContext {
  /** The business slug, for the steps about one business. */
  business?: string | null;
  /** The organization slug the visit came through (?org=). */
  org?: string | null;
}

export function reportFunnelStep(step: FunnelStep, ctx: FunnelContext = {}): void {
  try {
    const s = store();
    if (!s) return;
    const sentKey = `${SENT_PREFIX}${step}|${ctx.business ?? ""}|${ctx.org ?? ""}|${cairoToday()}`;
    if (s.getItem(sentKey)) return;
    s.setItem(sentKey, "1");

    const body = JSON.stringify({
      step,
      tab: tabId(s),
      source: tabSource(s),
      business: ctx.business ?? null,
      org: ctx.org ?? null,
    });
    const url = "/api/public/funnel";
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
    void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // A step that was not counted troubles nobody.
  }
}

/**
 * Report `step` once the component has mounted and `when` holds. The
 * dependencies are plain strings and a boolean, so the effect re-runs only
 * when the step's subject changes — and a repeat is dropped above anyway.
 */
export function useFunnelStep(step: FunnelStep, ctx: FunnelContext = {}, when = true): void {
  const { business = null, org = null } = ctx;
  useEffect(() => {
    if (!when) return;
    reportFunnelStep(step, { business, org });
  }, [step, business, org, when]);
}
