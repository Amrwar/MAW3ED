"use client";

import { useState } from "react";
import Alert from "@/components/ui/Alert";
import type { AccountUser } from "@/lib/account/queries";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * What the customer hears about, and how.
 *
 * Saved as it is toggled rather than behind a button: a switch that
 * needs confirming is a switch people leave in the wrong position.
 */
export default function SettingsForm({ user }: { user: AccountUser }) {
  const { t } = useLanguage();
  const s = t.account.settings;

  const [whatsapp, setWhatsapp] = useState(user.notifyByWhatsApp);
  const [email, setEmail] = useState(user.notifyByEmail);
  const [error, setError] = useState<string | null>(null);

  async function update(patch: { notifyByWhatsApp?: boolean; notifyByEmail?: boolean }) {
    setError(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Put the switch back where it was, so what is shown is what is
      // stored.
      if (patch.notifyByWhatsApp !== undefined) setWhatsapp(!patch.notifyByWhatsApp);
      if (patch.notifyByEmail !== undefined) setEmail(!patch.notifyByEmail);
      setError(t.account.profile.saveError);
    }
  }

  return (
    <div className="max-w-[32rem] space-y-4">
      <section className="card p-6">
        <h2 className="m-0 mb-4 text-[1rem] font-bold text-[var(--color-ink)]">{s.title}</h2>

        <div className="space-y-1">
          <Toggle
            label={s.whatsapp}
            hint={s.whatsappHint}
            checked={whatsapp}
            onChange={(v) => {
              setWhatsapp(v);
              void update({ notifyByWhatsApp: v });
            }}
          />
          <Toggle
            label={s.email}
            hint={s.emailHint}
            checked={email}
            onChange={(v) => {
              setEmail(v);
              void update({ notifyByEmail: v });
            }}
          />
        </div>

        {error && (
          <div className="mt-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] p-6">
        <h2 className="m-0 text-[0.9375rem] font-bold text-[var(--color-danger)]">{s.danger}</h2>
        <p className="m-0 mt-2 text-[0.84375rem] leading-relaxed text-[var(--color-muted)]">
          {s.dangerBody}
        </p>
      </section>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] px-2 py-2.5 transition-colors hover:bg-[var(--color-surface-2)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-[var(--color-jade)]" : "bg-[var(--color-line-2)]",
        )}
      >
        <span
          className={cn(
            "block h-5 w-5 rounded-full bg-[var(--color-surface)] transition-transform",
            checked ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] font-bold text-[var(--color-ink)]">{label}</span>
        <span className="mt-0.5 block text-[0.78125rem] leading-relaxed text-[var(--color-subtle)]">
          {hint}
        </span>
      </span>
    </label>
  );
}
