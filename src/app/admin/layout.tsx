import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentAdmin } from "@/lib/admin/guard";
import { adminNavFor } from "@/lib/admin/nav";
import { ROLE_LABELS } from "@/lib/admin/permissions";
import AdminShell from "./_components/AdminShell";

export const metadata: Metadata = {
  // Says nothing about what this is. The pages set their own titles,
  // and only once they know the visitor is allowed to be here.
  title: "موعد",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Everything under /admin.
 *
 * The layout checks for *any* admin role and 404s otherwise, which
 * closes the whole tree in one place. It is not the only check: each
 * page guards its own permission, because a layout cannot know which
 * of the sections somebody is allowed into, and because a route that
 * depends on its parent for access is one refactor from being open.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentAdmin();
  if (!actor) notFound();

  return (
    <AdminShell
      sections={adminNavFor(actor.role)}
      actorName={actor.name ?? "مشرف"}
      roleLabel={ROLE_LABELS[actor.role].ar}
    >
      {children}
    </AdminShell>
  );
}
