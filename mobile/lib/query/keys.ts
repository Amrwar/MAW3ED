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
    /** Search pages, loaded one after another — not the same cache shape as a single page. */
    infinite: (query: Record<string, string>) => ["businesses", "infinite", query] as const,
    profile: (slug: string) => ["businesses", "profile", slug] as const,
    reviews: (slug: string, sort: string, rating: number | null) =>
      ["businesses", "reviews", slug, sort, rating] as const,
  },

  facets: (city: string) => ["facets", city] as const,

  myBookings: {
    all: ["my-bookings"] as const,
    scope: (scope: "upcoming" | "history") => ["my-bookings", scope] as const,
  },

  favorites: {
    all: ["favorites"] as const,
    list: ["favorites", "list"] as const,
    ids: ["favorites", "ids"] as const,
  },

  profile: {
    all: ["profile"] as const,
  },

  notifications: {
    all: ["notifications"] as const,
  },

  admin: {
    all: ["admin"] as const,
    overview: ["admin", "overview"] as const,
  },

  business: {
    all: ["business"] as const,
    bookings: (filters: Record<string, string | number | undefined>) =>
      ["business", "bookings", filters] as const,
    customers: (search?: string) => ["business", "customers", search ?? ""] as const,
    analytics: (from: string, to: string) => ["business", "analytics", from, to] as const,
  },
} as const;
