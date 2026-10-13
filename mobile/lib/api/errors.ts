/**
 * What can go wrong, as types.
 *
 * Three kinds, because a screen responds differently to each: a network
 * failure deserves "try again", an unauthorised response means sign in,
 * and a server error means show what the server said. Collapsing them
 * into one Error loses that and every screen invents its own guess.
 */

/** No response at all: no signal, DNS, a timeout, a dead host. */
export class NetworkError extends Error {
  readonly kind = "network" as const;
  constructor(cause?: unknown) {
    // Passed through the options bag rather than declared as a field:
    // Error already owns `cause`, and redeclaring it shadows the one
    // every debugger and logger knows to look for.
    super("تعذّر الاتصال بالإنترنت", { cause });
    this.name = "NetworkError";
  }
}

/** The session is over. The app signs out and shows the login screen. */
export class UnauthorizedError extends Error {
  readonly kind = "unauthorized" as const;
  constructor(message = "انتهت الجلسة، سجّل الدخول من تاني") {
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
    super(message ?? "حصل خطأ، حاول تاني");
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

/** What to put on screen for any thrown value, including unknown ones. */
export function messageFor(e: unknown): string {
  if (isKnownError(e)) return e.message;
  return "حصل خطأ، حاول تاني";
}
