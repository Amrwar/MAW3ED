import { cookies, headers } from "next/headers";
import type { Lang } from "@/lib/i18n";
import { LANG_COOKIE, LANG_HEADER } from "@/lib/lang";
import { toEnglish } from "@/lib/api-messages-en";

/**
 * The language an API request is answered in.
 *
 * The proxy decides it for every /api request (lib/locale-routing
 * apiLang): ?lang=en|ar first — the app and some screens ask that way —
 * then the language of the page that made the call (its Referer: a
 * fetch from /en/account-login is English), then the saved choice, the
 * maw3ed-lang cookie. Arabic is the default.
 *
 * A request object, when there is one, is read too, so ?lang= still
 * counts where the proxy did not run.
 *
 * Never throws: outside a request (a script, a unit test without a
 * mock) next/headers throws, and that is Arabic.
 */
export function requestLang(req?: Request): Promise<Lang> {
  if (req) {
    try {
      const asked = new URL(req.url).searchParams.get("lang");
      if (asked === "en" || asked === "ar") return Promise.resolve(asked);
    } catch {
      // Not a URL we can read; fall through to the header.
    }
  }
  try {
    // Called now, not later, so it runs inside the request's context
    // even when the answer is awaited from somewhere else.
    const pending = headers();
    return Promise.resolve(pending)
      .then(async (h): Promise<Lang> => {
        const resolved = h.get(LANG_HEADER);
        if (resolved === "en" || resolved === "ar") return resolved;
        const value = (await cookies()).get(LANG_COOKIE)?.value;
        return value === "en" ? "en" : "ar";
      })
      .catch((): Lang => "ar");
  } catch {
    return Promise.resolve("ar");
  }
}

/** A message for the response body, in the request's language. */
export async function localText(message: string, req?: Request): Promise<string> {
  return (await requestLang(req)) === "en" ? toEnglish(message) : message;
}

const ARABIC = /[\u0600-\u06FF]/;

/**
 * A JSON refusal whose `error` is in the request's language.
 *
 * Synchronous, because err() is — it is thrown as often as returned —
 * while the language comes from next/headers, which is not. So the
 * status and headers are set now and the body is written once the
 * language is known: the Response is complete as far as any caller can
 * tell, and reading it (res.json()) waits for the body as it always
 * does.
 *
 * A message with no Arabic in it (a route that already answered in
 * English) skips all of this.
 */
export function errorResponse(
  body: Record<string, unknown> & { error: string },
  status: number,
  init?: { headers?: Record<string, string> },
): Response {
  if (!ARABIC.test(body.error)) return Response.json(body, { status, headers: init?.headers });

  const lang = requestLang();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const en = (await lang) === "en";
      const out = en ? { ...body, error: toEnglish(body.error, status) } : body;
      controller.enqueue(new TextEncoder().encode(JSON.stringify(out)));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { ...init?.headers, "content-type": "application/json" },
  });
}
