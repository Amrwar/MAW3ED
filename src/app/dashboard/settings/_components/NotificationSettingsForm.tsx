"use client";

import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Toggle from "@/components/ui/Toggle";
import { useLanguage } from "@/contexts/LanguageContext";

export interface NotificationPrefs {
  notifyByEmail: boolean;
  notifyByWhatsApp: boolean;
  notifyNewBooking: boolean;
  notifyCancellation: boolean;
  notifyPayment: boolean;
  notificationEmail: string | null;
  notificationPhone: string | null;
  reminderEnabled: boolean;
  reminderLeadHours: number;
  startingSoonEnabled: boolean;
  startingSoonLeadMins: number;
  reviewRequestEnabled: boolean;
}

/**
 * What this business hears about, and what its customers hear.
 *
 * Switches save as they are flipped; the two address fields save when
 * they lose focus, because saving on every keystroke would write a
 * half-typed email address to the database.
 */
export default function NotificationSettingsForm({
  initial,
  whatsappAvailable,
}: {
  initial: NotificationPrefs;
  whatsappAvailable: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [p, setP] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Partial<NotificationPrefs>) {
    const previous = p;
    setP((cur) => ({ ...cur, ...patch }));
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        // Put it back: a switch that stays on after a failed save is a
        // lie about what the server holds.
        setP(previous);
        setError(d.error ?? (ar ? "حصل خطأ أثناء الحفظ" : "Could not save"));
      }
    } catch {
      setP(previous);
      setError(ar ? "حصل خطأ أثناء الحفظ" : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const LEAD_HOURS = [1, 2, 3, 6, 12, 24, 48, 72];
  const SOON_MINS = [15, 30, 60, 120, 180, 360];

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-[var(--color-surface-3)] bg-[var(--color-ground)] px-5 py-3.5">
        <Bell size={17} className="text-[var(--color-jade)]" aria-hidden="true" />
        <h2 className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">
          {ar ? "الإشعارات" : "Notifications"}
        </h2>
        {saving && (
          <Loader2
            size={14}
            className="animate-spin text-[var(--color-subtle)]"
            aria-label={ar ? "بيحفظ" : "Saving"}
          />
        )}
      </header>

      <div className="space-y-6 p-5">
        {error && <Alert tone="danger">{error}</Alert>}

        {/* ── How we reach you ───────────────────────────── */}
        <div>
          <h3 className="m-0 mb-2 text-[0.8125rem] font-bold text-[var(--color-muted)]">
            {ar ? "إزاي نوصلك" : "How we reach you"}
          </h3>
          <Toggle
            label={ar ? "بالإيميل" : "By email"}
            checked={p.notifyByEmail}
            onChange={(v) => save({ notifyByEmail: v })}
          />
          <Toggle
            label={ar ? "بالواتساب" : "By WhatsApp"}
            hint={
              whatsappAvailable
                ? undefined
                : ar
                  ? "الواتساب متاح في باقة Growth وما فوقها."
                  : "WhatsApp is available on Growth and above."
            }
            checked={p.notifyByWhatsApp && whatsappAvailable}
            disabled={!whatsappAvailable}
            onChange={(v) => save({ notifyByWhatsApp: v })}
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              label={ar ? "إيميل الإشعارات" : "Notification email"}
              hint={ar ? "سيبه فاضي عشان يروح لإيميلك" : "Leave empty to use your own"}
              type="email"
              dir="ltr"
              defaultValue={p.notificationEmail ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (p.notificationEmail ?? "")) save({ notificationEmail: v });
              }}
            />
            <Input
              label={ar ? "رقم الإشعارات" : "Notification number"}
              hint={ar ? "سيبه فاضي عشان يروح لرقم المكان" : "Leave empty to use the business number"}
              dir="ltr"
              defaultValue={p.notificationPhone ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (p.notificationPhone ?? "")) save({ notificationPhone: v });
              }}
            />
          </div>
        </div>

        {/* ── What you hear about ────────────────────────── */}
        <div>
          <h3 className="m-0 mb-2 text-[0.8125rem] font-bold text-[var(--color-muted)]">
            {ar ? "تحب نعلّمك بإيه" : "What you hear about"}
          </h3>
          <Toggle
            label={ar ? "حجز جديد" : "A new booking"}
            checked={p.notifyNewBooking}
            onChange={(v) => save({ notifyNewBooking: v })}
          />
          <Toggle
            label={ar ? "إلغاء حجز" : "A cancellation"}
            checked={p.notifyCancellation}
            onChange={(v) => save({ notifyCancellation: v })}
          />
          <Toggle
            label={ar ? "الدفع" : "Payments"}
            checked={p.notifyPayment}
            onChange={(v) => save({ notifyPayment: v })}
          />
          <p className="mt-2 px-2 text-[0.75rem] text-[var(--color-subtle)]">
            {ar
              ? "حاجات زي انتهاء الاشتراك هنبعتهالك دايمًا — صفحتك بتختفي من غيرها."
              : "Things like a lapsing subscription are always sent — your page comes down without it."}
          </p>
        </div>

        {/* ── What your customers hear ───────────────────── */}
        <div>
          <h3 className="m-0 mb-2 text-[0.8125rem] font-bold text-[var(--color-muted)]">
            {ar ? "اللي عملاؤك بيوصلهم" : "What your customers hear"}
          </h3>

          <Toggle
            label={ar ? "تذكير قبل الموعد" : "A reminder before the appointment"}
            checked={p.reminderEnabled}
            onChange={(v) => save({ reminderEnabled: v })}
          />
          {p.reminderEnabled && (
            <div className="mb-3 ms-12 max-w-[14rem]">
              <Select
                label={ar ? "قبل الموعد بـ" : "How long before"}
                value={String(p.reminderLeadHours)}
                onChange={(e) => save({ reminderLeadHours: Number(e.target.value) })}
              >
                {LEAD_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hoursLabel(h, ar)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Toggle
            label={ar ? "تنبيه تاني قبل الموعد بشوية" : "A second nudge shortly before"}
            hint={
              ar
                ? "رسالة زيادة لحد خد تذكير قبل كده — اختياري."
                : "An extra message to somebody already reminded — optional."
            }
            checked={p.startingSoonEnabled}
            onChange={(v) => save({ startingSoonEnabled: v })}
          />
          {p.startingSoonEnabled && (
            <div className="mb-3 ms-12 max-w-[14rem]">
              <Select
                label={ar ? "قبل الموعد بـ" : "How long before"}
                value={String(p.startingSoonLeadMins)}
                onChange={(e) => save({ startingSoonLeadMins: Number(e.target.value) })}
              >
                {SOON_MINS.map((m) => (
                  <option key={m} value={m}>
                    {minsLabel(m, ar)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Toggle
            label={ar ? "طلب تقييم بعد الزيارة" : "Ask for a review afterwards"}
            checked={p.reviewRequestEnabled}
            onChange={(v) => save({ reviewRequestEnabled: v })}
          />
        </div>
      </div>
    </section>
  );
}

function hoursLabel(h: number, ar: boolean): string {
  if (!ar) return h === 1 ? "1 hour" : h < 24 ? `${h} hours` : h === 24 ? "1 day" : `${h / 24} days`;
  if (h === 1) return "ساعة";
  if (h === 2) return "ساعتين";
  if (h < 24) return `${h} ساعات`;
  if (h === 24) return "يوم";
  if (h === 48) return "يومين";
  return `${h / 24} أيام`;
}

function minsLabel(m: number, ar: boolean): string {
  if (!ar) return m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`;
  if (m < 60) return `${m} دقيقة`;
  if (m === 60) return "ساعة";
  if (m === 120) return "ساعتين";
  return `${m / 60} ساعات`;
}
