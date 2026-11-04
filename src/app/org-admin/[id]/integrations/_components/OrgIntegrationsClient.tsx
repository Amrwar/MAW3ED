"use client";

import Link from "@/components/shared/LocaleLink";
import Alert from "@/components/ui/Alert";
import { Stat, StatusChip, useLoad, useSay } from "@/components/dashboard/kit";
import { num } from "@/lib/fmt";
import { Spinner, at } from "./bits";
import ApiKeysSection from "./ApiKeysSection";
import WebhooksSection from "./WebhooksSection";

interface Health {
  contract: {
    reference: string;
    startsAt: string;
    endsAt: string | null;
    inForce: boolean;
    maxApiClients: number;
    maxWebhooks: number;
    apiRequestsPerMinute: number;
  } | null;
  apiKeys: { ACTIVE?: number; REVOKED?: number };
  apiRequests30d: number;
  webhooks: {
    id: string;
    host: string;
    status: string;
    consecutiveFailures: number;
    disabledReason: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    dead24h: number;
  }[];
  venues: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    accessEnabled: boolean;
    provider: { slug: string; kind: string; enabled: boolean; lastHealthAt: string | null; lastHealthOk: boolean | null } | null;
    credential: { keyVersion: number; rotatedAt: string | null; revoked: boolean } | null;
    deadJobs24h: number;
  }[];
  subscriptions: { businessId: string; nameAr: string; plan: string; status: string; trialEndsAt: string | null }[];
}

const PLAN: Record<string, [string, string]> = { FREE: ["مجاني", "Free"], PRO: ["برو", "Pro"], PREMIUM: ["بريميوم", "Premium"] };
const SUB: Record<string, [string, string]> = { TRIAL: ["فترة تجربة", "Trial"], ACTIVE: ["شغّال", "Active"], INACTIVE: ["متوقف", "Inactive"] };

export default function OrgIntegrationsClient({
  organizationId,
  name,
  canManage,
}: {
  organizationId: string;
  name: { ar: string; en: string | null };
  canManage: boolean;
}) {
  const { lang, say } = useSay();
  const base = `/api/organizations/${organizationId}`;

  return (
    <main id="main" className="mx-auto max-w-5xl space-y-6 p-5 md:p-8" dir={lang === "en" ? "ltr" : "rtl"}>
      <header className="space-y-1">
        <Link href={`/org-admin/${organizationId}`} className="text-xs text-[var(--color-jade)] underline">
          {lang === "en" && name.en ? name.en : name.ar}
        </Link>
        <h1 className="m-0 text-2xl font-black">{say("الربط والتكامل", "Integrations")}</h1>
        <p className="m-0 max-w-[65ch] text-sm text-[var(--color-subtle)]">
          {say(
            "مفاتيح الـ API والـ webhooks بتسمح لأنظمتكم تقرا بيانات الجهة وتعرف بالحجوزات أول بأول. كل حاجة هنا قراءة بس — مفيش نظام خارجي يقدر يغيّر حجز أو نشاط.",
            "API keys and webhooks let your systems read the organization's data and hear about bookings as they happen. Everything is read-only — no outside system can change a booking or a business.",
          )}
        </p>
      </header>

      <HealthSection base={base} />
      {canManage && <ApiKeysSection base={base} />}
      {canManage && <WebhooksSection base={base} />}
    </main>
  );
}

