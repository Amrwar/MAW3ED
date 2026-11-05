"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { Field, INPUT, StatusChip, api, useSay } from "@/components/dashboard/kit";
import type { Lang } from "@/lib/i18n";
import { SecretOnce, Spinner, at, useOwnerLoad } from "./bits";

interface Delivery {
  id: string;
  eventId: string;
  eventType: string;
  status: "PENDING" | "SENT" | "FAILED" | "DEAD";
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}
interface Endpoint {
  id: string;
  url: string;
  events: string[];
  status: "ACTIVE" | "DISABLED";
  consecutiveFailures: number;
  disabledReason: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  previousSecretUntil: string | null;
  createdAt: string;
  deliveries: Delivery[];
}
interface Data {
  endpoints: Endpoint[];
  events: string[];
}

const EVENT: Record<string, [string, string]> = {
  "booking.created": ["حجز جديد", "Booking created"],
  "booking.updated": ["حجز اتعدّل", "Booking updated"],
  "association.updated": ["ارتباط نشاط اتغيّر", "Association updated"],
};
const DELIVERY: Record<Delivery["status"], [string, string, "info" | "jade" | "warn" | "danger"]> = {
  PENDING: ["مستني", "Pending", "info"],
  SENT: ["اتبعت", "Sent", "jade"],
  FAILED: ["فشل — هيتعاد", "Failed — will retry", "warn"],
  DEAD: ["اتساب", "Dead", "danger"],
};

