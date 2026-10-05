"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, Search, Volume2, VolumeX,
  CalendarPlus, Ban, CheckCircle2, RefreshCw, X,
  Menu,
  LayoutDashboard, CalendarDays, Settings, Store,
  BarChart3, Users, MessageSquare, Gift,
  LogOut, ArrowUpRight,
  Utensils, Scissors, Users2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { BusinessType } from "@/lib/business-type";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Logo from "@/components/shared/Logo";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import type { RealtimeBookingEvent } from "@/hooks/useRealtimeBookings";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Plan } from "@/lib/plans";

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifVariant = "new" | "confirmed" | "cancelled" | "updated";

interface NotificationItem {
  id:        string;
  variant:   NotifVariant;
  title:     string;
  body:      string;
  timestamp: Date;
  read:      boolean;
}

interface ToastItem {
  id:      string;
  variant: NotifVariant;
  title:   string;
  body:    string;
}

// ── Static visual config ──────────────────────────────────────────────────────

const VARIANT_VISUAL: Record<
  NotifVariant,
  { Icon: React.ElementType; iconClass: string; toastClass: string }
> = {
  new: {
    Icon:       CalendarPlus,
    iconClass:  "bg-[var(--color-accent-light)] text-[var(--color-accent)]",
    toastClass: "border-[var(--color-accent)] bg-white",
  },
  confirmed: {
    Icon:       CheckCircle2,
    iconClass:  "bg-[var(--color-ok-soft)] text-[var(--color-ok)]",
    toastClass: "border-[var(--color-ok-line)] bg-white",
  },
  cancelled: {
    Icon:       Ban,
    iconClass:  "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    toastClass: "border-[var(--color-danger-line)] bg-white",
  },
  updated: {
    Icon:       RefreshCw,
    iconClass:  "bg-[var(--color-jade-soft)] text-[var(--color-jade)]",
    toastClass: "border-[var(--color-jade-line)] bg-white",
  },
};

function variantFromStatus(status: string): NotifVariant {
  if (status === "CONFIRMED") return "confirmed";
  if (status === "CANCELLED") return "cancelled";
  return "updated";
}

// ── Nav config (mirrors DashboardSidebar) ─────────────────────────────────────

function getNavConfig(businessType: BusinessType, labels: Record<string, string>, pendingCount: number) {
  if (businessType === "RESTAURANT") {
    return {
      main: [
        { icon: LayoutDashboard, href: "/dashboard",           label: labels.home,         soon: false, badge: null },
        { icon: CalendarDays,    href: "/dashboard/bookings",  label: labels.reservations, soon: false, badge: pendingCount },
        { icon: Utensils,        href: "/dashboard/tables",    label: labels.tables,       soon: false, badge: null },
        { icon: Users,           href: "/dashboard/customers", label: labels.customers,    soon: false, badge: null },
        { icon: BarChart3,       href: "/dashboard/analytics", label: labels.analytics,    soon: false, badge: null },
      ],
      secondary: [
        { icon: MessageSquare, href: "/dashboard/reviews",   label: labels.reviews,   soon: true,  badge: null },
        { icon: Gift,          href: "/dashboard/referrals", label: labels.referrals, soon: false, badge: null },
      ],
      utility: [
        { icon: Settings, href: "/dashboard/settings", label: labels.settings, soon: false, badge: null },
      ],
    };
  }
  if (businessType === "BARBERSHOP") {
    return {
      main: [
        { icon: LayoutDashboard, href: "/dashboard",           label: labels.home,         soon: false, badge: null },
        { icon: CalendarDays,    href: "/dashboard/bookings",  label: labels.appointments, soon: false, badge: pendingCount },
        { icon: Scissors,        href: "/dashboard/services",  label: labels.services,     soon: false, badge: null },
        { icon: Users2,          href: "/dashboard/staff",     label: labels.staff,        soon: false, badge: null },
        { icon: Users,           href: "/dashboard/customers", label: labels.customers,    soon: false, badge: null },
        { icon: BarChart3,       href: "/dashboard/analytics", label: labels.analytics,    soon: false, badge: null },
      ],
      secondary: [
        { icon: MessageSquare, href: "/dashboard/reviews",   label: labels.reviews,   soon: true,  badge: null },
        { icon: Gift,          href: "/dashboard/referrals", label: labels.referrals, soon: false, badge: null },
      ],
      utility: [
        { icon: Settings, href: "/dashboard/settings", label: labels.settings, soon: false, badge: null },
      ],
    };
  }
  return {
    main: [
      { icon: LayoutDashboard, href: "/dashboard",           label: labels.home,      soon: false, badge: null },
      { icon: CalendarDays,    href: "/dashboard/bookings",  label: labels.bookings,  soon: false, badge: pendingCount },
      { icon: Store,           href: "/dashboard/services",  label: labels.services,  soon: false, badge: null },
      { icon: Users,           href: "/dashboard/customers", label: labels.customers, soon: false, badge: null },
      { icon: BarChart3,       href: "/dashboard/analytics", label: labels.analytics, soon: false, badge: null },
    ],
    secondary: [
      { icon: MessageSquare, href: "/dashboard/reviews",   label: labels.reviews,   soon: true,  badge: null },
      { icon: Gift,          href: "/dashboard/referrals", label: labels.referrals, soon: false, badge: null },
    ],
    utility: [
      { icon: Settings, href: "/dashboard/settings", label: labels.settings, soon: false, badge: null },
    ],
  };
}