function HealthSection({ base }: { base: string }) {
  const { lang, say } = useSay();
  const { data, error, loading } = useLoad<Health>(`${base}/integrations`);
  const w = (m: Record<string, [string, string]>, k: string) => (m[k] ? say(m[k][0], m[k][1]) : k);

  return (
    <section aria-labelledby="ih-h" className="space-y-4">
      <h2 id="ih-h" className="m-0 text-base font-extrabold">{say("الحالة والاتفاق", "Health & contract")}</h2>
      {loading && <Spinner />}
      {error && <Alert tone="danger">{error}</Alert>}
      {data && (
        <>
          {data.contract ? (
            <div className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="m-0 font-bold">
                  {say("الاتفاق", "Agreement")} <span dir="ltr">{data.contract.reference}</span>
                </p>
                {data.contract.inForce ? (
                  <StatusChip tone="jade">{say("ساري", "In force")}</StatusChip>
                ) : (
                  <StatusChip tone="muted">{say("مش ساري", "Not in force")}</StatusChip>
                )}
              </div>
              <dl className="m-0 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-[var(--color-subtle)]">{say("من", "From")}</dt>
                  <dd className="m-0">{at(data.contract.startsAt, lang)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--color-subtle)]">{say("لحد", "Until")}</dt>
                  <dd className="m-0">{data.contract.endsAt ? at(data.contract.endsAt, lang) : say("مفتوح", "Open-ended")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--color-subtle)]">{say("الحدود", "Limits")}</dt>
                  <dd className="m-0">
                    {say(
                      `${data.contract.maxApiClients} مفتاح · ${data.contract.maxWebhooks} webhook · ${data.contract.apiRequestsPerMinute} طلب/دقيقة`,
                      `${data.contract.maxApiClients} keys · ${data.contract.maxWebhooks} webhooks · ${data.contract.apiRequestsPerMinute} requests/min`,
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <Alert tone="info">
              {say(
                "مفيش اتفاق مع المنصة — أدوات الشركات (API والـ webhooks) بتتفعّل من إدارة موعد. كلّم الدعم لو محتاجها.",
                "No contract — enterprise tools are enabled by the platform; contact support.",
              )}
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={say("مفاتيح شغّالة", "Active keys")} value={num(data.apiKeys.ACTIVE ?? 0, lang)} />
            <Stat label={say("مفاتيح اتلغت", "Revoked keys")} value={num(data.apiKeys.REVOKED ?? 0, lang)} />
            <Stat label={say("طلبات API آخر 30 يوم", "API requests, last 30 days")} value={num(data.apiRequests30d, lang)} />
          </div>

          <div className="space-y-2">
            <h3 className="m-0 text-sm font-bold">{say("صحة الـ webhooks", "Webhook health")}</h3>
            {data.webhooks.length === 0 ? (
              <p className="m-0 text-sm text-[var(--color-subtle)]">{say("مفيش عناوين webhooks.", "No webhook endpoints.")}</p>
            ) : (
              <ul className="card m-0 list-none divide-y divide-[var(--color-line)] p-0">
                {data.webhooks.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span className="font-mono text-[0.8125rem]" dir="ltr">{h.host || "—"}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-subtle)]">
                      {h.status === "ACTIVE" ? (
                        h.consecutiveFailures > 0 ? (
                          <StatusChip tone="warn">{say(`${h.consecutiveFailures} فشل ورا بعض`, `${h.consecutiveFailures} failures in a row`)}</StatusChip>
                        ) : (
                          <StatusChip tone="jade">{say("شغّال", "Healthy")}</StatusChip>
                        )
                      ) : (
                        <StatusChip tone="danger">{say("متوقف", "Disabled")}</StatusChip>
                      )}
                      {h.disabledReason && <span>{h.disabledReason}</span>}
                      <span>{say("آخر نجاح:", "Last success:")} {at(h.lastSuccessAt, lang)}</span>
                      <span>{say("آخر فشل:", "Last failure:")} {at(h.lastFailureAt, lang)}</span>
                      {h.dead24h > 0 && <StatusChip tone="danger">{say(`${h.dead24h} اتساب آخر 24 ساعة`, `${h.dead24h} dead in 24h`)}</StatusChip>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="m-0 text-sm font-bold">{say("دخول الزوار", "Visitor access")}</h3>
            {data.venues.length === 0 ? (
              <p className="m-0 text-sm text-[var(--color-subtle)]">{say("مفيش أماكن تبع الجهة.", "The organization has no venues.")}</p>
            ) : (
              <div className="card overflow-x-auto p-0" role="region" tabIndex={0} aria-labelledby="iv-cap">
                <table className="w-full min-w-[40rem] text-sm">
                  <caption id="iv-cap" className="sr-only">{say("دخول الزوار في كل مكان", "Visitor access per venue")}</caption>
                  <thead>
                    <tr className="text-start text-xs text-[var(--color-subtle)]">
                      <th scope="col" className="p-3 text-start">{say("المكان", "Venue")}</th>
                      <th scope="col" className="p-3 text-start">{say("التصاريح", "Passes")}</th>
                      <th scope="col" className="p-3 text-start">{say("المزوّد", "Provider")}</th>
                      <th scope="col" className="p-3 text-start">{say("مفتاح المكان", "Venue credential")}</th>
                      <th scope="col" className="p-3 text-start">{say("مهام فشلت (24 ساعة)", "Dead jobs (24h)")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.venues.map((v) => (
                      <tr key={v.id} className="border-t border-[var(--color-line)] align-top">
                        <td className="p-3 font-bold">{lang === "en" && v.nameEn ? v.nameEn : v.nameAr}</td>
                        <td className="p-3">
                          {v.accessEnabled ? <StatusChip tone="jade">{say("شغّالة", "On")}</StatusChip> : <StatusChip tone="muted">{say("مقفولة", "Off")}</StatusChip>}
                        </td>
                        <td className="p-3">
                          {!v.provider ? (
                            <span className="text-[var(--color-subtle)]">{say("من غير مزوّد", "None")}</span>
                          ) : (
                            <div className="space-y-1">
                              <span className="block font-mono text-xs" dir="ltr">{v.provider.slug}</span>
                              {!v.provider.enabled ? (
                                <StatusChip tone="muted">{say("مقفول", "Disabled")}</StatusChip>
                              ) : v.provider.lastHealthOk === true ? (
                                <StatusChip tone="jade">{say("سليم", "OK")}</StatusChip>
                              ) : v.provider.lastHealthOk === false ? (
                                <StatusChip tone="danger">{say("فيه مشكلة", "Failing")}</StatusChip>
                              ) : (
                                <StatusChip tone="muted">{say("مش معروف", "Unknown")}</StatusChip>
                              )}
                              {v.provider.lastHealthAt && (
                                <span className="block text-xs text-[var(--color-subtle)]">{at(v.provider.lastHealthAt, lang)}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {!v.credential ? (
                            <span className="text-[var(--color-subtle)]">{say("مفيش", "None")}</span>
                          ) : (
                            <div className="space-y-1">
                              <span className="block">{say(`إصدار ${v.credential.keyVersion}`, `Version ${v.credential.keyVersion}`)}</span>
                              {v.credential.revoked && <StatusChip tone="danger">{say("اتلغى", "Revoked")}</StatusChip>}
                              {v.credential.rotatedAt && (
                                <span className="block text-xs text-[var(--color-subtle)]">{say("اتغيّر", "Rotated")} {at(v.credential.rotatedAt, lang)}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {v.deadJobs24h > 0 ? <StatusChip tone="danger">{num(v.deadJobs24h, lang)}</StatusChip> : <span className="num">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="m-0 text-sm font-bold">{say("باقات الأنشطة المملوكة اللي بتشارك الحسابات", "Plans of owned brands that share finance")}</h3>
            {data.subscriptions.length === 0 ? (
              <p className="m-0 text-sm text-[var(--color-subtle)]">{say("مفيش أنشطة بتشارك الحسابات.", "No owned brands share finance.")}</p>
            ) : (
              <div className="card overflow-x-auto p-0" role="region" tabIndex={0} aria-labelledby="is-cap">
                <table className="w-full min-w-[28rem] text-sm">
                  <caption id="is-cap" className="sr-only">{say("باقات الأنشطة", "Brand plans")}</caption>
                  <thead>
                    <tr className="text-xs text-[var(--color-subtle)]">
                      <th scope="col" className="p-3 text-start">{say("النشاط", "Brand")}</th>
                      <th scope="col" className="p-3 text-start">{say("الباقة", "Plan")}</th>
                      <th scope="col" className="p-3 text-start">{say("الحالة", "Status")}</th>
                      <th scope="col" className="p-3 text-start">{say("التجربة بتخلص", "Trial ends")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptions.map((s) => (
                      <tr key={s.businessId} className="border-t border-[var(--color-line)]">
                        <td className="p-3">{s.nameAr}</td>
                        <td className="p-3">{w(PLAN, s.plan)}</td>
                        <td className="p-3">
                          <StatusChip tone={s.status === "ACTIVE" ? "jade" : s.status === "TRIAL" ? "info" : "muted"}>{w(SUB, s.status)}</StatusChip>
                        </td>
                        <td className="p-3">{s.status === "TRIAL" ? at(s.trialEndsAt, lang) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
