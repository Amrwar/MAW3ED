"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js, which serves an offline page when the network
 * is gone and caches nothing else. Production only: in development a
 * worker outlives the code that registered it and confuses hot reload.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Nothing depends on it; a browser that refuses simply has no
      // offline page.
    });
  }, []);
  return null;
}
