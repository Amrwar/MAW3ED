"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Field, INPUT, StatusChip, api, useSay } from "@/components/dashboard/kit";
import { localeFor } from "@/lib/fmt";

interface Credential {
  providerId: string;
  keyVersion: number;
  rotatedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * The venue's own credential at its access provider. Platform
 * administrators only: the API answers 404 to anyone else and the panel
 * then shows nothing. The secret is write-only — typed, sent, cleared;
 * the server never returns it and this never shows it.
 */
export default function VenueCredentialPanel({ venueId }: { venueId: string }) {
  const { lang, say } = useSay();
  const uid = useId();
  const url = `/api/admin/venues/${venueId}/access-credential`;
  const [state, setState] = useState<{ status: number | null; credential: Credential | null; error: string | null }>({
    status: null,
    credential: null,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void api<{ credential: Credential | null }>(url).then((r) => {
      if (!live) return;
      setState({ status: r.status, credential: r.ok ? r.data.credential : null, error: r.ok ? null : (r.data.error ?? "error") });
    });
    return () => {
      live = false;
    };
  }, [url, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  if (state.status === 404) return null;

  const at = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(localeFor(lang), { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
      : "—";
  const c = state.credential;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const s = secret;
    if (s && (s.length < 16 || s.length > 2000)) {
      setMsg({ ok: false, text: say("السر لازم يكون من 16 لـ 2000 حرف، أو سيبه فاضي.", "The secret must be 16–2000 characters, or left empty.") });
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await api<{ keyVersion: number }>(url, "POST", s ? { action: "set", secret: s } : { action: "set" });
    setBusy(false);
    setSecret("");
    setMsg({
      ok: r.ok,
      text: r.ok
        ? say(`اتحفظ — الإصدار ${r.data.keyVersion}.`, `Saved — version ${r.data.keyVersion}.`)
        : (r.data.error ?? say("حصلت مشكلة", "Something went wrong")),
    });
    if (r.ok) reload();
  }

  async function revoke() {
    setBusy(true);
    setMsg(null);
    const r = await api(url, "POST", { action: "revoke" });
    setBusy(false);
    setConfirmRevoke(false);
    setMsg({ ok: r.ok, text: r.ok ? say("المفتاح اتلغى.", "Credential revoked.") : (r.data.error ?? say("حصلت مشكلة", "Something went wrong")) });
    if (r.ok) reload();
  }

  return (
    <div className="space-y-3 border-t border-[var(--color-line)] pt-3" aria-labelledby={`${uid}-h`} role="group">
      <h3 id={`${uid}-h`} className="m-0 text-sm font-bold">{say("مفتاح المكان عند المزوّد", "Venue credential")}</h3>
      {state.status === null && <p className="m-0 text-sm text-[var(--color-subtle)]" role="status">{say("بيحمّل…", "Loading…")}</p>}
      {state.error && <p className="m-0 text-sm text-[var(--color-danger)]" role="alert">{state.error}</p>}
      {state.status !== null && !state.error && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {!c ? (
            <StatusChip tone="muted">{say("مفيش مفتاح", "No credential")}</StatusChip>
          ) : c.revokedAt ? (
            <StatusChip tone="danger">{say("اتلغى", "Revoked")} {at(c.revokedAt)}</StatusChip>
          ) : (
            <StatusChip tone="jade">{say(`ساري — إصدار ${c.keyVersion}`, `Active — version ${c.keyVersion}`)}</StatusChip>
          )}
          {c && (
            <span className="text-xs text-[var(--color-subtle)]">
              {say("اتعمل", "Created")} {at(c.createdAt)} · {say("آخر تغيير", "Last rotated")} {at(c.rotatedAt)}
            </span>
          )}
        </div>
      )}
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <Field
            label={say("السر الجديد", "New secret")}
            htmlFor={`${uid}-secret`}
            hint={say(
              "بيتكتب بس ومش بيظهر تاني. سيبه فاضي عشان يتعمل واحد عشوائي (لبيئة التجربة).",
              "Write-only; never shown again. Leave empty to generate one (for the sandbox).",
            )}
          >
            <input
              id={`${uid}-secret`}
              type="password"
              autoComplete="new-password"
              className={INPUT}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              maxLength={2000}
              dir="ltr"
            />
          </Field>
        </div>
        <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>
          {busy ? say("بيحفظ…", "Saving…") : c && !c.revokedAt ? say("غيّر المفتاح", "Rotate credential") : say("احفظ المفتاح", "Set credential")}
        </button>
        {c && !c.revokedAt && !confirmRevoke && (
          <button type="button" className="btn btn-ghost btn-sm text-[var(--color-danger)]" disabled={busy} onClick={() => setConfirmRevoke(true)}>
            {say("الغِ", "Revoke")}
          </button>
        )}
      </form>
      {confirmRevoke && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={say("تأكيد الإلغاء", "Confirm revoking")}>
          <p className="m-0 flex-1 text-sm">
            {say("المكان مش هيقدر يكلّم المزوّد بمفتاحه لحد ما يتحط واحد جديد. متأكد؟", "The venue cannot reach its provider with its own credential until a new one is set. Are you sure?")}
          </p>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void revoke()}>
            {say("أيوه، الغِه", "Yes, revoke")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirmRevoke(false)}>
            {say("لأ", "No")}
          </button>
        </div>
      )}
      <p role="status" className={`m-0 min-h-4 text-sm ${msg?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg?.text}</p>
    </div>
  );
}
