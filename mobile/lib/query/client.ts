import { QueryClient } from "@tanstack/react-query";
import { ApiError, NetworkError, UnauthorizedError } from "@/lib/api/errors";

/**
 * Server state, configured for a phone.
 *
 * The defaults differ from the web's in two ways that matter on mobile:
 * a request can fail because the person walked into a lift, and data
 * goes stale while the app sits in the background.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A network blip is worth retrying; a 404 or a 422 is not, and
        // retrying an unauthorised request three times just delays the
        // sign-out by three round trips.
        retry: (failureCount, error) => {
          if (error instanceof UnauthorizedError) return false;
          if (error instanceof ApiError && error.isClientError) return false;
          if (error instanceof NetworkError) return failureCount < 3;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        // Long enough that moving between tabs does not refetch
        // everything, short enough that a booking made on the web shows
        // up when the owner opens the app.
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        // Coming back to the app refetches what is on screen only if it
        // is older than staleTime (lib/query/connectivity.ts) — an owner
        // returning to Today after an hour sees this hour's bookings,
        // while flicking between apps costs nothing.
        refetchOnWindowFocus: true,
        // And when the connection comes back, the same.
        refetchOnReconnect: true,
      },
      mutations: {
        // A mutation that failed may have succeeded on the server. Not
        // retried automatically for that reason — a double booking is
        // worse than an error message.
        retry: false,
        // Offline, a booking or a payment fails at once and says so,
        // rather than queueing silently and firing whenever the
        // connection returns — perhaps long after the person gave up.
        networkMode: "always",
      },
    },
  });
}
