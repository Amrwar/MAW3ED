"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Download, ExternalLink, Trash2 } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import ImageUpload from "@/components/shared/ImageUpload";
import ScopePicker from "@/components/organizations/ScopePicker";
import ManageBusinessButton from "@/components/organizations/ManageBusinessButton";
import { RELATIONSHIP_HINTS, RELATIONSHIP_LABELS, SCOPE_LABELS, type Relationship } from "@/lib/organizations/scopes";
import { useLanguage } from "@/contexts/LanguageContext";

interface Org {
  id: string; slug: string; kind: string; status: string; isPublished: boolean;
  nameAr: string; nameEn: string | null; descriptionAr: string | null; descriptionEn: string | null;
  phone: string | null; email: string | null; instagram: string | null; facebook: string | null;
  address: string | null; website: string | null;
  logoImage: string | null; coverImage: string | null; cityId: string | null;
  /** The administrator's written reason, when REJECTED or SUSPENDED. */
  statusReason: string | null;
  parent: { id: string; slug: string; nameAr: string; nameEn: string | null } | null;
  _count: { children: number };
  venues: { id: string; slug: string; nameAr: string; nameEn: string | null; status: string; isPublished: boolean }[];
  roles: { id: string; kind: string; user: { name: string | null; email: string | null } }[];
  invites: { id: string; email: string; relation: string; token: string; expiresAt: string }[];
}
interface Association {
  id: string; status: string; relation: string; section: string | null; sortOrder: number; note: string | null;
  requestedScopes: string[]; scopes: string[]; expiresAt: string | null; suspendedAt: string | null;
  branch: { id: string; nameAr: string; nameEn: string | null } | null;
  business: { id: string; slug: string; nameAr: string; nameEn: string | null; isPublished: boolean; category: { nameAr: string; nameEn: string } | null; city: { nameAr: string; nameEn: string } | null };
}
interface Metrics { windowDays: number; viewsTotal: number; views: Record<string, number>; attributedBookings: number; perBusiness: { nameAr: string; count: number }[] }

