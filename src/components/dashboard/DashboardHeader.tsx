"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, Search, Volume2, VolumeX,
  CalendarPlus, Ban, CheckCircle2, RefreshCw, X,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import type { RealtimeBookingEvent } from "@/hooks/useRealtimeBookings";
import { cn } from "@/lib/utils";

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

// ── Config ────────────────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  NotifVariant,
  { Icon: React.ElementType; iconClass: string; toastClass: string; label: string }
> = {
  new: {
    Icon:       CalendarPlus,
    iconClass:  "bg-[var(--color-accent-light)] text-[var(--color-accent)]",
    toastClass: "border-[var(--color-accent)] bg-white",
    label:      "حجز جديد",
  },
  confirmed: {
    Icon:       CheckCircle2,
    iconClass:  "bg-green-50 text-green-600",
    toastClass: "border-green-200 bg-white",
    label:      "تم التأكيد",
  },
  cancelled: {
    Icon:       Ban,
    iconClass:  "bg-red-50 text-red-500",
    toastClass: "border-red-200 bg-white",
    label:      "تم الإلغاء",
  },
  updated: {
    Icon:       RefreshCw,
    iconClass:  "bg-blue-50 text-blue-500",
    toastClass: "border-blue-100 bg-white",
    label:      "تحديث",
  },
};

function variantFromStatus(status: string): NotifVariant {
  if (status === "CONFIRMED") return "confirmed";
  if (status === "CANCELLED") return "cancelled";
  return "updated";
}

// ── Time-ago (Arabic) ─────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 10)    return "الآن";
  if (s < 60)    return `${s} ث`;
  if (s < 3600)  return `${Math.floor(s / 60)} د`;
  if (s < 86400) return `${Math.floor(s / 3600)} س`;
  return `${Math.floor(s / 86400)} ي`;
}

// ── Sound (AudioContext created on first user interaction) ────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardHeader({ businessName }: { businessName: string }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts,        setToasts]        = useState<ToastItem[]>([]);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [soundEnabled,  setSoundEnabled]  = useState(false);

  const dropdownRef  = useRef<HTMLDivElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const unreadCount  = notifications.filter((n) => !n.read).length;

  // ── Close dropdown on outside click ──────────────────────
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

  // ── Mark all read when dropdown is opened ─────────────────
  useEffect(() => {
    if (notifOpen) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }, [notifOpen]);

  // ── Toast helpers ─────────────────────────────────────────
  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-3), { id, ...toast }]); // max 4 on screen
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Notification-center helper ────────────────────────────
  const pushNotification = useCallback((item: Omit<NotificationItem, "id" | "timestamp" | "read">) => {
    setNotifications((prev) => [
      { id: crypto.randomUUID(), timestamp: new Date(), read: false, ...item },
      ...prev.slice(0, 29), // cap at 30
    ]);
  }, []);

  // ── Browser notification ──────────────────────────────────
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

  // ── Sound toggle (AudioContext created on click = user gesture) ────────────
  function handleSoundToggle() {
    if (!soundEnabled && !audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { /* unsupported */ }
    }
    setSoundEnabled((v) => !v);
  }

  // ── Realtime event handler ────────────────────────────────
  useRealtimeBookings(useCallback((event: RealtimeBookingEvent) => {
    if (event.type === "BOOKING_CREATED") {
      const { customerName, status } = event.booking;
      const isManual  = status === "CONFIRMED";
      const variant: NotifVariant = isManual ? "confirmed" : "new";
      const title     = isManual ? "حجز يدوي جديد" : "حجز جديد";

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
      // Skip low-priority terminal states
      if (status === "COMPLETED" || status === "NO_SHOW" || status === "PENDING") return;

      const variant = variantFromStatus(status);
      const labels: Record<string, string> = {
        CONFIRMED: "تم تأكيد الحجز",
        CANCELLED: "تم إلغاء الحجز",
      };
      const title = labels[status] ?? "تحديث الحجز";

      pushNotification({ variant, title, body: customerName });
      pushToast({ variant, title, body: customerName });

      if (status === "CANCELLED") {
        browserNotify("موعد · إلغاء حجز", customerName);
      }
    }
  }, [pushNotification, pushToast, browserNotify, soundEnabled]));

  // ─────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Top bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-[var(--color-border)] h-16 flex items-center px-5 gap-4">
        {/* Mobile logo */}
        <div className="md:hidden">
          <Logo size="sm" />
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm hidden md:flex items-center gap-2 bg-[var(--color-surface-2)] rounded-xl px-3 py-2">
          <Search size={15} className="text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="ابحث عن حجز أو عميل..."
            className="bg-transparent text-sm outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] w-full"
          />
        </div>

        <div className="ms-auto flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={handleSoundToggle}
            title={soundEnabled ? "إيقاف صوت التنبيهات" : "تشغيل صوت التنبيهات"}
            className="hidden sm:flex w-9 h-9 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] items-center justify-center transition-colors"
          >
            {soundEnabled
              ? <Volume2 size={15} className="text-[var(--color-accent)]" />
              : <VolumeX size={15} className="text-[var(--color-text-muted)]" />
            }
          </button>

          {/* Notification bell + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative w-9 h-9 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] flex items-center justify-center transition-colors"
            >
              <Bell
                size={16}
                className={unreadCount > 0
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)]"
                }
              />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none pointer-events-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <NotificationDropdown
                notifications={notifications}
                onClear={() => setNotifications([])}
              />
            )}
          </div>

          {/* Business avatar */}
          <div className="w-9 h-9 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center text-sm font-bold text-[var(--color-accent)] cursor-pointer select-none">
            {businessName[0]}
          </div>
        </div>
      </header>

      {/* ── Toast stack — fixed, bottom-left (away from sidebar) */}
      <div
        className="fixed bottom-6 left-6 z-50 flex flex-col gap-2.5 pointer-events-none"
        dir="rtl"
      >
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
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { Icon, iconClass, toastClass } = VARIANT_CONFIG[toast.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto animate-toast-in",
        "flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg",
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
}: {
  notifications: NotificationItem[];
  onClear: () => void;
}) {
  // Force re-render every 30 s so relative timestamps stay fresh
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="animate-dropdown-in absolute top-full mt-2 end-0 w-80 bg-white border border-[var(--color-border)] rounded-2xl shadow-xl overflow-hidden z-50"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <p className="text-sm font-bold text-[var(--color-text-primary)]">الإشعارات</p>
        {notifications.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
          >
            مسح الكل
          </button>
        )}
      </div>

      {/* Items */}
      <div className="max-h-[22rem] overflow-y-auto overscroll-contain">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell size={28} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-30" />
            <p className="text-sm text-[var(--color-text-muted)]">لا توجد إشعارات</p>
          </div>
        ) : (
          notifications.map((n) => {
            const { Icon, iconClass } = VARIANT_CONFIG[n.variant];
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-0",
                  n.read ? "bg-white" : "bg-[var(--color-accent-light)]/40",
                )}
              >
                <span className={cn("mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center", iconClass)}>
                  <Icon size={14} />
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    {timeAgo(n.timestamp)}
                  </p>
                </div>

                {!n.read && (
                  <span className="mt-2 shrink-0 w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
