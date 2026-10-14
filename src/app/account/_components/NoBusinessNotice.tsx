"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Says why a customer who opened /dashboard landed here instead.
 *
 * The dashboard sends them to /account?notice=no-business
 * (lib/dashboard/guard.ts). Dismissing drops the parameter so a reload
 * or a shared link does not bring the note back.
 */
export default function NoBusinessNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  if (params.get("notice") !== "no-business") return null;

  function dismiss() {
    const next = new URLSearchParams(params.toString());
    next.delete("notice");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  return (
    <div className="relative mb-6">
      <Alert tone="info">
        <span className="block pe-10">{t.account.noBusinessNotice}</span>
      </Alert>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.account.dismiss}
        className="absolute end-1 top-1 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-info)] hover:bg-[var(--color-info-line)]"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
