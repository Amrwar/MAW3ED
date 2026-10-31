import {
  Armchair,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CreditCard,
  Gift,
  Globe,
  Landmark,
  Network,
  LifeBuoy,
  ListChecks,
  Upload,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Megaphone,
  Settings,
  ShieldCheck,
  Store,
  Ticket,
  Sun,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";

/**
 * The dashboard's navigation, in one place.
 *
 * It used to be two identical copies — one in the sidebar, one in the
 * header — with a comment on each pointing at the other. They were
 * already a restructure away from drifting apart.
 *
 * A section with `children` is a group: the sidebar opens it when you
 * are inside it. Nothing appears here that does not lead to a working
 * page; a nav entry for something unbuilt is a promise the app cannot
 * keep.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A count to show beside it, when there is something waiting. */
  badge?: number | null;
  children?: NavItem[];
}

export interface NavSection {
  /** Null for the first group, which needs no heading. */
  title: string | null;
  items: NavItem[];
}

export interface NavContext {
  /** t.dashboard.sidebar — the existing label block. */
  labels: Record<string, string>;
  /** Bookings waiting to be confirmed. */
  pendingCount: number;
  /** "الطاولات" / "الغرف", derived from what the business has. */
  resourceWord: string;
  /** Businesses with resources configured; the entry is hidden otherwise. */
  hasResources: boolean;
  /** More than one location. */
  hasBranches: boolean;
  /** An administrator sees a way into the panel; nobody else does. */
  isAdmin?: boolean;
  /**
   * The business is not yet live: the setup checklist goes to the top,
   * because nothing else on the dashboard matters until it is done.
   */
  needsSetup?: boolean;
  /** Holds a venue role: a way into the venue console. */
  hasVenueRoles?: boolean;
  /**
   * Set while operating a business for an organization: the actions the
   * granted scopes allow. The nav then holds only what those open —
   * an entry for a page the delegate cannot use is a dead end.
   */
  delegatePermissions?: readonly string[] | null;
}

export function buildNav(ctx: NavContext): NavSection[] {
  const { labels: s, pendingCount } = ctx;
  if (ctx.delegatePermissions) return buildDelegateNav(ctx, ctx.delegatePermissions);

  const operate: NavItem[] = [
    { href: "/dashboard", label: s.home, icon: LayoutDashboard },
    ...(ctx.needsSetup ? [{ href: "/dashboard/setup", label: s.setup, icon: ListChecks }] : []),
    {
      href: "/dashboard/bookings",
      label: s.bookings,
      icon: CalendarCheck,
      badge: pendingCount || null,
      children: [
        { href: "/dashboard/bookings/today", label: s.today, icon: Sun },
        { href: "/dashboard/bookings/upcoming", label: s.upcoming, icon: CalendarClock },
        { href: "/dashboard/calendar", label: s.calendar, icon: CalendarDays },
      ],
    },
    { href: "/dashboard/customers", label: s.customers, icon: Users },
  ];

  const setUp: NavItem[] = [
    ...(ctx.needsSetup ? [] : [{ href: "/dashboard/setup", label: s.setup, icon: ListChecks }]),
    { href: "/dashboard/services", label: s.services, icon: Store },
    { href: "/dashboard/staff", label: s.staff, icon: Users2 },
  ];
  // Only shown when the business actually schedules on them, the same
  // rule the booking widget and the calendar follow.
  if (ctx.hasResources) {
    setUp.push({ href: "/dashboard/resources", label: ctx.resourceWord, icon: Armchair });
  }
  if (ctx.hasBranches) {
    setUp.push({ href: "/dashboard/branches", label: s.branches, icon: Building2 });
  }
  setUp.push(
    { href: "/dashboard/public-profile", label: s.publicProfile, icon: Globe },
    { href: "/dashboard/reviews", label: s.reviews, icon: MessageSquare },
    { href: "/dashboard/import", label: s.importData, icon: Upload },
    { href: "/dashboard/venue", label: s.venue, icon: Landmark },
    { href: "/dashboard/organizations", label: s.organizations, icon: Network },
  );

  const grow: NavItem[] = [
    // Booking links, the QR code and channel performance live together,
    // because a link is only worth placing somewhere if you can tell
    // afterwards whether it worked.
    { href: "/dashboard/links", label: s.bookingLinks, icon: Link2 },
    { href: "/dashboard/offers", label: s.offers, icon: Ticket },
    { href: "/dashboard/referrals", label: s.referrals, icon: Gift },
    {
      href: "/dashboard/reports",
      label: s.reports,
      icon: BarChart3,
      children: [
        { href: "/dashboard/reports/revenue", label: s.revenue, icon: BarChart3 },
        { href: "/dashboard/reports/bookings", label: s.bookings, icon: CalendarCheck },
        { href: "/dashboard/reports/customers", label: s.customers, icon: Users },
        { href: "/dashboard/reports/performance", label: s.performance, icon: Megaphone },
      ],
    },
  ];

  const account: NavItem[] = [
    { href: "/dashboard/billing", label: s.billing, icon: CreditCard },
    { href: "/dashboard/settings", label: s.settings, icon: Settings },
    { href: "/help", label: s.help, icon: LifeBuoy },
  ];
  if (ctx.hasVenueRoles) {
    account.push({ href: "/org-admin", label: s.venueConsole, icon: Landmark });
  }

  // The moderation queue. Only an admin has one, and the entry is
  // absent rather than disabled for everybody else — a greyed-out link
  // would tell the whole platform the page exists.
  if (ctx.isAdmin) {
    account.push({ href: "/admin", label: s.moderation, icon: ShieldCheck });
  }

  return [
    { title: null, items: operate },
    { title: s.groupSetUp, items: setUp },
    { title: s.groupGrow, items: grow },
    { title: s.groupAccount, items: account },
  ];
}

