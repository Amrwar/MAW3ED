"use client";

import { useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { AccountUser } from "@/lib/account/queries";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPhone } from "@/lib/phone";

export default function ProfileForm({ user }: { user: AccountUser }) {
  const { t } = useLanguage();
  const p = t.account.profile;

  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, email: email.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? p.saveError);
        return;
      }
      setSaved(true);
    } catch {
      setError(p.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card max-w-[32rem] space-y-4 p-6">
      <Input label={p.name} value={name} onChange={(e) => setName(e.target.value)} />

      {/* Read-only: this is the key every booking is found by, so
          changing it here would silently detach their history. */}
      <Input
        label={p.phone}
        value={formatPhone(user.phone)}
        dir="ltr"
        readOnly
        disabled
        hint={p.phoneLocked}
        className="num"
      />

      <Input
        label={p.email}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        dir="ltr"
        hint={p.emailHint}
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">{p.saved}</Alert>}

      <Button type="submit" variant="primary" isLoading={busy}>
        {p.save}
      </Button>
    </form>
  );
}
