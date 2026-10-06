import { redirect } from "next/navigation";

/**
 * Tables moved to Resources.
 *
 * A table is one kind of resource alongside rooms, chairs and
 * equipment, so it is managed on the same page as the rest. Anything
 * still pointing here — a bookmark, an old link in an email — lands in
 * the right place rather than on a 404.
 */
export default function TablesRedirect() {
  redirect("/dashboard/resources");
}
