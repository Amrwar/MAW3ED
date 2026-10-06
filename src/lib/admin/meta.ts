import type { Metadata } from "next";
import { currentAdmin } from "./guard";
import { can, type Permission } from "./permissions";

/**
 * A title only the right people see.
 *
 * A page's `export const metadata` is resolved before the component
 * runs, and before the layout's guard has refused anybody — so a static
 * title is sent to everyone who asks, including the visitor about to be
 * shown a not-found page. The result is a 404 arriving in a tab headed
 * "Payments", which tells somebody probing exactly what is there.
 *
 * Every admin page uses this instead. The permission is checked the
 * same way the page checks it, and anybody without it gets the title of
 * a page that does not exist.
 */
export function adminMetadata(permission: Permission, title: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const actor = await currentAdmin();
    const allowed = actor !== null && can(actor.role, permission);
    return {
      title: allowed ? title : "غير موجود",
      robots: { index: false, follow: false, nocache: true },
    };
  };
}
