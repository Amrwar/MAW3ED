"use client";

import { useEffect } from "react";

/**
 * For a booking made in the app: back to it.
 *
 * Paymob's return URL is one fixed setting, so the app's payment page
 * lands on this website page like every other. Here the booking was made
 * by the app (its idempotency key says so), so the page hands the person
 * straight back — the app's in-app browser closes on the deep link and
 * the booking screen reads the authoritative status itself. The link is
 * also a button, for a browser that will not follow it on its own.
 */
export default function BackToApp({ token, label }: { token: string; label: string }) {
  const href = `maw3ed://booking/${token}`;

  useEffect(() => {
    const id = setTimeout(() => {
      window.location.href = href;
    }, 600);
    return () => clearTimeout(id);
  }, [href]);

  return (
    <a
      href={href}
      className="mb-4 block w-full rounded-[var(--radius-md)] bg-[var(--color-ink)] py-3 text-center text-sm font-bold text-white"
    >
      {label}
    </a>
  );
}
