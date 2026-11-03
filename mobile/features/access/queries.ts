import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type { AccessPayload, GuestPassPayload } from "@/types/access";
import { nextPoll, POLL_MAX } from "./logic";

/**
 * The booking page's "getting in": its check-in QR and the venue's visitor
 * passes, from /api/booking/<token>/access — the same endpoint, the same
 * answers as the website. Authorised by the booking's token, like the
 * booking itself; no account needed.
 */
export function useBookingAccess(token: string | undefined, lang: "ar" | "en", enabled = true) {
  const qc = useQueryClient();
  const key = keys.access.booking(token ?? "", lang);
  // Polls while a pass waits on the access system, a bounded number of
  // times (logic.ts). Counted from TanStack's own count of answers since
  // the last change the customer made (`since`), so nothing outside React
  // keeps the count.
  const [since, setSince] = useState(0);
  const answered = (n: number) => Math.max(0, n - since - 1);
  const query = useQuery({
    enabled: Boolean(token) && enabled,
    queryKey: key,
    queryFn: ({ signal }) =>
      api.get<AccessPayload>(`/api/booking/${encodeURIComponent(token!)}/access${lang === "en" ? "?lang=en" : ""}`, {
        anonymous: true,
        signal,
      }),
    staleTime: 15_000,
    refetchInterval: (q) => nextPoll(q.state.data, answered(q.state.dataUpdateCount)),
  });
  const count = qc.getQueryState(key)?.dataUpdateCount ?? 0;
  return {
    ...query,
    /** Done asking on its own: the screen offers "check again". */
    pollsExhausted: answered(count) >= POLL_MAX,
    /** After a change the customer made: a new pass waits again, so the count starts over. */
    resetPolls: () => setSince(qc.getQueryState(key)?.dataUpdateCount ?? 0),
  };
}

/** Every change answers with a fresh read of the whole payload. */
function useAccessAction<V>(token: string, lang: "ar" | "en", call: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSettled: () => qc.invalidateQueries({ queryKey: keys.access.booking(token, lang) }),
  });
}

const base = (token: string) => `/api/booking/${encodeURIComponent(token)}/access`;
const q = (lang: "ar" | "en") => (lang === "en" ? "?lang=en" : "");

export function useRequestPass(token: string, lang: "ar" | "en") {
  return useAccessAction(token, lang, (v: { displayName: string; phone?: string }) =>
    api.post(`${base(token)}/pass${q(lang)}`, v, { anonymous: true }),
  );
}

export function useAddGuest(token: string, lang: "ar" | "en") {
  return useAccessAction(token, lang, (v: { displayName: string; phone?: string }) =>
    api.post<{ inviteToken?: string }>(`${base(token)}/guests${q(lang)}`, v, { anonymous: true }),
  );
}

export function useRemoveGuest(token: string, lang: "ar" | "en") {
  return useAccessAction(token, lang, (guestId: string) =>
    api.delete(`${base(token)}/guests/${encodeURIComponent(guestId)}${q(lang)}`, undefined, { anonymous: true }),
  );
}

export function useRetryPass(token: string, lang: "ar" | "en") {
  return useAccessAction(token, lang, (guestId: string) =>
    api.post(`${base(token)}/guests/${encodeURIComponent(guestId)}/retry${q(lang)}`, undefined, { anonymous: true }),
  );
}

/** A new check-in code; the old one stops working at once. */
export function useNewCheckInCode(token: string, lang: "ar" | "en") {
  return useAccessAction(token, lang, () => api.post(`${base(token)}/check-in${q(lang)}`, undefined, { anonymous: true }));
}

/** A guest's own pass, from the link the holder shared: nothing about the booking or the other guests. */
export function useGuestPass(inviteToken: string | undefined, lang: "ar" | "en") {
  return useQuery({
    enabled: Boolean(inviteToken),
    queryKey: keys.access.guest(inviteToken ?? "", lang),
    queryFn: ({ signal }) =>
      api.get<GuestPassPayload>(`/api/pass/${encodeURIComponent(inviteToken!)}${lang === "en" ? "?lang=en" : ""}`, { anonymous: true, signal }),
    staleTime: 30_000,
  });
}
