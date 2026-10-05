/**
 * Structured logging.
 *
 * The app runs on serverless functions, where `console.log` lands in
 * Vercel's runtime logs: ephemeral, unsearchable and impossible to
 * alert on. Worse, 33 `catch {}` blocks were discarding errors
 * entirely, so a failed booking or a rejected Paymob webhook left no
 * trace at all.
 *
 * Everything goes through `log` so that adding a real error tracker
 * (Sentry or otherwise) is one `addSink()` call rather than an edit to
 * every route handler.
 *
 * Runs on server, edge and client — no Node-only APIs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export interface LogRecord {
  level:   LogLevel;
  message: string;
  fields:  LogFields;
  error?:  unknown;
  at:      string;
}

export type LogSink = (record: LogRecord) => void;

/* ─── PII redaction ──────────────────────────────────────────
   Bookings carry customer names, phone numbers and emails. None
   of that should leave the app in a log line, and certainly not
   in a payload sent to a third-party tracker. Redaction happens
   here, before any sink sees the record. */

const SENSITIVE_KEY = /pass|secret|token|authorization|cookie|apikey|api_key|hmac/i;
const PERSONAL_KEY = /phone|whatsapp|email|customername|customer_name|address/i;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** Egyptian mobile numbers, with or without country code. */
const PHONE_RE = /(?:\+?20)?0?1[0125]\d{8}/g;

function maskValue(value: string): string {
  if (value.length <= 4) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function scrubString(value: string): string {
  return value.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (input == null) return input;

  if (typeof input === "string") return scrubString(input);
  if (typeof input === "number" || typeof input === "boolean") return input;

  if (Array.isArray(input)) return input.map((v) => redact(v, depth + 1));

  if (input instanceof Error) {
    return {
      name:    input.name,
      message: scrubString(input.message),
      stack:   input.stack ? scrubString(input.stack) : undefined,
    };
  }

  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = "[redacted]";
      } else if (PERSONAL_KEY.test(key)) {
        out[key] = typeof value === "string" ? maskValue(value) : "[redacted]";
      } else {
        out[key] = redact(value, depth + 1);
      }
    }
    return out;
  }

  return "[unserialisable]";
}

/* ─── Sinks ──────────────────────────────────────────────── */

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info:  20,
  warn:  30,
  error: 40,
};

/** Below this level nothing is emitted. Verbose in dev, quiet in prod. */
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";

const consoleSink: LogSink = (record) => {
  const { level, message, fields, error, at } = record;

  // One JSON line per record in production, so the log is greppable
  // and a drain can parse it. Readable form while developing.
  if (process.env.NODE_ENV === "production") {
    const payload = JSON.stringify({ at, level, message, ...fields, error });
    if (level === "error") console.error(payload);
    else if (level === "warn") console.warn(payload);
    else console.log(payload);
    return;
  }

  const prefix = `[${level}] ${message}`;
  const rest = Object.keys(fields).length ? fields : undefined;
  if (level === "error") console.error(prefix, rest ?? "", error ?? "");
  else if (level === "warn") console.warn(prefix, rest ?? "");
  else console.log(prefix, rest ?? "");
};

const sinks: LogSink[] = [consoleSink];

/**
 * Registers an extra destination for log records — an error tracker,
 * a log drain, a test spy. Records reaching a sink are already
 * redacted.
 *
 * Wiring Sentry, for example, is one call at startup:
 *
 *   addSink((r) => {
 *     if (r.level === "error") Sentry.captureException(r.error ?? r.message, { extra: r.fields });
 *   });
 */
export function addSink(sink: LogSink): void {
  sinks.push(sink);
}

/** Drops every sink but the console. Used by tests. */
export function resetSinks(): void {
  sinks.length = 0;
  sinks.push(consoleSink);
}

/* ─── Public API ─────────────────────────────────────────── */

function emit(level: LogLevel, message: string, fields?: LogFields, error?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const record: LogRecord = {
    level,
    message,
    fields: (redact(fields ?? {}) as LogFields) ?? {},
    error: error === undefined ? undefined : redact(error),
    at: new Date().toISOString(),
  };

  for (const sink of sinks) {
    try {
      sink(record);
    } catch {
      // A broken sink must never break the request it was logging.
    }
  }
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, error?: unknown, fields?: LogFields): void;
  /** A logger that stamps every record with the given fields. */
  child(context: LogFields): Logger;
}

function make(context: LogFields): Logger {
  const merge = (fields?: LogFields) => ({ ...context, ...fields });
  return {
    debug: (m, f) => emit("debug", m, merge(f)),
    info:  (m, f) => emit("info", m, merge(f)),
    warn:  (m, f) => emit("warn", m, merge(f)),
    error: (m, e, f) => emit("error", m, merge(f), e),
    child: (extra) => make({ ...context, ...extra }),
  };
}

export const log: Logger = make({});

/** Logger scoped to one API route, so records carry their origin. */
export function routeLogger(route: string): Logger {
  return log.child({ route });
}
