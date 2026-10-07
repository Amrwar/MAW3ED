"use client";

import { useEffect, useRef } from "react";
import type { TrafficSource } from "@prisma/client";

/**
 * Counts one visit to a business page.
 *
 * Fired from the browser rather than during the server render, so a
 * crawler indexing the page does not look like a customer walking in.
 * It sends the source the server already worked out — the browser is
 * not asked to decide, it only reports that a real session happened.
 *
 * Once per mount, guarded by a ref: React runs effects twice in
 * development and a double-counted view is a lie, however small.
 *
 * Nothing identifying is sent, because there is nothing to send: the
 * payload is a slug and a channel name.
 */
export default function RecordView({
  slug,
  source,
}: {
  slug: string;
  source: TrafficSource;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const body = JSON.stringify({ source });

    // sendBeacon survives the page being closed straight after, which
    // is exactly the visit worth counting: somebody looked and left.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        `/api/public/${encodeURIComponent(slug)}/view`,
        new Blob([body], { type: "application/json" }),
      );
      return;
    }

    void fetch(`/api/public/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // A view that was not counted is not worth troubling anybody
      // over. It must never affect the page.
    });
  }, [slug, source]);

  return null;
}
