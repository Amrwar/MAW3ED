import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Logo from "@/components/shared/Logo";
import { db } from "@/lib/db";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.id) {
    // Verify the business actually exists in DB — don't trust the JWT alone.
    // A stale token with a deleted businessId would otherwise cause an infinite loop
    // between /onboarding and /dashboard.
    const existing = await db.business.findUnique({
      where:  { ownerId: session.user.id },
      select: { id: true },
    });
    if (existing) redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)] flex flex-col">
      <header className="h-14 flex items-center px-5 bg-white border-b border-[var(--color-border)]">
        <Logo size="sm" />
        <span className="ms-3 text-sm text-[var(--color-text-muted)]">
          إعداد عملك
        </span>
      </header>
      <main className="flex-1 flex flex-col items-center justify-start py-8 px-4">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