const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const json = ((await res?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  return { ok: !!res?.ok, status: res?.status ?? 0, json };
}

type City = { id: string; nameAr: string; nameEn: string };

export default function OrgConsole({ organizationId, cities }: { organizationId: string; cities: City[] }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const base = `/api/organizations/${organizationId}`;

  const [org, setOrg] = useState<Org | null>(null);
  const [can, setCan] = useState({ edit: false, publish: false, members: false, review: false });
  const [associations, setAssociations] = useState<Association[]>([]);
  // One page of associations at a time: a large organization's console
  // never loads its whole portfolio.
  const [assocPage, setAssocPage] = useState(1);
  const [assocMeta, setAssocMeta] = useState({ total: 0, approved: 0, pages: 1 });
  const [parentOptions, setParentOptions] = useState<{ id: string; nameAr: string; nameEn: string | null }[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [audit, setAudit] = useState<{ id: string; summary: string; at: string }[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [failure, setFailure] = useState<"signin" | "gone" | "error" | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [o, a, m, au] = await Promise.all([api(base), api(`${base}/businesses?page=${assocPage}`), api(`${base}/metrics`), api(`${base}/audit`)]);
    if (!o.ok) {
      setFailure(o.status === 401 ? "signin" : o.status === 404 ? "gone" : "error");
      return;
    }
    setFailure(null);
    setOrg(o.json.organization as Org);
    setCan(o.json.can as typeof can);
    if (a.ok) {
      setAssociations(a.json.associations as Association[]);
      setAssocMeta({ total: Number(a.json.total ?? 0), approved: Number(a.json.approved ?? 0), pages: Number(a.json.pages ?? 1) });
    }
    setParentOptions((o.json.parentOptions as typeof parentOptions) ?? []);
    if (m.ok) setMetrics(m.json as unknown as Metrics);
    if (au.ok) setAudit((au.json.entries as typeof audit) ?? []);
  }, [base, assocPage]);

  useEffect(() => {
    let live = true;
    void (async () => {
      if (live) await load();
    })();
    return () => {
      live = false;
    };
  }, [load]);

  async function act(path: string, method: string, body?: unknown, done?: string) {
    setMsg(null);
    const r = await api(path, method, body);
    setMsg({ ok: r.ok, text: r.ok ? done ?? t("اتحفظ.", "Saved.") : String(r.json.error ?? t("حصلت مشكلة.", "Something went wrong.")) });
    if (r.ok || r.status === 401 || r.status === 404) await load();
    return r.ok;
  }

  if (failure) {
    return (
      <main id="main" className="mx-auto max-w-xl space-y-3 p-8 text-sm" dir={en ? "ltr" : "rtl"} role="alert">
        <p className="m-0 font-bold">
          {failure === "signin"
            ? t("الجلسة خلصت. سجّل دخولك تاني.", "Your session has ended. Please sign in again.")
            : failure === "gone"
              ? t("مبقاش عندك صلاحية على الجهة دي.", "You no longer have access to this organization.")
              : t("مقدرناش نحمّل الجهة. جرّب تاني.", "Could not load. Try again shortly.")}
        </p>
        {failure === "signin" ? (
          <Link href={`/login?next=/org-admin/${organizationId}`} className="btn btn-primary btn-sm">{t("تسجيل الدخول", "Sign in")}</Link>
        ) : failure === "gone" ? (
          <Link href="/org-admin" className="btn btn-outline btn-sm">{t("الجهات اللي بتديرها", "Your organizations")}</Link>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>{t("جرّب تاني", "Try again")}</button>
        )}
      </main>
    );
  }
  if (!org) return <main className="p-8 text-sm text-[var(--color-subtle)]" aria-busy="true">{t("بنحمّل…", "Loading…")}</main>;

  const nm = (x: { nameAr: string; nameEn?: string | null }) => (en ? x.nameEn || x.nameAr : x.nameAr);
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/groups/${org.slug}`;
  const STATUS: Record<string, [string, string]> = {
    PENDING: ["قيد مراجعة موعد — هتقدر تدعو أنشطة وتنشر الصفحة بعد الاعتماد", "Under Maw3ed review — inviting businesses and publishing open up once approved"],
    APPROVED: ["معتمدة", "Approved"],
    REJECTED: ["مرفوضة", "Rejected"],
    SUSPENDED: ["موقوفة من موعد", "Suspended by Maw3ed"],
  };

  return (
    <main id="main" className="mx-auto max-w-5xl space-y-6 p-5 md:p-8" dir={en ? "ltr" : "rtl"}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/org-admin" className="text-xs text-[var(--color-jade)] underline">{t("كل الجهات", "All organizations")}</Link>
          <h1 className="m-0 text-2xl font-black">{nm(org)}</h1>
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {en ? STATUS[org.status]?.[1] : STATUS[org.status]?.[0]}
            {org.status === "APPROVED" ? (org.isPublished ? t(" · الصفحة منشورة", " · page public") : t(" · الصفحة مش منشورة", " · page not public")) : ""}
          </p>
          {(org.status === "REJECTED" || org.status === "SUSPENDED") && (
            <p className="m-0 text-xs" role="status">
              <span className="font-bold">{t("السبب: ", "Reason: ")}</span>
              {org.statusReason ?? t("مفيش سبب مكتوب.", "No reason was written.")}
              {t(" — للاستفسار كلّم الدعم.", " — contact support with questions.")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {org.isPublished && (
            <Link href={`/groups/${org.slug}`} target="_blank" className="btn btn-outline btn-sm gap-1.5">
              <ExternalLink size={14} aria-hidden="true" />
              {t("الصفحة العامة", "Public page")}
            </Link>
          )}
          {can.publish && org.status === "APPROVED" && (
            <button type="button" className={`btn btn-sm ${org.isPublished ? "btn-outline" : "btn-primary"}`} onClick={() => act(base, "PATCH", { isPublished: !org.isPublished }, org.isPublished ? t("اتخفت.", "Hidden.") : t("اتنشرت.", "Published."))}>
              {org.isPublished ? t("اخفي الصفحة", "Hide page") : t("انشر الصفحة", "Publish page")}
            </button>
          )}
        </div>
      </header>

      <p role="status" className={`m-0 min-h-5 text-sm ${msg?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg?.text}</p>

      <section aria-labelledby="link-h" className="card space-y-2 p-5">
        <h2 id="link-h" className="m-0 text-base font-extrabold">{t("الرابط والـ QR", "Link and QR")}</h2>
        <p className="m-0 break-all text-sm" dir="ltr">{publicUrl}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1.5"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? t("اتنسخ", "Copied") : t("انسخ الرابط", "Copy link")}
          </button>
          <a href={`${base}/qr?format=svg`} className="btn btn-outline btn-sm gap-1.5">
            <Download size={14} aria-hidden="true" />
            QR (SVG)
          </a>
          <a href={`${base}/qr?format=png`} className="btn btn-outline btn-sm gap-1.5">
            <Download size={14} aria-hidden="true" />
            QR (PNG)
          </a>
        </div>
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {t("الكود ده رابط دعائي لصفحة الدليل — مش تصريح دخول ولا بيثبت حاجة.", "This code is a marketing link to the directory page — not an entry pass, and it proves nothing.")}
        </p>
      </section>

      {metrics && (
        <section aria-labelledby="m-h" className="card space-y-2 p-5">
          <h2 id="m-h" className="m-0 text-base font-extrabold">{t(`آخر ${metrics.windowDays} يوم`, `Last ${metrics.windowDays} days`)}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={t("زيارات الصفحة", "Page visits")} value={metrics.viewsTotal} />
            <Tile label={t("منها QR", "From QR")} value={metrics.views.QR ?? 0} />
            <Tile label={t("حجوزات جت من الصفحة", "Bookings from the page")} value={metrics.attributedBookings} />
            <Tile label={t("أنشطة مرتبطة", "Linked businesses")} value={assocMeta.approved} />
          </div>
          {metrics.perBusiness.length > 0 && (
            <ul className="m-0 list-none space-y-1 p-0 text-sm">
              {metrics.perBusiness.slice(0, 8).map((b) => (
                <li key={b.nameAr} className="flex justify-between gap-3">
                  <span>{b.nameAr}</span>
                  <span className="num text-[var(--color-subtle)]">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {t("أرقام بس. بيانات العملاء وحجوزاتهم وفلوس الأنشطة بتفضل عند كل نشاط.", "Counts only. Customers, their bookings and each business's money stay with that business.")}
          </p>
        </section>
      )}

      <Businesses
        t={t}
        en={en}
        nm={nm}
        associations={associations}
        canManage={can.edit}
        onAct={act}
        base={base}
        orgStatus={org.status}
        invites={org.invites}
        page={assocPage}
        pages={assocMeta.pages}
        total={assocMeta.total}
        onPage={setAssocPage}
      />

      {can.members && (
        <ParentSection t={t} nm={nm} org={org} options={parentOptions} onSet={(parentId) => act(`${base}/parent`, "PUT", { parentId }, t("اتحفظ.", "Saved."))} />
      )}

      {can.edit && <ProfileForm t={t} en={en} org={org} cities={cities} onSave={(profile) => act(base, "PATCH", { profile })} />}

      {can.members && (
        <section aria-labelledby="mem-h" className="card space-y-3 p-5">
          <h2 id="mem-h" className="m-0 text-base font-extrabold">{t("الأعضاء", "Members")}</h2>
          <ul className="m-0 list-none space-y-1 p-0 text-sm">
            {org.roles.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>
                  {r.user.name ?? "—"} <span className="text-xs text-[var(--color-subtle)]" dir="ltr">{r.user.email}</span>
                  {" — "}
                  {r.kind === "ORGANIZATION_OWNER" ? t("مالك", "Owner") : t("مدير", "Manager")}
                </span>
                {r.kind === "ORGANIZATION_ADMIN" && (
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={t("سحب الدور", "Remove")} onClick={() => act(`${base}/members/${r.id}`, "DELETE", undefined, t("اتسحب.", "Removed."))}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <AddMember t={t} onAdd={(email) => act(`${base}/members`, "POST", { email }, t("اتضاف.", "Added."))} />
        </section>
      )}

      {audit.length > 0 && (
        <section aria-labelledby="au-h" className="card space-y-2 p-5">
          <h2 id="au-h" className="m-0 text-base font-extrabold">{t("سجل النشاط", "Audit log")}</h2>
          <ul className="m-0 list-none space-y-1 p-0 text-xs text-[var(--color-muted)]">
            {audit.slice(0, 15).map((e) => (
              <li key={e.id}>
                <span className="num" dir="ltr">{e.at.slice(0, 16).replace("T", " ")}</span> — {e.summary}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <p className="m-0 text-xs text-[var(--color-subtle)]">{label}</p>
      <p className="num m-0 text-xl font-bold">{value}</p>
    </div>
  );
}

type T = (ar: string, en: string) => string;
type Act = (path: string, method: string, body?: unknown, done?: string) => Promise<boolean>;

function Businesses({ t, en, nm, associations, canManage, onAct, base, orgStatus, invites, page, pages, total, onPage }: {
  t: T;
  en: boolean;
  nm: (x: { nameAr: string; nameEn?: string | null }) => string;
  associations: Association[];
  canManage: boolean;
  onAct: Act;
  base: string;
  orgStatus: string;
  invites: Org["invites"];
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const [slug, setSlug] = useState("");
  const [relation, setRelation] = useState<Relationship>("HOSTED");
  const [requested, setRequested] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRelation, setInviteRelation] = useState<Relationship>("OWNED");
  const [inviteScopes, setInviteScopes] = useState<string[]>(["RESERVATIONS"]);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const label: Record<string, string> = {
    INVITED: t("دعوة مبعوتة", "Invited"), REQUESTED: t("طلب جديد", "Requested"), APPROVED: t("مرتبط", "Linked"),
    SUSPENDED: t("موقوف مؤقتًا", "Paused"), DECLINED: t("رفض الدعوة", "Declined"), REJECTED: t("مرفوض", "Rejected"), REMOVED: t("اتشال", "Removed"),
  };
  const relName = (r: string) => {
    const l = RELATIONSHIP_LABELS[r as Relationship];
    return l ? (en ? l[1] : l[0]) : r;
  };
  const scopeNames = (list: string[]) =>
    list.map((sc) => SCOPE_LABELS[sc as keyof typeof SCOPE_LABELS]?.[en ? 1 : 0] ?? sc).join(en ? ", " : "، ");
  const relOptions = (["HOSTED", "OWNED", "MANAGED"] as const).map((r) => (
    <option key={r} value={r}>{relName(r)}</option>
  ));

  return (
    <section aria-labelledby="biz-h" className="card space-y-4 p-5">
      <h2 id="biz-h" className="m-0 text-base font-extrabold">{t("الأنشطة", "Businesses")}</h2>
      {orgStatus !== "APPROVED" && (
        <p className="m-0 text-xs text-[var(--color-warn)]">{t("الدعوات متاحة بعد اعتماد موعد للجهة.", "Inviting opens once Maw3ed approves the organization.")}</p>
      )}

      {associations.length === 0 ? (
        <p className="m-0 text-sm text-[var(--color-subtle)]">{t("لسه مفيش أنشطة.", "No businesses yet.")}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-[var(--color-line)] p-0">
          {associations.map((a) => (
            <li key={a.id} className="space-y-2 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0">
                  <span className="font-bold">{nm(a.business)}</span>
                  {a.branch ? ` · ${nm(a.branch)}` : ""}
                  {a.business.category ? <span className="text-xs text-[var(--color-subtle)]"> · {nm(a.business.category)}</span> : null}
                  <span className="text-xs text-[var(--color-subtle)]"> · {relName(a.relation)}</span>
                  {!a.business.isPublished && a.status === "APPROVED" && (
                    <span className="text-xs text-[var(--color-warn)]"> · {t("صفحته مش منشورة — مش ظاهر", "its page is not public — not shown")}</span>
                  )}
                </p>
                <span className="badge">{label[a.status] ?? a.status}</span>
              </div>
              {(a.relation === "OWNED" || a.relation === "MANAGED") && (
                <p className="m-0 text-xs text-[var(--color-subtle)]">
                  {a.scopes.length
                    ? <>{t("صاحب النشاط سمح بـ: ", "The business granted: ")}{scopeNames(a.scopes)}</>
                    : t("لسه مفيش صلاحيات ممنوحة من صاحب النشاط.", "No access granted by the business yet.")}
                  {a.expiresAt ? <> · {t("لحد ", "until ")}<span className="num" dir="ltr">{a.expiresAt.slice(0, 10)}</span></> : null}
                  {a.status === "INVITED" && a.requestedScopes.length ? <> · {t("مطلوب: ", "requested: ")}{scopeNames(a.requestedScopes)}</> : null}
                </p>
              )}
              {canManage && (a.status === "REQUESTED" || a.status === "APPROVED" || a.status === "SUSPENDED" || a.status === "INVITED") && (
                <AssocActions t={t} a={a} base={base} onAct={onAct} />
              )}
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label={t("صفحات الأنشطة", "Business pages")} className="flex items-center gap-2 text-sm">
          <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("السابق", "Previous")}</button>
          <span className="num">{page} / {pages}</span>
          <span className="text-xs text-[var(--color-subtle)]">({total})</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t("التالي", "Next")}</button>
        </nav>
      )}

      {canManage && orgStatus === "APPROVED" && (
        <>
          <form
            className="flex flex-wrap items-end gap-2 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              const body = { businessSlug: slug.trim(), relation, requestedScopes: relation === "HOSTED" ? [] : requested };
              if (await onAct(`${base}/businesses`, "POST", body, t("الدعوة اتبعتت لصاحب النشاط.", "Invitation sent to the business owner."))) {
                setSlug("");
                setRequested([]);
              }
            }}
          >
            <label className="space-y-1">
              <span className="block text-xs font-bold">{t("ادعُ نشاط موجود (برابطه)", "Invite an existing business (by its link)")}</span>
              <span className="flex items-center gap-1" dir="ltr">
                <span className="text-xs text-[var(--color-subtle)]">maw3ed.net/company/</span>
                <input className={field} value={slug} onChange={(e) => setSlug(e.target.value)} required minLength={3} />
              </span>
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-bold">{t("نوع العلاقة", "Relationship")}</span>
              <select className={field} value={relation} onChange={(e) => { setRelation(e.target.value as Relationship); setRequested([]); }}>
                {relOptions}
              </select>
            </label>
            <button type="submit" className="btn btn-outline btn-sm">{t("ابعت الدعوة", "Invite")}</button>
            <p className="m-0 w-full text-xs text-[var(--color-subtle)]">{en ? RELATIONSHIP_HINTS[relation][1] : RELATIONSHIP_HINTS[relation][0]}</p>
            <div className="w-full">
              <ScopePicker relation={relation} value={requested} onChange={setRequested} en={en} legend={t("الصلاحيات اللي بتطلبها (صاحب النشاط بيقرر):", "Access you are asking for (the business decides):")} />
            </div>
          </form>

          <form
            className="flex flex-wrap items-end gap-2 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await fetch(`${base}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), relation: inviteRelation, requestedScopes: inviteRelation === "HOSTED" ? [] : inviteScopes }),
              }).catch(() => null);
              const json = ((await r?.json().catch(() => ({}))) ?? {}) as { invite?: { link: string; emailed: boolean }; error?: string };
              if (r?.ok && json.invite) {
                setLastLink(json.invite.link);
                setEmail("");
                await onAct(`${base}/audit`, "GET");
              }
            }}
          >
            <label className="min-w-[14rem] flex-1 space-y-1">
              <span className="block text-xs font-bold">{t("ادعُ حد ينشئ نشاط جديد تحت الجهة (بالإيميل)", "Invite somebody to create a new business under the organization (by email)")}</span>
              <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-bold">{t("نوع العلاقة", "Relationship")}</span>
              <select className={field} value={inviteRelation} onChange={(e) => setInviteRelation(e.target.value as Relationship)}>
                {relOptions}
              </select>
            </label>
            <button type="submit" className="btn btn-outline btn-sm">{t("اعمل دعوة", "Create invite")}</button>
            <div className="w-full">
              <ScopePicker relation={inviteRelation} value={inviteScopes} onChange={setInviteScopes} en={en} legend={t("الصلاحيات (هتتعرض على صاحب النشاط الجديد قبل ما ينشئه):", "Access (shown to the new owner before they create the business):")} />
            </div>
          </form>
          {lastLink && (
            <p className="m-0 break-all text-xs text-[var(--color-muted)]" dir="ltr">
              {t("رابط الدعوة (ابعته لو الإيميل موصلش): ", "Invite link (share it if the email does not arrive): ")}
              {lastLink}
            </p>
          )}
          {invites.length > 0 && (
            <ul className="m-0 list-none space-y-1 p-0 text-xs text-[var(--color-subtle)]">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span dir="ltr">{i.email}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAct(`${base}/invites/${i.id}`, "DELETE", undefined, t("اتلغت.", "Cancelled."))}>
                    {t("الغي", "Cancel")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="m-0 text-xs text-[var(--color-subtle)]">
        {t(
          "شيل نشاط مش بيمسح منه حاجة: صاحبه بيفضل مالكه بكل بياناته وحجوزاته. الصلاحيات بيمنحها صاحب النشاط بس، ويقدر يسحبها في أي وقت.",
          "Removing a business deletes nothing: its owner keeps it with all its data and bookings. Access is granted by the business owner alone, who can withdraw it at any time.",
        )}
      </p>
    </section>
  );
}

function ParentSection({ t, nm, org, options, onSet }: {
  t: T;
  nm: (x: { nameAr: string; nameEn?: string | null }) => string;
  org: Org;
  options: { id: string; nameAr: string; nameEn: string | null }[];
  onSet: (parentId: string | null) => Promise<boolean>;
}) {
  const [choice, setChoice] = useState("");
  return (
    <section aria-labelledby="par-h" className="card space-y-2 p-5">
      <h2 id="par-h" className="m-0 text-base font-extrabold">{t("الجهة الأم", "Parent organization")}</h2>
      <p className="m-0 text-xs text-[var(--color-subtle)]">
        {t(
          "لو الجهة دي تبع شركة أكبر بتملكها إنت كمان (زي شركة قابضة فوق مول). ممنوع الدواير، وأقصى حاجة 3 مستويات.",
          "If this organization belongs to a larger one you also own (a holding company over a mall). No cycles; at most three levels.",
        )}
      </p>
      {org.parent ? (
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
          {t("تابعة لـ ", "Part of ")}<span className="font-bold">{nm(org.parent)}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onSet(null)}>{t("فك الارتباط", "Unlink")}</button>
        </p>
      ) : options.length ? (
        <form
          className="flex flex-wrap items-end gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (choice) void onSet(choice);
          }}
        >
          <label className="space-y-1">
            <span className="block text-xs font-bold">{t("اختار الجهة الأم", "Choose the parent")}</span>
            <select className={field} value={choice} onChange={(e) => setChoice(e.target.value)} required>
              <option value="">—</option>
              {options.map((o) => <option key={o.id} value={o.id}>{nm(o)}</option>)}
            </select>
          </label>
          <button type="submit" className="btn btn-outline btn-sm">{t("اربط", "Link")}</button>
        </form>
      ) : (
        <p className="m-0 text-sm text-[var(--color-subtle)]">{t("مفيش جهات تانية معتمدة بتملكها.", "No other approved organization that you own.")}</p>
      )}
      {org._count.children > 0 && (
        <p className="m-0 text-xs text-[var(--color-subtle)]">{t(`تحتها ${org._count.children} جهة`, `${org._count.children} organization(s) within`)}</p>
      )}
    </section>
  );
}

function AssocActions({ t, a, base, onAct }: { t: T; a: Association; base: string; onAct: Act }) {
  const [section, setSection] = useState(a.section ?? "");
  const [sortOrder, setSortOrder] = useState(String(a.sortOrder));
  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <label className="space-y-1">
        <span className="block text-xs">{t("القسم", "Section")}</span>
        <input className={field} value={section} onChange={(e) => setSection(e.target.value)} maxLength={60} placeholder={t("مطاعم، عيادات…", "Dining, Clinics…")} />
      </label>
      <label className="space-y-1">
        <span className="block text-xs">{t("الترتيب", "Order")}</span>
        <input className={field} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" dir="ltr" />
      </label>
      {a.status === "REQUESTED" ? (
        <>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onAct(`${base}/businesses/${a.id}`, "PATCH", { action: "approve", section: section || null, sortOrder: Number(sortOrder) || 0 }, t("اتقبل.", "Approved."))}>
            {t("قبول", "Approve")}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onAct(`${base}/businesses/${a.id}`, "PATCH", { action: "reject" }, t("اترفض.", "Rejected."))}>
            {t("رفض", "Reject")}
          </button>
        </>
      ) : a.status === "INVITED" ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAct(`${base}/businesses/${a.id}`, "PATCH", { action: "remove" }, t("الدعوة اتسحبت.", "Invitation withdrawn."))}>
          {t("اسحب الدعوة", "Withdraw invitation")}
        </button>
      ) : (
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onAct(`${base}/businesses/${a.id}`, "PATCH", { action: "organize", section: section || null, sortOrder: Number(sortOrder) || 0 })}>
            {t("حفظ التنظيم", "Save placement")}
          </button>
          {a.status === "APPROVED" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAct(`${base}/businesses/${a.id}`, "PATCH", { action: "suspend" }, t("اتوقف مؤقتًا.", "Paused."))}>
              {t("إيقاف مؤقت", "Pause")}
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAct(`${base}/businesses/${a.id}`, "PATCH", { action: "resume" }, t("رجع.", "Resumed."))}>
              {t("رجّعه", "Resume")}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAct(`${base}/businesses/${a.id}`, "PATCH", { action: "remove" }, t("اتشال.", "Removed."))}>
            {t("شيل", "Remove")}
          </button>
          {a.status === "APPROVED" && a.scopes.length > 0 && (a.relation === "OWNED" || a.relation === "MANAGED") && (
            <ManageBusinessButton businessId={a.business.id} />
          )}
        </>
      )}
    </div>
  );
}

const KIND_LABELS: Record<string, [string, string]> = {
  MALL: ["مول", "Mall"],
  COMPOUND: ["كمبوند", "Compound"],
  BUSINESS_GROUP: ["مجموعة أنشطة", "Business group"],
  RESTAURANT_GROUP: ["مجموعة مطاعم", "Restaurant group"],
  CLINIC_GROUP: ["مجموعة عيادات", "Clinic group"],
  FRANCHISE: ["فرانشايز", "Franchise"],
  COMMERCIAL_BUILDING: ["مبنى تجاري", "Commercial building"],
  OTHER: ["أخرى", "Other"],
};

function ProfileForm({ t, en, org, cities, onSave }: { t: T; en: boolean; org: Org; cities: City[]; onSave: (profile: Record<string, unknown>) => Promise<boolean> }) {
  const [v, setV] = useState({
    nameAr: org.nameAr, nameEn: org.nameEn ?? "", descriptionAr: org.descriptionAr ?? "", descriptionEn: org.descriptionEn ?? "",
    phone: org.phone ?? "", email: org.email ?? "", instagram: org.instagram ?? "", facebook: org.facebook ?? "",
    address: org.address ?? "", website: org.website ?? "", kind: org.kind, cityId: org.cityId ?? "",
  });
  const [logoImage, setLogo] = useState<string | null>(org.logoImage);
  const [coverImage, setCover] = useState<string | null>(org.coverImage);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  // Name and kind are what the platform reviewed.
  const identityChanged = v.nameAr.trim() !== org.nameAr || (v.nameEn.trim() || null) !== (org.nameEn || null) || v.kind !== org.kind;
  return (
    <form
      className="card space-y-3 p-5"
      aria-labelledby="prof-h"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          ...v,
          cityId: v.cityId || null,
          ...(logoImage !== org.logoImage ? { logoImage } : {}),
          ...(coverImage !== org.coverImage ? { coverImage } : {}),
        });
      }}
    >
      <h2 id="prof-h" className="m-0 text-base font-extrabold">{t("بيانات الجهة", "Organization details")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <L label={t("الاسم بالعربي", "Name (Arabic)")}><input className={field} value={v.nameAr} onChange={set("nameAr")} required /></L>
        <L label={t("الاسم بالإنجليزي", "Name (English)")}><input className={field} value={v.nameEn} onChange={set("nameEn")} dir="ltr" /></L>
        <L label={t("الوصف بالعربي", "Description (Arabic)")}><textarea className={field} rows={3} value={v.descriptionAr} onChange={set("descriptionAr")} /></L>
        <L label={t("الوصف بالإنجليزي", "Description (English)")}><textarea className={field} rows={3} value={v.descriptionEn} onChange={set("descriptionEn")} dir="ltr" /></L>
        <L label={t("التليفون", "Phone")}><input className={field} value={v.phone} onChange={set("phone")} dir="ltr" /></L>
        <L label={t("الإيميل", "Email")}><input className={field} type="email" value={v.email} onChange={set("email")} dir="ltr" /></L>
        <L label="Instagram"><input className={field} value={v.instagram} onChange={set("instagram")} dir="ltr" /></L>
        <L label="Facebook"><input className={field} value={v.facebook} onChange={set("facebook")} dir="ltr" /></L>
        <L label={t("العنوان", "Address")}><input className={field} value={v.address} onChange={set("address")} /></L>
        <L label={t("الموقع الإلكتروني", "Website")}><input className={field} type="url" value={v.website} onChange={set("website")} dir="ltr" /></L>
        <L label={t("النوع", "Kind")}>
          <select className={field} value={v.kind} onChange={set("kind")}>
            {Object.entries(KIND_LABELS).map(([k, [ar, e]]) => <option key={k} value={k}>{en ? e : ar}</option>)}
          </select>
        </L>
        <L label={t("المدينة", "City")}>
          <select className={field} value={v.cityId} onChange={set("cityId")}>
            <option value="">{t("— من غير مدينة —", "— No city —")}</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{en ? c.nameEn : c.nameAr}</option>)}
          </select>
        </L>
      </div>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <ImageUpload variant="logo" folder="maw3ed/organizations" label={t("الشعار", "Logo")} value={logoImage} onChange={setLogo} onRemove={() => setLogo(null)} />
        <ImageUpload variant="cover" folder="maw3ed/organizations" label={t("صورة الغلاف", "Cover image")} value={coverImage} onChange={setCover} onRemove={() => setCover(null)} />
      </div>
      {identityChanged && org.status === "APPROVED" && (
        <p className="m-0 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 text-xs" role="status">
          {t(
            "تغيير الاسم أو النوع بيرجّع الجهة لمراجعة موعد، وصفحتها هتتقفل لحد ما تتعتمد تاني.",
            "Changing the name or kind sends the organization back to Maw3ed review; its page goes offline until it is approved again.",
          )}
        </p>
      )}
      <button type="submit" className="btn btn-primary">{t("احفظ", "Save")}</button>
    </form>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-bold">{label}</span>
      {children}
    </label>
  );
}

function AddMember({ t, onAdd }: { t: T; onAdd: (email: string) => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAdd(email.trim())) setEmail("");
      }}
    >
      <label className="min-w-[14rem] flex-1 space-y-1">
        <span className="block text-xs font-bold">{t("أضف مدير (إيميل حساب مؤكد)", "Add a manager (confirmed account email)")}</span>
        <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
      </label>
      <button type="submit" className="btn btn-outline btn-sm">{t("أضف", "Add")}</button>
    </form>
  );
}
