import type { OrganizationContract } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { rateLimitWith } from "@/lib/rate-limit";
import { flagOn } from "@/lib/flags";
import { keyMatches, prefixOf } from "./keys";
import type { ApiScope } from "./scopes";

/**
 * Authenticating a request to /api/v1 (docs/enterprise/INTEGRATION_GUIDE.md).
 *
 * `Authorization: Bearer mw_<prefix>_<secret>`. Refused, with one generic
 * answer so a probe learns nothing, when: the key is malformed, unknown,
 * revoked or expired; the organization is not APPROVED; it has no contract
 * in force; or the key lacks the scope. Each client is limited per minute
 * by its contract (429 + Retry-After), and every accepted request counts
 * toward the day's usage.
 */

export interface ApiCaller {
  clientId: string;
  organizationId: string;
  scopes: string[];
  contract: OrganizationContract;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public headers: Record<string, string> = {}) {
    super(code);
  }
}

export function apiError(e: ApiError): Response {
  return Response.json(
    { error: { code: e.code } },
    { status: e.status, headers: { "Cache-Control": "no-store", ...e.headers } },
  );
}

const UNAUTHORIZED = () => new ApiError(401, "unauthorized", { "WWW-Authenticate": 'Bearer realm="maw3ed"' });

export function contractInForce(c: Pick<OrganizationContract, "startsAt" | "endsAt"> | null, now: Date): boolean {
  return !!c && c.startsAt <= now && (!c.endsAt || c.endsAt > now);
}

export async function requireApiClient(req: Request, scope: ApiScope, now: Date = new Date()): Promise<ApiCaller> {
  if (!flagOn("enterpriseApi")) throw new ApiError(503, "api-disabled");
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const prefix = prefixOf(key);
  if (!prefix) throw UNAUTHORIZED();

  const client = await db.apiClient.findUnique({
    where: { keyPrefix: prefix },
    select: {
      id: true, keyHash: true, status: true, expiresAt: true, scopes: true, lastUsedAt: true, organizationId: true,
      organization: { select: { status: true, contract: true } },
    },
  });
  if (!client || !keyMatches(key, client.keyHash)) throw UNAUTHORIZED();
  if (client.status !== "ACTIVE" || (client.expiresAt && client.expiresAt <= now)) throw UNAUTHORIZED();
  if (client.organization.status !== "APPROVED") throw UNAUTHORIZED();
  const contract = client.organization.contract;
  if (!contractInForce(contract, now)) throw new ApiError(403, "no-contract");
  if (!client.scopes.includes(scope)) throw new ApiError(403, "insufficient-scope");

  const limited = await rateLimitWith(`api:${client.id}`, { limit: contract!.apiRequestsPerMinute, windowSeconds: 60 }, client.id);
  if (!limited.ok) {
    throw new ApiError(429, "rate-limited", { "Retry-After": String(limited.retryAfter), "RateLimit-Remaining": "0" });
  }

  // Usage and last-seen: best effort, never failing the request.
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await db.$executeRaw`
    INSERT INTO "ApiUsageDay" ("clientId", "day", "requests") VALUES (${client.id}, ${day}, 1)
    ON CONFLICT ("clientId", "day") DO UPDATE SET "requests" = "ApiUsageDay"."requests" + 1`.catch((e) => log.warn("[api] usage not counted", { e: String(e) }));
  if (!client.lastUsedAt || now.getTime() - client.lastUsedAt.getTime() > 5 * 60_000) {
    await db.apiClient.update({ where: { id: client.id }, data: { lastUsedAt: now } }).catch(() => {});
  }
  return { clientId: client.id, organizationId: client.organizationId, scopes: client.scopes, contract: contract! };
}

/** One handler shape for every /api/v1 route. */
export async function apiHandle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return apiError(e);
    log.error("[api v1]", e);
    return apiError(new ApiError(500, "server-error"));
  }
}

/** Cursor pagination: ?limit= (1..100, default 50) and an opaque ?cursor=. */
export function pageParams(req: Request): { limit: number; cursor: string | null } {
  const q = new URL(req.url).searchParams;
  const n = Number(q.get("limit") ?? 50);
  const limit = Number.isInteger(n) && n >= 1 && n <= 100 ? n : 50;
  const raw = q.get("cursor");
  return { limit, cursor: raw && /^[A-Za-z0-9_-]{1,200}$/.test(raw) ? raw : null };
}

export function encodeCursor(parts: string[]): string {
  return Buffer.from(parts.join("|"), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null): string[] | null {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, "base64url").toString("utf8").split("|");
  } catch {
    return null;
  }
}
