"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { Field, INPUT, StatusChip, api, useSay } from "@/components/dashboard/kit";
import { num } from "@/lib/fmt";
import type { Lang } from "@/lib/i18n";
import { SecretOnce, Spinner, at, useOwnerLoad } from "./bits";

interface Client {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: "ACTIVE" | "REVOKED";
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  replacedById: string | null;
  createdAt: string;
  usage: { day: string; requests: number }[];
}
interface Data {
  clients: Client[];
  contract: { maxApiClients: number } | null;
  scopes: string[];
}

const SCOPE: Record<string, [string, string]> = {
  "organization:read": ["بيانات الجهة", "Organization details"],
  "businesses:read": ["الأنشطة", "Businesses"],
  "venues:read": ["الأماكن", "Venues"],
  "bookings:read": ["الحجوزات", "Bookings"],
  "reports:read": ["التقارير", "Reports"],
};

/** The organization's API keys. Owner only: the API answers 404 to anyone else, and the section then stays away. */
export default function ApiKeysSection({ base }: { base: string }) {
  const { lang, say } = useSay();
  const { data, error, loading, hidden, reload } = useOwnerLoad<Data>(`${base}/api-clients`);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ prefix: string; key: string } | null>(null);

  if (hidden) return null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (scopes.length === 0) {
      setFormError(say("اختار صلاحية واحدة على الأقل", "Pick at least one scope"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const r = await api<{ id: string; prefix: string; key: string }>(`${base}/api-clients`, "POST", { name: name.trim(), scopes });
    setBusy(false);
    if (!r.ok) {
      setFormError(r.data.error ?? say("حصلت مشكلة", "Something went wrong"));
      return;
    }
    setShown({ prefix: r.data.prefix, key: r.data.key });
    setCreating(false);
    setName("");
    setScopes([]);
    reload();
  }

  const active = data?.clients.filter((c) => c.status === "ACTIVE").length ?? 0;

  return (
    <section aria-labelledby="ik-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ik-h" className="m-0 text-base font-extrabold">{say("مفاتيح الـ API", "API keys")}</h2>
        {data?.contract && !creating && (
          <button type="button" className="btn btn-outline btn-sm gap-1.5" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" />
            {say("مفتاح جديد", "New key")}
          </button>
        )}
      </div>
      {loading && <Spinner />}
      {error && <Alert tone="danger">{error}</Alert>}
      {shown && (
        <SecretOnce
          id="ik-secret"
          label={say(`المفتاح الجديد (${shown.prefix}…)`, `The new key (${shown.prefix}…)`)}
          value={shown.key}
          onDone={() => setShown(null)}
        />
      )}
      {data && (
        <>
          {data.contract ? (
            <p className="m-0 text-xs text-[var(--color-subtle)]">
              {say(
                `${active} من ${data.contract.maxApiClients} مفتاح شغّال حسب الاتفاق. المفتاح بيتبعت في الهيدر Authorization: Bearer.`,
                `${active} of ${data.contract.maxApiClients} keys in use under the agreement. Send the key as Authorization: Bearer.`,
              )}
            </p>
          ) : (
            <p className="m-0 text-sm text-[var(--color-subtle)]">
              {say("المفاتيح بتحتاج اتفاق ساري مع المنصة.", "Keys need an agreement in force with the platform.")}
            </p>
          )}

          {creating && (
            <form onSubmit={create} className="card space-y-3 p-4" aria-labelledby="ik-new">
              <h3 id="ik-new" className="m-0 text-sm font-bold">{say("مفتاح جديد", "New key")}</h3>
              <Field label={say("اسم يفكّرك بيه", "A name to recognise it by")} htmlFor="ik-name">
                <input id="ik-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
              </Field>
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-1.5 p-0 text-xs font-semibold text-[var(--color-subtle)]">{say("يقدر يقرا إيه", "What it may read")}</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {data.scopes.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={scopes.includes(s)}
                        onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))}
                      />
                      {SCOPE[s] ? say(SCOPE[s][0], SCOPE[s][1]) : s}
                      <span className="font-mono text-[0.6875rem] text-[var(--color-subtle)]" dir="ltr">{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {formError && <p className="m-0 text-sm text-[var(--color-danger)]" role="alert">{formError}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                  {busy ? say("بيعمل…", "Creating…") : say("اعمل المفتاح", "Create key")}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCreating(false); setFormError(null); }}>
                  {say("إلغاء", "Cancel")}
                </button>
              </div>
            </form>
          )}

          {data.clients.length === 0 ? (
            <p className="m-0 text-sm text-[var(--color-subtle)]">{say("لسه مفيش مفاتيح.", "No keys yet.")}</p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {data.clients.map((c) => (
                <ClientRow key={c.id} c={c} base={base} lang={lang} onShown={setShown} onChanged={reload} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function ClientRow({
  c,
  base,
  lang,
  onShown,
  onChanged,
}: {
  c: Client;
  base: string;
  lang: Lang;
  onShown: (s: { prefix: string; key: string }) => void;
  onChanged: () => void;
}) {
  const { say } = useSay();
  const [mode, setMode] = useState<"rotate" | "revoke" | null>(null);
  const [grace, setGrace] = useState("24");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const requests30d = c.usage.reduce((n, u) => n + u.requests, 0);
  const graceEnds = c.status === "ACTIVE" && c.expiresAt;

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setRowError(null);
    const r = await api<{ prefix: string; key: string }>(`${base}/api-clients/${c.id}`, "POST", body);
    setBusy(false);
    if (!r.ok) {
      setRowError(r.data.error ?? say("حصلت مشكلة", "Something went wrong"));
      return;
    }
    if (body.action === "rotate") onShown({ prefix: r.data.prefix, key: r.data.key });
    setMode(null);
    onChanged();
  }

  return (
    <li className="card space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 font-bold">
            {c.name} <span className="font-mono text-xs font-normal text-[var(--color-subtle)]" dir="ltr">{c.keyPrefix}…</span>
          </p>
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {c.scopes.map((s) => (SCOPE[s] ? say(SCOPE[s][0], SCOPE[s][1]) : s)).join(lang === "en" ? ", " : "، ")}
          </p>
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {say("اتعمل", "Created")} {at(c.createdAt, lang)} · {say("آخر استخدام", "Last used")} {at(c.lastUsedAt, lang)} ·{" "}
            {say(`${num(requests30d, lang)} طلب آخر 30 يوم`, `${num(requests30d, lang)} requests in 30 days`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.status === "REVOKED" ? (
            <StatusChip tone="muted">{say("اتلغى", "Revoked")} {at(c.revokedAt, lang)}</StatusChip>
          ) : graceEnds ? (
            <StatusChip tone="warn">{say("بيخلص", "Expires")} {at(c.expiresAt, lang)}</StatusChip>
          ) : (
            <StatusChip tone="jade">{say("شغّال", "Active")}</StatusChip>
          )}
          {c.status === "ACTIVE" && !mode && (
            <>
              {!c.replacedById && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setMode("rotate")}>
                  {say("غيّر المفتاح", "Rotate")}
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm text-[var(--color-danger)]" onClick={() => setMode("revoke")}>
                {say("الغِ", "Revoke")}
              </button>
            </>
          )}
        </div>
      </div>

      {mode === "rotate" && (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-[var(--color-line)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ action: "rotate", graceHours: Math.min(72, Math.max(0, Math.round(Number(grace) || 0))) });
          }}
        >
          <div className="w-40">
            <Field
              label={say("المفتاح القديم يفضل شغّال (ساعات)", "Old key keeps working (hours)")}
              htmlFor={`ik-grace-${c.id}`}
            >
              <input
                id={`ik-grace-${c.id}`}
                className={INPUT}
                type="number"
                min={0}
                max={72}
                step={1}
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? say("بيغيّر…", "Rotating…") : say("اعمل مفتاح بداله", "Issue the replacement")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(null)} disabled={busy}>
            {say("إلغاء", "Cancel")}
          </button>
        </form>
      )}

      {mode === "revoke" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3" role="group" aria-label={say("تأكيد الإلغاء", "Confirm revoking")}>
          <p className="m-0 flex-1 text-sm">
            {say(
              "أي نظام بيستخدم المفتاح ده هيتوقف فورًا. متأكد؟",
              "Any system using this key stops working immediately. Are you sure?",
            )}
          </p>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run({ action: "revoke" })}>
            {busy ? say("بيلغي…", "Revoking…") : say("أيوه، الغِه", "Yes, revoke it")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(null)} disabled={busy}>
            {say("لأ", "No")}
          </button>
        </div>
      )}
      {rowError && <p className="m-0 text-sm text-[var(--color-danger)]" role="alert">{rowError}</p>}
    </li>
  );
}
