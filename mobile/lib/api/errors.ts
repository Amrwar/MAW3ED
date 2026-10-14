/**
 * What can go wrong, as types.
 *
 * Three kinds, because a screen responds differently to each: a network
 * failure deserves "try again", an unauthorised response means sign in,
 * and a server error means show what the server said. Collapsing them
 * into one Error loses that and every screen invents its own guess.
 */

import type { Lang } from "../format";

/**
 * The app's own words for what went wrong. Arabic is also each error's
 * `message` — what Arabic mode shows; English mode reads MESSAGE_EN via
 * messageFor(e, lang).
 */
const MESSAGE_AR = {
  network: "تعذّر الاتصال بالإنترنت",
  session: "انتهت الجلسة، سجّل الدخول من تاني",
  generic: "حصل خطأ، حاول تاني",
};
const MESSAGE_EN = {
  network: "No internet connection. Check it and try again.",
  session: "Your session has ended. Please sign in again.",
  generic: "Something went wrong. Please try again.",
};

/** No response at all: no signal, DNS, a timeout, a dead host. */
export class NetworkError extends Error {
  readonly kind = "network" as const;
  constructor(cause?: unknown) {
    // Passed through the options bag rather than declared as a field:
    // Error already owns `cause`, and redeclaring it shadows the one
    // every debugger and logger knows to look for.
    super(MESSAGE_AR.network, { cause });
    this.name = "NetworkError";
  }
}

/** The session is over. The app signs out and shows the login screen. */
export class UnauthorizedError extends Error {
  readonly kind = "unauthorized" as const;
  constructor(message: string = MESSAGE_AR.session) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * The server answered and refused.
 *
 * `message` is the server's own Arabic, which is written for a person —
 * the app shows it rather than replacing it with something vaguer.
 */
export class ApiError extends Error {
  readonly kind = "api" as const;
  constructor(
    readonly status: number,
    message?: string | null,
    /**
     * Machine-readable detail some routes send beside the message — a
     * `code` such as "slot-taken" and anything that goes with it — so a
     * screen can act on what happened rather than parse a sentence.
     */
    readonly detail: { code?: string; reason?: string | null; [key: string]: unknown } = {},
  ) {
    super(message ?? MESSAGE_AR.generic);
    this.name = "ApiError";
  }

  get code(): string | undefined {
    return typeof this.detail.code === "string" ? this.detail.code : undefined;
  }

  /** A 4xx is the caller's fault and retrying will not help. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export type KnownError = NetworkError | UnauthorizedError | ApiError;

export function isKnownError(e: unknown): e is KnownError {
  return e instanceof NetworkError || e instanceof UnauthorizedError || e instanceof ApiError;
}

/**
 * English for an answer the server gave in Arabic, keyed by the error's
 * `code` or its HTTP status — a screen passes the ones its request can
 * meet ("401": wrong password on sign-in, wrong code on verify).
 */
export type EnglishFor = Partial<Record<string, string>>;

/** What most statuses mean, whatever was asked. */
const STATUS_EN: Record<number, string> = {
  403: "You don't have access to this.",
  404: "We couldn't find that. It may have been removed.",
  409: "That changed in the meantime. Refresh and try again.",
  413: "That's too large to upload.",
  422: "Some details aren't right. Check them and try again.",
  429: "Too many tries. Wait a moment and try again.",
};

/**
 * What to put on screen for any thrown value, including unknown ones.
 *
 * Arabic shows the server's own words — written for a person, and more
 * specific than anything the app could guess. The server writes only
 * Arabic, so English shows the screen's English for the error's code or
 * status, then the app's general English for the status, and never the
 * Arabic.
 */
export function messageFor(e: unknown, lang: Lang = "ar", english: EnglishFor = {}): string {
  if (lang === "ar") return isKnownError(e) ? e.message : MESSAGE_AR.generic;
  if (e instanceof NetworkError) return MESSAGE_EN.network;
  if (e instanceof UnauthorizedError) return english["401"] ?? MESSAGE_EN.session;
  if (e instanceof ApiError) {
    return (e.code && english[e.code]) || english[String(e.status)] || STATUS_EN[e.status] || MESSAGE_EN.generic;
  }
  return MESSAGE_EN.generic;
}
