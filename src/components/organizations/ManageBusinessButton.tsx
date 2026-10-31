"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Starts operating a business in the regular dashboard, within the
 * scopes it granted. The server checks the delegation before setting the
 * acting context, and again on every request after.
 */
export default function ManageBusinessButton({ businessId, className = "btn btn-primary btn-sm" }: { businessId: string; className?: string }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "en" ? en : ar);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await fetch("/api/organizations/acting", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId }),
          }).catch(() => null);
          if (r?.ok) {
            // The dashboard's layout reads the new acting cookie on refresh.
            router.push("/dashboard");
            router.refresh();
            return;
          }
          setRefused(true);
          setBusy(false);
        }}
      >
        {t("ادخل أدير النشاط", "Manage this business")}
      </button>
      {refused && (
        <span role="status" className="text-xs text-[var(--color-danger)]">
          {t("مش متاح — يمكن الصلاحية اتسحبت أو انتهت.", "Not available — access may have been withdrawn or expired.")}
        </span>
      )}
    </>
  );
}
