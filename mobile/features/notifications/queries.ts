import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type { NotificationsResponse } from "@/types/api";

/**
 * The in-app notification feed — the same one the website shows.
 *
 * Shared by every role: notifications belong to the account, so an
 * owner sees "new booking" here and a customer sees "booking confirmed",
 * from the one endpoint.
 */
export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications.all,
    queryFn: () => api.get<NotificationsResponse>("/api/account/notifications"),
  });
}

export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.patch<{ updated: number }>("/api/account/notifications", { ids }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.notifications.all }),
  });
}

/**
 * For the tab badge. Only asks when somebody is signed in — the customer
 * space is open to everyone, and an anonymous request would only 401.
 * Refreshed every two minutes while the app is open; push takes over
 * when the server sends it.
 */
export function useUnreadCount(signedIn: boolean): number | undefined {
  const query = useQuery({
    queryKey: keys.notifications.all,
    queryFn: () => api.get<NotificationsResponse>("/api/account/notifications"),
    enabled: signedIn,
    refetchInterval: 120_000,
  });
  const unread = query.data?.unread ?? 0;
  return unread > 0 ? unread : undefined;
}
