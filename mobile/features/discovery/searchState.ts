import { useSyncExternalStore } from "react";

/**
 * What somebody is searching for, kept outside any screen.
 *
 * Search is a tab, so its screen normally stays mounted — but a business
 * opened from it, a sign-in in between, or Home sending a new search all
 * pass through other screens, and the search must be exactly as it was
 * when they come back. Held here, in memory for the session, and read by
 * the screen; it is not persisted, because yesterday's filters are not
 * what somebody opening the app today expects to find.
 *
 * Parameter names are the API's (src/lib/discovery/params.ts) — note
 * `available`, not `availability`.
 */

export type Sort = "recommended" | "rating" | "most-booked" | "price-asc" | "price-desc" | "soonest";
export type Available = "any" | "today" | "tomorrow" | "open-now";
export type MinRating = 0 | 3 | 3.5 | 4 | 4.5;

export interface Filters {
  category: string;
  subcategory: string;
  city: string;
  neighborhood: string;
  available: Available;
  rating: MinRating;
  /** Whole EGP, or null for no bound. */
  minPrice: number | null;
  maxPrice: number | null;
  verified: boolean;
  /** Confirmed straight away, without the business approving. */
  instant: boolean;
  /** Takes payment online. */
  online: boolean;
  sort: Sort;
}

export const DEFAULT_FILTERS: Filters = {
  category: "",
  subcategory: "",
  city: "",
  neighborhood: "",
  available: "any",
  rating: 0,
  minPrice: null,
  maxPrice: null,
  verified: false,
  instant: false,
  online: false,
  sort: "recommended",
};

export const SORTS: Sort[] = ["recommended", "soonest", "rating", "most-booked", "price-asc", "price-desc"];
export const AVAILABLE: Available[] = ["any", "today", "tomorrow", "open-now"];
export const RATINGS: MinRating[] = [0, 3, 3.5, 4, 4.5];

/** The server caps q at 100 characters; one letter matches nearly everything. */
export const MAX_TERM = 100;
export const MIN_TERM = 2;

/** "" when the term is fine to send; why not, otherwise. */
export function termProblem(term: string): "too-short" | null {
  const t = term.trim();
  return t.length > 0 && t.length < MIN_TERM ? "too-short" : null;
}

/** The query string the API reads, defaults left out so equal searches share a cache entry. */
export function toQuery(term: string, f: Filters): Record<string, string> {
  const q: Record<string, string> = {};
  const t = term.trim().slice(0, MAX_TERM);
  if (t.length >= MIN_TERM) q.q = t;
  if (f.subcategory) q.subcategory = f.subcategory;
  else if (f.category) q.category = f.category;
  if (f.neighborhood && f.city) q.neighborhood = f.neighborhood;
  if (f.city) q.city = f.city;
  if (f.available !== "any") q.available = f.available;
  if (f.rating) q.rating = String(f.rating);
  if (f.minPrice !== null) q.minPrice = String(f.minPrice);
  if (f.maxPrice !== null) q.maxPrice = String(f.maxPrice);
  if (f.verified) q.verified = "1";
  if (f.instant) q.instant = "1";
  if (f.online) q.online = "1";
  if (f.sort !== "recommended") q.sort = f.sort;
  return q;
}

/** How many filters narrow the results — the number on the Filters button. Sort is not one. */
export function activeFilterCount(f: Filters): number {
  return [
    f.category || f.subcategory,
    f.city,
    f.available !== "any",
    f.rating > 0,
    f.minPrice !== null || f.maxPrice !== null,
    f.verified,
    f.instant,
    f.online,
  ].filter(Boolean).length;
}

/** Parameters Home sends with a link into Search. */
export interface Arrival {
  q?: string;
  category?: string;
  city?: string;
  sort?: string;
  available?: string;
}

/**
 * A search opened from elsewhere replaces the current one: Home's
 * "Top rated" means top rated, not top rated within whatever was typed
 * last time.
 */
export function fromArrival(a: Arrival): { term: string; filters: Filters } {
  return {
    term: a.q ?? "",
    filters: {
      ...DEFAULT_FILTERS,
      category: a.category ?? "",
      city: a.city ?? "",
      sort: SORTS.includes(a.sort as Sort) ? (a.sort as Sort) : "recommended",
      available: AVAILABLE.includes(a.available as Available) ? (a.available as Available) : "any",
    },
  };
}

/* ─── The store ──────────────────────────────────────────── */

interface State {
  term: string;
  filters: Filters;
  /** Counts searches sent from elsewhere, so Search can tell a new one from a remount. */
  arrivals: number;
}

let state: State = { term: "", filters: DEFAULT_FILTERS, arrivals: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSearchState() {
  const current = useSyncExternalStore(subscribe, () => state, () => state);
  return {
    ...current,
    setTerm: (term: string) => set({ term: term.slice(0, MAX_TERM) }),
    setFilters: (filters: Filters) => set({ filters }),
    patchFilters: (patch: Partial<Filters>) => set({ filters: { ...state.filters, ...patch } }),
    arrive: (a: Arrival) => set({ ...fromArrival(a), arrivals: state.arrivals + 1 }),
    clearFilters: () => set({ filters: { ...DEFAULT_FILTERS, sort: state.filters.sort } }),
  };
}



/**
 * Start a search from another screen — Home's categories and rails — and
 * then navigate to Search. Written to the store before navigating, from
 * an event handler, never while Search is rendering.
 */
export function startSearch(a: Arrival) {
  set({ ...fromArrival(a), arrivals: state.arrivals + 1 });
}
