import type { Metadata } from "next";
import { getAccountUser, getNotifications } from "@/lib/account/queries";
import NotificationList from "../_components/NotificationList";

export const metadata: Metadata = { title: "الإشعارات", robots: { index: false, follow: false } };

export default async function NotificationsPage() {
  const user = await getAccountUser();
  if (!user) return null;

  const { items, unread, nextCursor } = await getNotifications(user.id);

  return (
    <NotificationList
      initial={items.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        href: n.href,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      }))}
      initialUnread={unread}
      initialCursor={nextCursor}
    />
  );
}
