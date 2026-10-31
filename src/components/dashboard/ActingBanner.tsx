"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Shown on every dashboard page while somebody operates a business for
 * an organization, so it is never unclear whose business is on screen
 * and through whom: "You are managing X for Y — reservations, services".
 *
 * `ended`: the acting cookie is still set but the delegation no longer
 * grants anything (revoked, expired, suspended). Only a way out is left.
 */
export default function ActingBanner({
  mode,
  businessName,
  organizations,
  scopes,
}: {
  mode: "active" | "ended";
  businessName: string;
  organizations: string[];
  scopes: { ar: string; en: string }[];
}) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function exit() {
    setLeaving(true);
    await fetch("/api/organizations/acting", { method: "DELETE" }).catch(() => null);
    router.push("/org-admin");
    router.refresh();
  }

  // An acting cookie that no longer grants anything (withdrawn, expired,
  // or never valid) is cleared as soon as it is noticed, so it cannot keep
  // the proxy turning the account away from its own pages.
  // Once per mount: if clearing fails (offline, server error) it is not
  // retried in a loop — the button stays, and the next page load tries
  // again. A refresh only follows a successful clear, so a failure cannot
  // re-render into another attempt.
  const healed = useRef(false);
  useEffect(() => {
    if (mode !== "ended" || healed.current) return;
    healed.current = true;
    void fetch("/api/organizations/acting", { method: "DELETE" })
      .then((r) => {
        if (r.ok) router.refresh();
      })
      .catch(() => null);
  }, [mode, router]);

  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-jade)] bg-[var(--color-surface)] px-4 py-3 text-sm"
    >
      <p className="m-0 min-w-0 flex-1">
        {mode === "active" ? (
          <>
            <span className="font-bold">
              {en ? `Managing ${businessName}` : `بتدير ${businessName}`}
            </span>{" "}
            {en ? `for ${organizations.join(", ")}` : `لحساب ${organizations.join("، ")}`}
            <span className="block text-xs text-[var(--color-subtle)]">
              {en ? "Allowed: " : "المسموح: "}
              {scopes.map((s) => (en ? s.en : s.ar)).join(en ? ", " : "، ")}
              {en ? " — granted by the business owner, who can change it any time." : " — بإذن صاحب النشاط، ويقدر يغيّره في أي وقت."}
            </span>
          </>
        ) : (
          <span className="font-bold">
            {en
              ? "Your delegated access to this business has ended."
              : "صلاحية إدارة النشاط ده انتهت."}
          </span>
        )}
      </p>
      <button type="button" className="btn btn-outline btn-sm gap-1.5" onClick={() => void exit()} disabled={leaving}>
        <LogOut size={14} aria-hidden="true" />
        {en ? "Stop managing" : "اخرج من الإدارة"}
      </button>
    </div>
  );
}
