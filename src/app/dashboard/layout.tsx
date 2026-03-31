import type { Metadata } from "next";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import { Bell, Search, Menu } from "lucide-react";
import Logo from "@/components/shared/Logo";

export const metadata: Metadata = {
  title: "لوحة التحكم",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main content area */}
      <div className="md:ms-60">
        {/* Top bar */}
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
            {/* Notifications */}
            <button className="relative w-9 h-9 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] flex items-center justify-center transition-colors">
              <Bell size={16} className="text-[var(--color-text-secondary)]" />
              <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-[var(--color-accent)] rounded-full" />
            </button>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center text-sm font-bold text-[var(--color-accent)] cursor-pointer">
              ب
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-5 md:p-6">{children}</main>
      </div>
    </div>
  );
}
