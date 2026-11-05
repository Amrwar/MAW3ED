"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuthOptions } from "./AuthOptions";
import { GoogleMark } from "./brand-icons";

/**
 * "Continue with Google", or nothing when this deployment has no Google
 * credentials (AuthOptions, decided on the server).
 *
 * signIn() from next-auth/react, not a <form>: it fetches the Google
 * address from /api/auth/signin/google and then moves the page there.
 * A plain form POST would be answered with a redirect to
 * accounts.google.com, which the CSP's `form-action 'self'` blocks.
 *
 * `divider` puts the "or …" line under the button, so the line goes
 * away with it when Google is off.
 */
export default function GoogleButton({
  redirectTo,
  divider,
}: {
  /** Where to land once signed in; a function is read at the click. */
  redirectTo: string | (() => string);
  divider?: string;
}) {
  const { google } = useAuthOptions();
  const { t } = useLanguage();
  const g = t.auth.google;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!google) return null;

  async function go() {
    setBusy(true);
    setFailed(false);
    try {
      await signIn("google", { redirectTo: typeof redirectTo === "function" ? redirectTo() : redirectTo });
      // The page is leaving; the spinner stays until it has gone.
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={go} disabled={busy} aria-busy={busy || undefined} className="auth-sso">
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <GoogleMark />}
        <span>{g.continue}</span>
      </button>
      {failed && (
        <p role="alert" className="m-0 text-[0.8125rem] text-[var(--color-danger)]">
          {g.failed}
        </p>
      )}
      {divider && <p className="auth-or">{divider}</p>}
    </div>
  );
}
