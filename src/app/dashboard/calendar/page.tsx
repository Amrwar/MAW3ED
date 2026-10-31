import { getLang } from "@/lib/lang-server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { cairoDateString } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";
import { loadCalendar, parseView, type CalendarFilters } from "@/lib/scheduling/calendar";
import { getCapabilities, resourceLabel } from "@/lib/scheduling/capabilities";
import { translations } from "@/lib/i18n";
import CalendarClient from "./_components/CalendarClient";

export const metadata: Metadata = { title: "التقويم" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined): string | null => {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || null;
};

/** A cuid, or nothing. Keeps a hand-edited URL out of the query. */
const id = (v: string | string[] | undefined): string | null => {
  const s = one(v);
  return s && /^[a-z0-9]{10,40}$/i.test(s) ? s : null;
};

const VALID_STATUSES = new Set([
  "PENDING_PAYMENT", "PENDING", "CONFIRMED", "ARRIVED",
  "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "FAILED_PAYMENT",
]);

export default async function CalendarPage({ searchParams }: Props) {
  // The business comes from the account (owner, or a delegate with
  // reservations), never from an id in the URL.
  const ctx = await requireDashboardAccess("bookings.read");
  // A delegate limited to some branches sees only those.
  const allowedBranches = ctx.actor.delegation?.branchIds ?? null;

  const business = await db.business.findUnique({
    where: { id: ctx.business.id },
    select: {
      id: true,
      availability: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
    },
  });
  if (!business) redirect("/onboarding");

  const params = await searchParams;
  const lang = await getLang();
  const t = translations[lang] ?? translations.ar;

  const view = parseView(one(params.view) ?? undefined);
  const anchorRaw = one(params.date);
  const anchor =
    anchorRaw && /^\d{4}-\d{2}-\d{2}$/.test(anchorRaw) ? anchorRaw : cairoDateString();

  const filters: CalendarFilters = {
    staffMemberId: id(params.staff),
    serviceId: id(params.service),
    branchId: allowedBranches
      ? (allowedBranches.includes(id(params.branch) ?? "") ? id(params.branch) : allowedBranches[0])
      : id(params.branch),
    resourceId: id(params.resource),
    statuses: (one(params.status) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => VALID_STATUSES.has(s)) as CalendarFilters["statuses"],
  };

  const [calendar, capabilities, staff, services, branches, resources] = await Promise.all([
    loadCalendar(business.id, view, anchor, filters),
    getCapabilities(business.id),
    db.staffMember.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, nameAr: true },
      orderBy: { nameAr: "asc" },
    }),
    db.service.findMany({
      where: { businessId: business.id, isAvailable: true },
      select: { id: true, nameAr: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.branch.findMany({
      where: { businessId: business.id, isActive: true, ...(allowedBranches ? { id: { in: allowedBranches } } : {}) },
      select: { id: true, nameAr: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.resource.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // The grid opens on the business's own hours rather than midnight.
  // A day with no rules at all still gets a sensible window.
  const open = business.availability.filter((a) => !a.isClosed);
  const dayStartMin = open.length
    ? Math.min(...open.map((a) => timeToMinutes(a.openTime)))
    : 9 * 60;
  const dayEndMin = open.length
    ? Math.max(...open.map((a) => timeToMinutes(a.closeTime)))
    : 21 * 60;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-[1.5rem] font-bold text-[var(--color-ink)]">{t.calendar.title}</h1>
        <p className="m-0 mt-1.5 text-[0.875rem] text-[var(--color-subtle)]">
          {t.calendar.subtitle}
        </p>
      </header>

      <CalendarClient
        view={view}
        anchor={anchor}
        from={calendar.from}
        to={calendar.to}
        entries={calendar.entries}
        blocks={calendar.blocks}
        dayStartMin={dayStartMin}
        dayEndMin={dayEndMin > dayStartMin ? dayEndMin : dayStartMin + 12 * 60}
        staff={staff.map((s) => ({ id: s.id, label: s.nameAr }))}
        services={services.map((s) => ({ id: s.id, label: s.nameAr }))}
        branches={branches.map((b) => ({ id: b.id, label: b.nameAr }))}
        resources={resources.map((r) => ({ id: r.id, label: r.name }))}
        resourceWord={resourceLabel(capabilities.resourceKind, lang)}
        selected={filters}
      />
    </div>
  );
}