/** The navigation of someone operating a business for an organization. */
function buildDelegateNav(ctx: NavContext, perms: readonly string[]): NavSection[] {
  const { labels: s, pendingCount } = ctx;
  const has = (a: string) => perms.includes(a);

  const operate: NavItem[] = [{ href: "/dashboard", label: s.home, icon: LayoutDashboard }];
  if (has("bookings.read")) {
    operate.push({
      href: "/dashboard/bookings",
      label: s.bookings,
      icon: CalendarCheck,
      badge: pendingCount || null,
      children: [
        { href: "/dashboard/bookings/today", label: s.today, icon: Sun },
        { href: "/dashboard/bookings/upcoming", label: s.upcoming, icon: CalendarClock },
        { href: "/dashboard/calendar", label: s.calendar, icon: CalendarDays },
      ],
    });
  }
  if (has("customers.read")) operate.push({ href: "/dashboard/customers", label: s.customers, icon: Users });

  const setUp: NavItem[] = [];
  if (has("services.manage")) setUp.push({ href: "/dashboard/services", label: s.services, icon: Store });
  if (has("staff.manage")) setUp.push({ href: "/dashboard/staff", label: s.staff, icon: Users2 });
  if (has("profile.manage") || has("schedule.manage")) {
    setUp.push({
      href: has("profile.manage") ? "/dashboard/settings" : "/dashboard/settings?tab=availability",
      label: s.settings,
      icon: Settings,
    });
  }

  const grow: NavItem[] = [];
  if (has("reports.read")) {
    grow.push({
      href: "/dashboard/reports",
      label: s.reports,
      icon: BarChart3,
      children: [
        ...(has("finance.read") ? [{ href: "/dashboard/reports/revenue", label: s.revenue, icon: BarChart3 }] : []),
        { href: "/dashboard/reports/bookings", label: s.bookings, icon: CalendarCheck },
        ...(has("customers.read") ? [{ href: "/dashboard/reports/customers", label: s.customers, icon: Users }] : []),
        { href: "/dashboard/reports/performance", label: s.performance, icon: Megaphone },
      ],
    });
  }

  // The way back to the organization this access comes through.
  const account: NavItem[] = [
    { href: "/org-admin", label: s.venueConsole, icon: Landmark },
    { href: "/help", label: s.help, icon: LifeBuoy },
  ];

  return [
    { title: null, items: operate },
    ...(setUp.length ? [{ title: s.groupSetUp, items: setUp }] : []),
    ...(grow.length ? [{ title: s.groupGrow, items: grow }] : []),
    { title: s.groupAccount, items: account },
  ];
}

/**
 * Whether a nav entry is the one being looked at.
 *
 * `/dashboard` matches only itself — every other route starts with it,
 * and a home link lit up on every page tells you nothing.
 */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

/** True when the current page is inside this group. */
export function isGroupOpen(item: NavItem, pathname: string): boolean {
  if (isActive(item.href, pathname)) return true;
  return (item.children ?? []).some((c) => isActive(c.href, pathname));
}
