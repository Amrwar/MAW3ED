"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";

interface Props {
  canManage: boolean;
  organizations: { id: string; slug: string; nameAr: string }[];
  compounds: { id: string; slug: string; nameAr: string; cityId: string; organizationId: string | null }[];
  cities: { id: string; nameAr: string }[];
  venues: {
    id: string; slug: string; nameAr: string; status: string; isPublished: boolean; kind: string; tenants: number;
    city: { nameAr: string }; compound: { nameAr: string } | null; organization: { nameAr: string } | null;
  }[];
  roles: {
    id: string; kind: string; user: { name: string | null; email: string | null };
    organization: { nameAr: string } | null; compound: { nameAr: string } | null; venue: { nameAr: string } | null;
  }[];
}

const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const KIND: Record<string, string> = {
  ORGANIZATION_ADMIN: "مدير الجهة", COMPOUND_ADMIN: "مدير الكمبوند", VENUE_MANAGER: "مدير المكان",
};

export default function VenuesAdminClient(p: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(path: string, method: string, body?: unknown, done = "اتحفظ.") {
    setMsg(null);
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg({ ok: res.ok, text: res.ok ? done : json.error ?? "حصلت مشكلة." });
    if (res.ok) router.refresh();
    return res.ok;
  }

  return (
    <div className="space-y-6">
      <p role="status" className={`m-0 min-h-5 text-sm ${msg?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg?.text}</p>

      <section className="card space-y-3 p-5" aria-labelledby="v-h">
        <h2 id="v-h" className="m-0 text-base font-extrabold">الأماكن</h2>
        {p.venues.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">لسه مفيش أماكن.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--color-line)] p-0">
            {p.venues.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="m-0 font-bold">{v.nameAr} <span className="text-xs font-normal text-[var(--color-subtle)]" dir="ltr">/{v.slug}</span></p>
                  <p className="m-0 text-xs text-[var(--color-subtle)]">
                    {v.city.nameAr}{v.compound ? ` · ${v.compound.nameAr}` : ""}{v.organization ? ` · ${v.organization.nameAr}` : ""} · {v.tenants} نشاط معروض
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">{v.status}{v.isPublished ? " · منشور" : ""}</span>
                  <Link href={`/venue-admin/${v.id}`} className="btn btn-ghost btn-sm">إدارة</Link>
                  {p.canManage && (
                    <>
                      {v.status !== "ACTIVE" && <button type="button" className="btn btn-outline btn-sm" onClick={() => send(`/api/admin/venues/${v.id}`, "PATCH", { status: "ACTIVE" })}>تفعيل</button>}
                      {v.status === "ACTIVE" && !v.isPublished && <button type="button" className="btn btn-primary btn-sm" onClick={() => send(`/api/admin/venues/${v.id}`, "PATCH", { isPublished: true }, "اتنشر.")}>نشر</button>}
                      {v.isPublished && <button type="button" className="btn btn-outline btn-sm" onClick={() => send(`/api/admin/venues/${v.id}`, "PATCH", { isPublished: false }, "اتخفى.")}>إخفاء</button>}
                      {v.status !== "SUSPENDED" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => send(`/api/admin/venues/${v.id}`, "PATCH", { status: "SUSPENDED" }, "اتوقف.")}>إيقاف</button>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.canManage && (
        <>
          <CreateForms {...p} send={send} />
          <section className="card space-y-3 p-5" aria-labelledby="r-h">
            <h2 id="r-h" className="m-0 text-base font-extrabold">مين بيدير إيه</h2>
            <ul className="m-0 list-none space-y-1 p-0 text-sm">
              {p.roles.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>
                    {r.user.name ?? "—"} <span className="text-xs text-[var(--color-subtle)]" dir="ltr">{r.user.email}</span> — {KIND[r.kind]}:{" "}
                    {r.organization?.nameAr ?? r.compound?.nameAr ?? r.venue?.nameAr}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="سحب الدور" onClick={() => send(`/api/admin/venue-roles/${r.id}`, "DELETE", undefined, "اتسحب الدور.")}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <RoleForm {...p} send={send} />
          </section>
        </>
      )}
    </div>
  );
}

type Send = (path: string, method: string, body?: unknown, done?: string) => Promise<boolean>;

function CreateForms(p: Props & { send: Send }) {
  const [org, setOrg] = useState({ slug: "", nameAr: "", nameEn: "", website: "" });
  const [cmp, setCmp] = useState({ slug: "", nameAr: "", nameEn: "", cityId: "", organizationId: "" });
  const [ven, setVen] = useState({ slug: "", nameAr: "", nameEn: "", kind: "MALL", cityId: "", compoundId: "", organizationId: "" });
  return (
    <section className="card space-y-5 p-5" aria-labelledby="c-h">
      <h2 id="c-h" className="m-0 text-base font-extrabold">إضافة</h2>
      <p className="m-0 text-xs text-[var(--color-subtle)]">اكتب البيانات زي ما الجهة المشغلة اديتها. الإضافة مش معناها شراكة ومش بتنشر حاجة.</p>

      <form className="grid gap-2 sm:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); if (await p.send("/api/admin/venue-organizations", "POST", org, "اتضافت الجهة.")) setOrg({ slug: "", nameAr: "", nameEn: "", website: "" }); }}>
        <p className="m-0 text-sm font-bold sm:col-span-5">جهة مشغلة</p>
        <input className={field} placeholder="slug" dir="ltr" value={org.slug} onChange={(e) => setOrg({ ...org, slug: e.target.value })} required />
        <input className={field} placeholder="الاسم بالعربي" value={org.nameAr} onChange={(e) => setOrg({ ...org, nameAr: e.target.value })} required />
        <input className={field} placeholder="English name" dir="ltr" value={org.nameEn} onChange={(e) => setOrg({ ...org, nameEn: e.target.value })} />
        <input className={field} placeholder="https://" dir="ltr" value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} />
        <button type="submit" className="btn btn-outline btn-sm">أضف</button>
      </form>

      <form className="grid gap-2 sm:grid-cols-6" onSubmit={async (e) => {
        e.preventDefault();
        if (await p.send("/api/admin/compounds", "POST", { ...cmp, organizationId: cmp.organizationId || null }, "اتضاف الكمبوند.")) setCmp({ slug: "", nameAr: "", nameEn: "", cityId: "", organizationId: "" });
      }}>
        <p className="m-0 text-sm font-bold sm:col-span-6">كمبوند</p>
        <input className={field} placeholder="slug" dir="ltr" value={cmp.slug} onChange={(e) => setCmp({ ...cmp, slug: e.target.value })} required />
        <input className={field} placeholder="الاسم بالعربي" value={cmp.nameAr} onChange={(e) => setCmp({ ...cmp, nameAr: e.target.value })} required />
        <input className={field} placeholder="English name" dir="ltr" value={cmp.nameEn} onChange={(e) => setCmp({ ...cmp, nameEn: e.target.value })} />
        <select className={field} value={cmp.cityId} onChange={(e) => setCmp({ ...cmp, cityId: e.target.value })} required aria-label="المدينة">
          <option value="">المدينة</option>{p.cities.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
        </select>
        <select className={field} value={cmp.organizationId} onChange={(e) => setCmp({ ...cmp, organizationId: e.target.value })} aria-label="الجهة">
          <option value="">بدون جهة</option>{p.organizations.map((o) => <option key={o.id} value={o.id}>{o.nameAr}</option>)}
        </select>
        <button type="submit" className="btn btn-outline btn-sm">أضف</button>
      </form>

      <form className="grid gap-2 sm:grid-cols-4" onSubmit={async (e) => {
        e.preventDefault();
        const body = { ...ven, cityId: ven.cityId || undefined, compoundId: ven.compoundId || null, organizationId: ven.organizationId || null };
        if (await p.send("/api/admin/venues", "POST", body, "اتضاف المكان كمسودة.")) setVen({ slug: "", nameAr: "", nameEn: "", kind: "MALL", cityId: "", compoundId: "", organizationId: "" });
      }}>
        <p className="m-0 text-sm font-bold sm:col-span-4">مكان (مول، مجمع…)</p>
        <input className={field} placeholder="slug" dir="ltr" value={ven.slug} onChange={(e) => setVen({ ...ven, slug: e.target.value })} required />
        <input className={field} placeholder="الاسم بالعربي" value={ven.nameAr} onChange={(e) => setVen({ ...ven, nameAr: e.target.value })} required />
        <input className={field} placeholder="English name" dir="ltr" value={ven.nameEn} onChange={(e) => setVen({ ...ven, nameEn: e.target.value })} />
        <select className={field} value={ven.kind} onChange={(e) => setVen({ ...ven, kind: e.target.value })} aria-label="النوع">
          <option value="MALL">مول</option><option value="OFFICE_COMPLEX">مجمع إداري</option><option value="BUSINESS_PARK">بيزنس بارك</option>
          <option value="MIXED_USE">متعدد الاستخدامات</option><option value="COMMUNITY_CENTER">مركز خدمات</option><option value="OTHER">غير ذلك</option>
        </select>
        <select className={field} value={ven.compoundId} onChange={(e) => setVen({ ...ven, compoundId: e.target.value })} aria-label="الكمبوند">
          <option value="">مش في كمبوند</option>{p.compounds.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
        </select>
        <select className={field} value={ven.cityId} onChange={(e) => setVen({ ...ven, cityId: e.target.value })} aria-label="المدينة" required={!ven.compoundId}>
          <option value="">{ven.compoundId ? "مدينة الكمبوند" : "المدينة"}</option>{p.cities.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
        </select>
        <select className={field} value={ven.organizationId} onChange={(e) => setVen({ ...ven, organizationId: e.target.value })} aria-label="الجهة">
          <option value="">{ven.compoundId ? "جهة الكمبوند" : "بدون جهة"}</option>{p.organizations.map((o) => <option key={o.id} value={o.id}>{o.nameAr}</option>)}
        </select>
        <button type="submit" className="btn btn-primary btn-sm">أضف مسودة</button>
      </form>
    </section>
  );
}

function RoleForm(p: Props & { send: Send }) {
  const [r, setR] = useState({ email: "", kind: "VENUE_MANAGER", target: "" });
  const options =
    r.kind === "ORGANIZATION_ADMIN" ? p.organizations : r.kind === "COMPOUND_ADMIN" ? p.compounds : p.venues;
  const key = r.kind === "ORGANIZATION_ADMIN" ? "organizationId" : r.kind === "COMPOUND_ADMIN" ? "compoundId" : "venueId";
  return (
    <form className="grid gap-2 sm:grid-cols-4" onSubmit={async (e) => {
      e.preventDefault();
      if (await p.send("/api/admin/venue-roles", "POST", { email: r.email, kind: r.kind, [key]: r.target }, "اتدّى الدور.")) setR({ email: "", kind: r.kind, target: "" });
    }}>
      <input className={field} type="email" placeholder="إيميل الحساب" dir="ltr" value={r.email} onChange={(e) => setR({ ...r, email: e.target.value })} required />
      <select className={field} value={r.kind} onChange={(e) => setR({ ...r, kind: e.target.value, target: "" })} aria-label="الدور">
        <option value="VENUE_MANAGER">مدير مكان</option><option value="COMPOUND_ADMIN">مدير كمبوند</option><option value="ORGANIZATION_ADMIN">مدير جهة</option>
      </select>
      <select className={field} value={r.target} onChange={(e) => setR({ ...r, target: e.target.value })} required aria-label="على">
        <option value="">على…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.nameAr}</option>)}
      </select>
      <button type="submit" className="btn btn-outline btn-sm">ادّي الدور</button>
    </form>
  );
}