const PLAN_STYLES: Record<Plan, { bg: string; text: string; label: string }> = {
  FREE:    { bg: "var(--color-surface-3)", text: "var(--color-muted)",  label: "مجاني"   },
  PRO:     { bg: "var(--color-jade-soft)", text: "var(--color-jade)",  label: "احترافي" },
  PREMIUM: { bg: "var(--color-warn-soft)", text: "var(--color-warn)",  label: "مميز"    },
};

// ── Time-ago ──────────────────────────────────────────────────────────────────

function timeAgo(
  date: Date,
  units: { now: string; seconds: string; minutes: string; hours: string; days: string },
): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 10)    return units.now;
  if (s < 60)    return `${s}${units.seconds}`;
  if (s < 3600)  return `${Math.floor(s / 60)}${units.minutes}`;
  if (s < 86400) return `${Math.floor(s / 3600)}${units.hours}`;
  return `${Math.floor(s / 86400)}${units.days}`;
}

// ── Sound ─────────────────────────────────────────────────────────────────────

function makeChime(ctx: AudioContext) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
  gain.gain.setValueAtTime(0.22, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.45);
}

// ── Icon button ───────────────────────────────────────────────────────────────

function IconBtn({
  onClick,
  title,
  children,
  active = false,
}: {
  onClick?:  () => void;
  title?:    string;
  children:  React.ReactNode;
  active?:   boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center transition-all duration-150 shrink-0 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
      style={{
        width:        36,
        height:       36,
        borderRadius: 10,
        background:   active ? "var(--color-jade-tint)" : "var(--color-surface-2)",
        border:       `1.5px solid ${active ? "var(--color-jade-line)" : "var(--color-line)"}`,
        color:        active ? "var(--color-jade)" : "var(--color-muted)",
        cursor:       "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Hoisted out of the component body: defining a component during
 *  render remounts the whole group on every parent render. */
function MobileNavGroup({
  items,
  pathname,
  comingSoonLabel,
  onNavigate,
}: {
  items: ReturnType<typeof getNavConfig>["main"];
  pathname: string;
  comingSoonLabel: string;
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => {
        const { href, icon: Icon, label, soon, badge } = item;
        const active =
          pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

        if (soon) {
          return (
            <div
              key={href}
              className="flex min-h-12 cursor-not-allowed select-none items-center gap-3 rounded-[var(--radius-sm)] px-4 text-[0.875rem] text-[var(--color-night-subtle)]/60"
            >
              <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <span className="rounded-full bg-[var(--color-night-line)] px-2 py-0.5 text-[0.625rem] font-bold text-[var(--color-night-subtle)]">
                {comingSoonLabel}
              </span>
            </div>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] px-4 text-[0.875rem] transition-colors",
              active
                ? "bg-[var(--color-jade)] font-bold text-white"
                : "text-[#BACBC4] hover:bg-[var(--color-night-2)] hover:text-white",
            )}
          >
            <Icon size={17} strokeWidth={active ? 2.1 : 1.75} aria-hidden="true" />
            <span className="flex-1 truncate">{label}</span>
            {badge != null && badge > 0 && (
              <span
                className={cn(
                  "num rounded-full px-2 py-0.5 text-[0.6875rem] font-bold",
                  active ? "bg-white/22 text-white" : "bg-[var(--color-night-line)] text-white",
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default function DashboardHeader({
  businessName,
  cityName     = "",
  pendingCount = 0,
  plan         = "FREE",
  businessType = "GENERAL",
}: {
  businessName:  string;
  cityName?:     string;
  pendingCount?: number;
  plan?:         Plan;
  businessType?: string;
}) {
  const { t }    = useLanguage();
  const h        = t.dashboard.header;
  const s        = t.dashboard.sidebar as unknown as Record<string, string>;
  const pathname = usePathname();

  const name      = businessName || s.yourBusiness;
  const planStyle = PLAN_STYLES[plan];
  const navCfg    = getNavConfig(businessType as BusinessType, s, pendingCount);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts,        setToasts]        = useState<ToastItem[]>([]);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [soundEnabled,  setSoundEnabled]  = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);

  const dropdownRef  = useRef<HTMLDivElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const unreadCount  = notifications.filter((n) => !n.read).length;

  // ── Body scroll lock ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Close the mobile menu on navigation. Derived from the pathname
  // rather than set from an effect, which cost an extra render pass.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileOpen(false);
  }

  // ── Notification dropdown outside click ─────────────────────────────────────
  useEffect(() => {
    if (!notifOpen) return;
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [notifOpen]);


  // ── Toast helpers ────────────────────────────────────────────────────────────
  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-3), { id, ...toast }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushNotification = useCallback((item: Omit<NotificationItem, "id" | "timestamp" | "read">) => {
    setNotifications((prev) => [
      { id: crypto.randomUUID(), timestamp: new Date(), read: false, ...item },
      ...prev.slice(0, 29),
    ]);
  }, []);

  const browserNotify = useCallback((title: string, body: string) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") new Notification(title, { body, icon: "/favicon.ico" });
      });
    }
  }, []);

  function handleSoundToggle() {
    if (!soundEnabled && !audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { /* unsupported */ }
    }
    setSoundEnabled((v) => !v);
  }

  useRealtimeBookings(useCallback((event: RealtimeBookingEvent) => {
    if (event.type === "BOOKING_CREATED") {
      const { customerName, status } = event.booking;
      const isManual  = status === "CONFIRMED";
      const variant: NotifVariant = isManual ? "confirmed" : "new";
      const title     = isManual ? h.variant.confirmed : h.variant.new;

      pushNotification({ variant, title, body: customerName });
      pushToast({ variant, title, body: customerName });

      if (!isManual) {
        browserNotify(`موعد · ${title}`, customerName);
        if (soundEnabled && audioCtxRef.current) {
          makeChime(audioCtxRef.current);
        }
      }
    } else {
      const { status, customerName } = event;
      if (status === "COMPLETED" || status === "NO_SHOW" || status === "PENDING") return;

      const variant  = variantFromStatus(status);
      const titleMap: Record<string, string> = {
        CONFIRMED: h.variant.confirmed,
        CANCELLED: h.variant.cancelled,
      };
      const title = titleMap[status] ?? h.variant.updated;

      pushNotification({ variant, title, body: customerName });
      pushToast({ variant, title, body: customerName });

      if (status === "CANCELLED") {
        browserNotify(`موعد · ${h.variant.cancelled}`, customerName);
      }
    }
  }, [pushNotification, pushToast, browserNotify, soundEnabled, h.variant]));

  return (
    <>
      {/* ── Top navbar ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-5"
        style={{
          height:       68,
          background:   "var(--color-surface)",
          borderBottom: "1.5px solid var(--color-surface-3)",
          boxShadow:    "0 1px 8px rgba(17,32,28,0.05)",
        }}
      >
        {/* Mobile hamburger — only on small screens */}
        <button
          className="md:hidden flex items-center justify-center shrink-0 transition-all duration-150"
          style={{
            width:        36,
            height:       36,
            borderRadius: 10,
            background:   mobileOpen ? "var(--color-surface-3)" : "var(--color-surface-2)",
            border:       "1.5px solid var(--color-line)",
            color:        "var(--color-ink)",
            cursor:       "pointer",
          }}
          onClick={() => setMobileOpen(true)}
          aria-label="فتح القائمة"
        >
          <Menu size={17} strokeWidth={2} />
        </button>

        {/* Mobile logo */}
        <div className="md:hidden shrink-0">
          <Logo size="sm" />
        </div>

        {/* Desktop search bar */}
        <div
          className="hidden md:flex flex-1 max-w-sm items-center gap-2.5 transition-all duration-150"
          style={{
            background:   "var(--color-surface-2)",
            border:       "1.5px solid var(--color-line)",
            borderRadius: 12,
            padding:      "0 14px",
            height:       38,
          }}
        >
          <Search size={14} style={{ color: "var(--color-subtle)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder={h.searchPlaceholder}
            className="bg-transparent outline-none flex-1 min-w-0 text-[0.8125rem]"
            style={{ color: "var(--color-ink)", lineHeight: 1 }}
            onFocus={(e) => {
              const parent = e.currentTarget.parentElement as HTMLDivElement;
              parent.style.borderColor = "var(--color-jade)";
              parent.style.background  = "var(--color-surface)";
              parent.style.boxShadow   = "0 0 0 3px rgba(10,95,71,0.09)";
            }}
            onBlur={(e) => {
              const parent = e.currentTarget.parentElement as HTMLDivElement;
              parent.style.borderColor = "var(--color-line)";
              parent.style.background  = "var(--color-surface-2)";
              parent.style.boxShadow   = "none";
            }}
          />
        </div>

        {/* Right action cluster */}
        <div className="ms-auto flex items-center gap-2">
          <IconBtn
            onClick={handleSoundToggle}
            title={soundEnabled ? h.disableSound : h.enableSound}
            active={soundEnabled}
          >
            {soundEnabled
              ? <Volume2 size={14} />
              : <VolumeX size={14} />
            }
          </IconBtn>

          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <IconBtn
                onClick={() => {
                  setNotifOpen((open) => {
                    if (!open) {
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    }
                    return !open;
                  });
                }}
                active={notifOpen}
              >
                <Bell size={14} />
              </IconBtn>
              {unreadCount > 0 && (
                <span
                  className="absolute flex items-center justify-center pointer-events-none"
                  style={{
                    top:              -4,
                    insetInlineEnd:   -4,
                    minWidth:         16,
                    height:           16,
                    borderRadius:     8,
                    background:       "var(--color-danger)",
                    color:            "var(--color-surface)",
                    fontSize:         9,
                    fontWeight:       700,
                    paddingInline:    3,
                    border:           "2px solid var(--color-surface)",
                    lineHeight:       1,
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            {notifOpen && (
              <NotificationDropdown
                notifications={notifications}
                onClear={() => setNotifications([])}
                title={h.notifications}
                clearLabel={h.clearAll}
                emptyLabel={h.noNotifications}
                timeAgoUnits={h.timeAgo}
              />
            )}
          </div>

          <div
            style={{
              width: 1, height: 22,
              background: "var(--color-line)", flexShrink: 0, marginInline: 2,
            }}
          />

          <div
            className="hidden md:flex items-center gap-2.5 cursor-pointer select-none rounded-[var(--radius-md)] px-2 py-1.5 transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
          >
            <div
              className="flex items-center justify-center text-white shrink-0 text-[0.8125rem]"
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-ink-2) 100%)", fontWeight: 900, letterSpacing: "-0.01em" }}
            >
              {name[0]}
            </div>
            <span
              className="hidden lg:block max-w-[120px] truncate text-[0.8125rem]"
              style={{ fontWeight: 600, color: "var(--color-ink)" }}
            >
              {name}
            </span>
          </div>

          {/* Mobile: plain avatar only */}
          <div
            className="md:hidden flex items-center justify-center text-white shrink-0 text-[0.8125rem]"
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-ink-2) 100%)", fontWeight: 900 }}
          >
            {name[0]}
          </div>
        </div>
      </header>

      {/* ── Mobile nav backdrop ──────────────────────────────── */}
      <div
        className="fixed inset-0 z-[60] md:hidden"
        style={{
          background:    "rgba(17,32,28,0.45)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          opacity:       mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? "auto" : "none",
          transition:    "opacity 0.25s ease",
        }}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Mobile nav drawer ────────────────────────────────── */}
      {/*
        Positioned at start-0 which resolves to right: 0 in RTL.
        translateX(100%) pushes it off-screen to the right when closed.
        translateX(0) brings it back when open.
      */}
      <div
        className="fixed top-0 start-0 z-[70] h-full flex flex-col md:hidden"
        style={{
          width:      280,
          background: "var(--color-surface)",
          boxShadow:  mobileOpen ? "-8px 0 40px rgba(17,32,28,0.18)" : "none",
          transform:  mobileOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        dir="rtl"
      >
        {/* ── Drawer header ─────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{
            height:       68,
            borderBottom: "1.5px solid var(--color-surface-3)",
            flexShrink:   0,
          }}
        >
          <Logo size="sm" />
          <button
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center transition-all duration-150"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--color-surface-2)", border: "1.5px solid var(--color-line)",
              color: "var(--color-muted)", cursor: "pointer",
            }}
            aria-label="إغلاق القائمة"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* ── Business profile card ─────────────────────────── */}
        <div className="px-3 pt-3 pb-2.5 shrink-0">
          <div
            className="flex items-center gap-3 rounded-[var(--radius-lg)] px-3.5 py-3"
            style={{ background: "var(--color-surface-2)", border: "1.5px solid var(--color-surface-3)" }}
          >
            <div
              className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-base font-extrabold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-ink-2) 100%)" }}
            >
              {name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[0.8125rem]"
                style={{ fontWeight: 700, color: "var(--color-ink)", lineHeight: 1.3 }}
              >
                {name}
              </p>
              {cityName && (
                <p className="truncate text-[0.6875rem]" style={{ color: "var(--color-subtle)", marginTop: 2 }}>
                  {cityName}
                </p>
              )}
            </div>
            <span
              className="shrink-0 text-[0.625rem]"
              style={{ fontWeight: 700,
                padding: "3px 8px", borderRadius: 100,
                background: planStyle.bg, color: planStyle.text }}
            >
              {planStyle.label}
            </span>
          </div>
        </div>

        {/* ── Navigation ───────────────────────────────────── */}
        <nav
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ padding: "6px 10px 12px" }}
        >
          <MobileNavGroup items={navCfg.main} pathname={pathname} comingSoonLabel={s.comingSoon} onNavigate={() => setMobileOpen(false)} />
          <div style={{ height: 1, background: "var(--color-surface-3)", marginBlock: 6, marginInline: 4 }} />
          <MobileNavGroup items={navCfg.secondary} pathname={pathname} comingSoonLabel={s.comingSoon} onNavigate={() => setMobileOpen(false)} />
          <div style={{ height: 1, background: "var(--color-surface-3)", marginBlock: 6, marginInline: 4 }} />
          <MobileNavGroup items={navCfg.utility} pathname={pathname} comingSoonLabel={s.comingSoon} onNavigate={() => setMobileOpen(false)} />
        </nav>

        {/* ── Bottom area ───────────────────────────────────── */}
        <div
          className="shrink-0 px-3 pb-5 pt-3"
          style={{ borderTop: "1.5px solid var(--color-surface-3)" }}
        >
          {/* Upgrade card — FREE plan only */}
          {plan === "FREE" && (
            <Link
              href="/dashboard/settings?tab=subscription"
              className="flex items-start gap-3 rounded-[var(--radius-lg)] p-3.5 mb-3 transition-all duration-150"
              style={{
                background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-night-2) 100%)",
                boxShadow:  "0 4px 16px rgba(17,32,28,0.2)",
              }}
              onClick={() => setMobileOpen(false)}
            >
              <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 overflow-hidden">
                <Image src="/icon-nobg.png" alt="موعد" width={28} height={28} className="object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-surface)", marginBottom: 2 }}>
                  ترقية الخطة
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                  حجوزات غير محدودة ومميزات احترافية
                </p>
              </div>
              <ArrowUpRight
                size={14}
                style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0, marginTop: 2 }}
              />
            </Link>
          )}

          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-3 px-4 rounded-[var(--radius-md)] transition-all duration-150"
            style={{
              paddingBlock: 12, color: "var(--color-subtle)",
              background: "transparent", fontSize: 14, fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <LogOut size={16} strokeWidth={1.75} />
            {s.signOut}
          </button>
        </div>
      </div>

      {/* ── Toast stack ─────────────────────────────────────── */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2.5 pointer-events-none" dir="rtl">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>
    </>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({
  toast,
  onDismiss,
}: {
  toast:     ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { Icon, iconClass, toastClass } = VARIANT_VISUAL[toast.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto animate-toast-in",
        "flex items-start gap-3 rounded-[var(--radius-lg)] border px-4 py-3 shadow-lg",
        "min-w-64 max-w-80",
        toastClass,
      )}
    >
      <span className={cn("mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center", iconClass)}>
        <Icon size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
          {toast.title}
        </p>
        {toast.body && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
            {toast.body}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 mt-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors pointer-events-auto"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Notification Dropdown ─────────────────────────────────────────────────────

function NotificationDropdown({
  notifications,
  onClear,
  title,
  clearLabel,
  emptyLabel,
  timeAgoUnits,
}: {
  notifications: NotificationItem[];
  onClear:       () => void;
  title:         string;
  clearLabel:    string;
  emptyLabel:    string;
  timeAgoUnits:  { now: string; seconds: string; minutes: string; hours: string; days: string };
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="animate-dropdown-in absolute top-full mt-2 end-0 w-80 bg-white rounded-[var(--radius-lg)] overflow-hidden z-50"
      style={{
        border:    "1.5px solid var(--color-line)",
        boxShadow: "0 8px 32px rgba(17,32,28,0.12)",
      }}
      dir="rtl"
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1.5px solid var(--color-surface-3)" }}
      >
        <div className="flex items-center gap-2">
          <Bell size={14} style={{ color: "var(--color-ink)" }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>{title}</p>
          {notifications.filter((n) => !n.read).length > 0 && (
            <span
              style={{
                fontSize: 10, fontWeight: 700,
                padding: "1px 6px", borderRadius: 100,
                background: "var(--color-jade-soft)", color: "var(--color-jade)",
              }}
            >
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <button
            onClick={onClear}
            style={{ fontSize: 11, color: "var(--color-subtle)" }}
          >
            {clearLabel}
          </button>
        )}
      </div>

      <div className="max-h-[22rem] overflow-y-auto overscroll-contain">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Image src="/icon-nobg.png" alt="موعد" width={40} height={40} className="object-contain opacity-40" />
            </div>
            <p style={{ fontSize: 13, color: "var(--color-subtle)" }}>{emptyLabel}</p>
          </div>
        ) : (
          notifications.map((n) => {
            const { Icon, iconClass } = VARIANT_VISUAL[n.variant];
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  n.read ? "bg-white" : "bg-[var(--color-jade-soft)]/30",
                )}
                style={{ borderBottom: "1px solid var(--color-surface-2)" }}
              >
                <span className={cn("mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center", iconClass)}>
                  <Icon size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", lineHeight: 1.3 }}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p style={{ color: "var(--color-subtle)", marginTop: 2 }} className="truncate text-[0.6875rem]">
                      {n.body}
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: "var(--color-line-2)", marginTop: 3 }}>
                    {timeAgo(n.timestamp, timeAgoUnits)}
                  </p>
                </div>
                {!n.read && (
                  <span
                    className="shrink-0 mt-2"
                    style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "var(--color-jade)", flexShrink: 0,
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
