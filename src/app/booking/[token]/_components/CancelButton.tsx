"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";
import { refusalText } from "@/lib/lang";

/* The cancel route's refusals, worded from their code in English (the route answers in Arabic). */
const REFUSED_EN: Record<string, string> = {
  "not-found": "Booking not found.",
  "not-cancellable": "This booking can't be cancelled.",
  "too-late": "It's too close to the appointment to cancel online. Contact the place.",
  changed: "The booking just changed. Refresh the page and try again.",
};

interface Props {
  token: string;
}

/**
 * Cancelling, and the refresh that follows it.
 *
 * The refresh used to be an `onCancelled` callback passed down from
 * the page. The page is a server component, and a function cannot
 * cross that boundary — React refused to serialise it and the whole
 * route answered 500. It only happened for a booking that was still
 * cancellable, so the page worked for past appointments and broke for
 * exactly the ones somebody opened it to change.
 *
 * Nothing needed to be passed. This component already knows when the
 * cancellation succeeded, and it is already a client component, so the
 * reload belongs here.
 *
 * router.refresh() rather than window.location.reload(): it re-renders
 * the server component in place, so the page does not flash white and
 * scroll position is kept.
 */
export default function CancelButton({ token }: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, english: string) => (en ? english : ar);
  const [confirming, setConfirming] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${token}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((en && REFUSED_EN[data.code]) || refusalText(res.status, data.error, en, "حدث خطأ أثناء الإلغاء"));
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError(t("تعذّر الاتصال بالخادم، حاول مرة أخرى", "Couldn't connect. Try again."));
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" fullWidth onClick={() => setConfirming(true)}
        className="border-[var(--color-danger-line)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
      >
        {t("إلغاء الحجز", "Cancel booking")}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-center text-[var(--color-text-secondary)]">
        {t("هل أنت متأكد من إلغاء الحجز؟ لا يمكن التراجع عن هذا الإجراء.", "Cancel this booking? This can't be undone.")}
      </p>
      {error && (
        <p className="text-sm text-[var(--color-danger)] text-center bg-[var(--color-danger-soft)] rounded-[var(--radius-md)] px-4 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={loading}
        >
          {t("تراجع", "Keep it")}
        </Button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-danger)] hover:bg-[var(--color-danger)] text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : null}
          {t("تأكيد الإلغاء", "Yes, cancel")}
        </button>
      </div>
    </div>
  );
}
