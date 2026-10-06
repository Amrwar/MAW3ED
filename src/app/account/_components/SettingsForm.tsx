"use client";

import { useState } from "react";
import Alert from "@/components/ui/Alert";
import Toggle from "@/components/ui/Toggle";
import type { AccountUser } from "@/lib/account/queries";
import { useLanguage } from "@/contexts/LanguageContext";

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