/** Where the organization's events are sent. Owner only; hidden on the API's 404. */
export default function WebhooksSection({ base }: { base: string }) {
  const { lang, say } = useSay();
  const { data, error, loading, hidden, reload } = useOwnerLoad<Data>(`${base}/webhooks`);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  if (hidden) return null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (events.length === 0) {
      setFormError(say("اختار حدث واحد على الأقل", "Pick at least one event"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const r = await api<{ id: string; secret: string }>(`${base}/webhooks`, "POST", { url: url.trim(), events });
    setBusy(false);
    if (!r.ok) {
      setFormError(r.data.error ?? say("حصلت مشكلة", "Something went wrong"));
      return;
    }
    setSecret(r.data.secret);
    setAdding(false);
    setUrl("");
    setEvents([]);
    reload();
  }

  return (
    <section aria-labelledby="iw-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="iw-h" className="m-0 text-base font-extrabold">Webhooks</h2>
        {data && !adding && (
          <button type="button" className="btn btn-outline btn-sm gap-1.5" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" />
            {say("عنوان جديد", "Add endpoint")}
          </button>
        )}
      </div>
      {loading && <Spinner />}
      {error && <Alert tone="danger">{error}</Alert>}
      {secret && (
        <SecretOnce id="iw-secret" label={say("سر التوقيع", "Signing secret")} value={secret} onDone={() => setSecret(null)} />
      )}

      <div className="card space-y-1.5 p-4 text-sm">
        <h3 className="m-0 text-sm font-bold">{say("إزاي تتأكد من التوقيع", "How to verify signatures")}</h3>
        <p className="m-0">
          {say("كل طلب فيه الهيدر", "Every request carries the header")}{" "}
          <code dir="ltr" className="font-mono text-[0.78125rem]">Maw3ed-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code>
        </p>
        <p className="m-0">
          {say("احسب HMAC-SHA256 بالسر على", "Compute HMAC-SHA256 with the secret over")}{" "}
          <code dir="ltr" className="font-mono text-[0.78125rem]">{"${t}.${rawBody}"}</code>{" "}
          {say("(الجسم زي ما وصل بالظبط) وقارنه بـ v1.", "(the body exactly as received) and compare it with v1.")}
        </p>
        <p className="m-0">
          {say("ارفض أي طلب t بتاعه أقدم من 5 دقايق.", "Reject any request whose t is older than 5 minutes.")}{" "}
          {say("التفاصيل في دليل الربط للمطورين.", "Details are in the developer integration guide.")}
        </p>
      </div>

      {data && (
        <>
          {adding && (
            <form onSubmit={add} className="card space-y-3 p-4" aria-labelledby="iw-new">
              <h3 id="iw-new" className="m-0 text-sm font-bold">{say("عنوان جديد", "New endpoint")}</h3>
              <Field label={say("العنوان (https)", "URL (https)")} htmlFor="iw-url" hint={say("لازم يكون https وعنوان عام.", "Must be https and publicly reachable.")}>
                <input
                  id="iw-url"
                  className={INPUT}
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                  required
                  minLength={10}
                  maxLength={500}
                  dir="ltr"
                />
              </Field>
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-1.5 p-0 text-xs font-semibold text-[var(--color-subtle)]">{say("الأحداث", "Events")}</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {data.events.map((ev) => (
                    <label key={ev} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={events.includes(ev)}
                        onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))}
                      />
                      {EVENT[ev] ? say(EVENT[ev][0], EVENT[ev][1]) : ev}
                      <span className="font-mono text-[0.6875rem] text-[var(--color-subtle)]" dir="ltr">{ev}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {formError && <p className="m-0 text-sm text-[var(--color-danger)]" role="alert">{formError}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                  {busy ? say("بيضيف…", "Adding…") : say("أضف", "Add")}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setFormError(null); }}>
                  {say("إلغاء", "Cancel")}
                </button>
              </div>
            </form>
          )}

          {data.endpoints.length === 0 ? (
            <p className="m-0 text-sm text-[var(--color-subtle)]">{say("لسه مفيش عناوين.", "No endpoints yet.")}</p>
          ) : (
            <ul className="m-0 list-none space-y-3 p-0">
              {data.endpoints.map((ep) => (
                <EndpointCard key={ep.id} ep={ep} base={base} lang={lang} onSecret={setSecret} onChanged={reload} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function EndpointCard({
  ep,
  base,
  lang,
  onSecret,
  onChanged,
}: {
  ep: Endpoint;
  base: string;
  lang: Lang;
  onSecret: (s: string) => void;
  onChanged: () => void;
}) {
  const { say } = useSay();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: "rotate" | "enable" | "disable" | "ping" | "delete") {
    setBusy(action);
    setNote(null);
    const r = await api<{ secret?: string; status?: string; code?: number; error?: string }>(
      `${base}/webhooks/${ep.id}`,
      "POST",
      { action },
    );
    setBusy(null);
    if (!r.ok) {
      setNote({ ok: false, text: r.data.error ?? say("حصلت مشكلة", "Something went wrong") });
      return;
    }
    if (action === "rotate" && r.data.secret) onSecret(r.data.secret);
    if (action === "ping") {
      const sent = r.data.status === "SENT";
      setNote({
        ok: sent,
        text: sent
          ? say(`وصل — رد بـ ${r.data.code ?? "?"}`, `Delivered — answered ${r.data.code ?? "?"}`)
          : say(
              `موصلش${r.data.code ? ` (${r.data.code})` : ""}${r.data.error ? `: ${r.data.error}` : ""}`,
              `Not delivered${r.data.code ? ` (${r.data.code})` : ""}${r.data.error ? `: ${r.data.error}` : ""}`,
            ),
      });
    }
    if (action === "delete") setConfirmDelete(false);
    onChanged();
  }

  const disabled = !!busy;
  return (
    <li className="card space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="m-0 break-all font-mono text-[0.8125rem] font-bold" dir="ltr">{ep.url}</p>
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {ep.events.map((ev) => (EVENT[ev] ? say(EVENT[ev][0], EVENT[ev][1]) : ev)).join(lang === "en" ? ", " : "، ")}
          </p>
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {say("آخر نجاح", "Last success")} {at(ep.lastSuccessAt, lang)} · {say("آخر فشل", "Last failure")} {at(ep.lastFailureAt, lang)}
            {ep.previousSecretUntil &&
              ` · ${say("السر القديم شغّال لحد", "Previous secret valid until")} ${at(ep.previousSecretUntil, lang)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ep.status === "ACTIVE" ? (
            ep.consecutiveFailures > 0 ? (
              <StatusChip tone="warn">{say(`${ep.consecutiveFailures} فشل ورا بعض`, `${ep.consecutiveFailures} failures in a row`)}</StatusChip>
            ) : (
              <StatusChip tone="jade">{say("شغّال", "Active")}</StatusChip>
            )
          ) : (
            <StatusChip tone="danger">{say("متوقف", "Disabled")}</StatusChip>
          )}
          {ep.disabledReason && <span className="text-xs text-[var(--color-subtle)]">{ep.disabledReason}</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={() => void run("ping")}>
          {busy === "ping" ? say("بيجرّب…", "Pinging…") : say("جرّب", "Ping")}
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={() => void run("rotate")}>
          {busy === "rotate" ? say("بيغيّر…", "Rotating…") : say("غيّر السر", "Rotate secret")}
        </button>
        {ep.status === "ACTIVE" ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => void run("disable")}>
            {say("وقّف", "Disable")}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => void run("enable")}>
            {say("شغّل", "Enable")}
          </button>
        )}
        {!confirmDelete && (
          <button type="button" className="btn btn-ghost btn-sm text-[var(--color-danger)]" disabled={disabled} onClick={() => setConfirmDelete(true)}>
            {say("امسح", "Delete")}
          </button>
        )}
      </div>

      {confirmDelete && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3" role="group" aria-label={say("تأكيد المسح", "Confirm deleting")}>
          <p className="m-0 flex-1">{say("العنوان ده مش هيستلم أحداث تاني. متأكد؟", "This endpoint will receive no more events. Are you sure?")}</p>
          <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => void run("delete")}>
            {busy === "delete" ? say("بيمسح…", "Deleting…") : say("أيوه، امسحه", "Yes, delete it")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => setConfirmDelete(false)}>
            {say("لأ", "No")}
          </button>
        </div>
      )}

      <p role="status" className={`m-0 min-h-4 text-sm ${note?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>
        {note?.text}
      </p>

      {ep.deliveries.length === 0 ? (
        <p className="m-0 text-xs text-[var(--color-subtle)]">{say("لسه مفيش إرسالات.", "No deliveries yet.")}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)]" role="region" tabIndex={0} aria-label={say("آخر الإرسالات", "Latest deliveries")}>
          <table className="w-full min-w-[44rem] text-[0.8125rem]">
            <caption className="sr-only">{say("آخر الإرسالات", "Latest deliveries")}</caption>
            <thead>
              <tr className="text-xs text-[var(--color-subtle)]">
                <th scope="col" className="p-2 text-start">{say("الحدث", "Event")}</th>
                <th scope="col" className="p-2 text-start">{say("الحالة", "Status")}</th>
                <th scope="col" className="p-2 text-start">{say("المحاولات", "Attempts")}</th>
                <th scope="col" className="p-2 text-start">HTTP</th>
                <th scope="col" className="p-2 text-start">{say("الخطأ", "Error")}</th>
                <th scope="col" className="p-2 text-start">{say("اتعمل", "Created")}</th>
                <th scope="col" className="p-2 text-start">{say("وصل / المحاولة الجاية", "Delivered / next try")}</th>
              </tr>
            </thead>
            <tbody>
              {ep.deliveries.map((d) => {
                const [ar, en, tone] = DELIVERY[d.status] ?? [d.status, d.status, "info"];
                return (
                  <tr key={d.id} className="border-t border-[var(--color-line)] align-top">
                    <td className="p-2 font-mono text-xs" dir="ltr">{d.eventType}</td>
                    <td className="p-2"><StatusChip tone={tone}>{say(ar, en)}</StatusChip></td>
                    <td className="num p-2">{d.attempts}</td>
                    <td className="num p-2">{d.lastStatusCode ?? "—"}</td>
                    <td className="max-w-[16rem] break-words p-2 text-xs">{d.lastError ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 text-xs">{at(d.createdAt, lang)}</td>
                    <td className="whitespace-nowrap p-2 text-xs">
                      {d.deliveredAt ? at(d.deliveredAt, lang) : d.nextAttemptAt && d.status !== "DEAD" ? at(d.nextAttemptAt, lang) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}
