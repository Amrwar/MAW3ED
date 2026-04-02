"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

interface Props {
  token: string;
  onCancelled: () => void;
}

export default function CancelButton({ token, onCancelled }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${token}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ أثناء الإلغاء");
        setConfirming(false);
        return;
      }
      onCancelled();
    } catch {
      setError("تعذّر الاتصال بالخادم، حاول مرة أخرى");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" fullWidth onClick={() => setConfirming(true)}
        className="border-red-200 text-red-500 hover:bg-red-50"
      >
        إلغاء الحجز
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-center text-[var(--color-text-secondary)]">
        هل أنت متأكد من إلغاء الحجز؟ لا يمكن التراجع عن هذا الإجراء.
      </p>
      {error && (
        <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl px-4 py-2">
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
          تراجع
        </Button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : null}
          تأكيد الإلغاء
        </button>
      </div>
    </div>
  );
}
