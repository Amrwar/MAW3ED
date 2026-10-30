"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Shares the current page: the native sheet where there is one, the
 * clipboard otherwise. Shares only the URL the visitor is already on.
 */
export default function SharePage({ title, label, copied }: { title: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed or unsupported payload; fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // Clipboard refused (permissions); nothing worth breaking over.
    }
  }
  return (
    <button type="button" onClick={share} className="btn btn-ghost btn-sm gap-1.5">
      {done ? <Check size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
      {done ? copied : label}
    </button>
  );
}
