/**
 * Every cache key, in one place.
 *
 * Keys written inline drift: one screen caches under ["bookings"] and
 * another under ["my-bookings"], and then cancelling a booking refreshes
 * one list and not the other. Built here instead, so invalidating
 * `keys.myBookings.all` after a change reaches every screen showing
 * them.
 *
 * `as const` throughout, because TanStack compares keys structurally
 * and a widened string[] makes the narrow helpers below useless.
 */
export const keys = {
  businesses: {
    all: ["businesses"] as const,
    search: (query: Record<string, string | number | undefined>) =>
      ["businesses", "search", query] as const,
  },

  myBookings: {
    all: ["my-bookings"] as const,
    scope: (scope: "upcoming" | "history") => ["my-bookings", scope] as const,
  },

  favorites: {
    all: ["favorites"] as const,
  },

  profile: {
    all: ["profile"] as const,
  },

  notifications: {
    all: ["notifications"] as const,
  },

  business: {
    all: ["business"] as const,
    bookings: (filters: Record<string, string | number | undefined>) =>
      ["business", "bookings", filters] as const,
    customers: (search?: string) => ["business", "customers", search ?? ""] as const,
    analytics: (from: string, to: string) => ["business", "analytics", from, to] as const,
  },
} as const;
