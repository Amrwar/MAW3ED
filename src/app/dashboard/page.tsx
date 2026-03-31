import type { Metadata } from "next";
import { CalendarDays, ExternalLink } from "lucide-react";
import StatsCards from "@/features/dashboard/StatsCards";
import RecentBookings from "@/features/dashboard/RecentBookings";
import QuickActions from "@/features/dashboard/QuickActions";
import Button from "@/components/ui/Button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "لوحة التحكم | موعد",
};

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">
            أهلًا، صالون بيلا 👋
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/company/bella-salon"
            target="_blank"
            className="btn btn-outline btn-sm gap-1.5 text-sm"
          >
            <ExternalLink size={14} />
            عرض صفحتك
          </Link>
          <Button variant="primary" size="sm" className="gap-1.5">
            <CalendarDays size={14} />
            حجز جديد
          </Button>
        </div>
      </div>

      {/* Alert / onboarding nudge */}
      <div className="bg-[var(--color-accent-light)] border border-[var(--color-accent)]/20 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--color-accent)] mb-0.5">
            اكمل إعداد ملفك ⚡
          </p>
          <p className="text-xs text-[var(--color-accent)]/70">
            أضف صورك وخدماتك لتظهر في نتائج البحث وتجذب عملاء أكثر.
          </p>
        </div>
        <Button variant="accent" size="sm" className="shrink-0">
          اكمل الآن
        </Button>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Today's schedule */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-text-primary)]">
            مواعيد اليوم
          </h3>
          <span className="badge badge-accent text-xs">٣ مواعيد</span>
        </div>

        <div className="space-y-2.5">
          {[
            { time: "١٠:٠٠ ص", name: "نور محمد", service: "كشف باطنة", status: "confirmed" },
            { time: "١١:٣٠ ص", name: "أحمد علي", service: "كشف قلب", status: "pending" },
            { time: "٠٢:٠٠ م", name: "سارة حسن", service: "كشف أطفال", status: "confirmed" },
          ].map((appt, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <div className="text-center min-w-[52px]">
                <p className="text-xs font-bold text-[var(--color-text-primary)]">
                  {appt.time}
                </p>
              </div>
              <div className="w-px h-8 bg-[var(--color-border)]" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {appt.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {appt.service}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  appt.status === "confirmed"
                    ? "bg-green-50 text-green-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {appt.status === "confirmed" ? "مؤكد" : "انتظار"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentBookings />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>

      {/* Empty state placeholder for analytics */}
      <div className="card p-8 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="font-bold text-[var(--color-text-primary)] mb-1">
          إحصائيات مفصّلة
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          شوف تقارير الإيرادات والعملاء والحجوزات بالتفصيل
        </p>
        <Button variant="outline" size="sm">
          عرض الإحصائيات
        </Button>
      </div>
    </div>
  );
}
