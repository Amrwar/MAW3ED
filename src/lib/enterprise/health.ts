import { db } from "@/lib/db";
import { contractInForce } from "./auth";

/**
 * An organization's integration health for its console
 * (docs/enterprise/ARCHITECTURE.md): its contract and usage, its keys and
 * webhook endpoints, its venues' visitor-access status, and — where a
 * brand it OWNS shares FINANCE — that brand's plan. Counts and states
 * only; no secret, no key, no customer.
 */
export async function integrationHealth(organizationId: string, now: Date = new Date()) {
  const day = new Date(now.getTime() - 86_400_000);
  const month = new Date(now.getTime() - 30 * 86_400_000);
  const [contract, clients, usage, endpoints, venues, finance] = await Promise.all([
    db.organizationContract.findUnique({ where: { organizationId } }),
    db.apiClient.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
    db.apiUsageDay.aggregate({ where: { client: { organizationId }, day: { gte: month } }, _sum: { requests: true } }),
    db.webhookEndpoint.findMany({
      where: { organizationId },
      select: {
        id: true, url: true, status: true, consecutiveFailures: true, disabledReason: true, lastSuccessAt: true, lastFailureAt: true,
        _count: { select: { deliveries: { where: { status: "DEAD", updatedAt: { gte: day } } } } },
      },
    }),
    db.venue.findMany({
      where: { organizationId },
      select: {
        id: true, nameAr: true, nameEn: true, accessEnabled: true,
        accessProvider: { select: { slug: true, kind: true, isEnabled: true, lastHealthAt: true, lastHealthOk: true } },
        accessCredential: { select: { keyVersion: true, rotatedAt: true, revokedAt: true } },
      },
      take: 100,
    }),
    db.organizationBusiness.findMany({
      where: { organizationId, relation: "OWNED", status: "APPROVED", suspendedAt: null, scopes: { has: "FINANCE" } },
      select: { business: { select: { id: true, nameAr: true, plan: true, subscriptionStatus: true, trialEndsAt: true } } },
      take: 200,
    }),
  ]);
  const venueIds = venues.map((v) => v.id);
  const deadJobs = venueIds.length
    ? await db.accessSyncJob.groupBy({
        by: ["credentialId"],
        where: { status: "DEAD", updatedAt: { gte: day }, credential: { entitlement: { venueId: { in: venueIds } } } },
        _count: { _all: true },
      })
    : [];
  const deadByVenue = new Map<string, number>();
  if (deadJobs.length) {
    const creds = await db.accessCredential.findMany({
      where: { id: { in: deadJobs.map((d) => d.credentialId) } },
      select: { id: true, entitlement: { select: { venueId: true } } },
    });
    const venueOf = new Map(creds.map((c) => [c.id, c.entitlement.venueId]));
    for (const d of deadJobs) {
      const v = venueOf.get(d.credentialId);
      if (v) deadByVenue.set(v, (deadByVenue.get(v) ?? 0) + d._count._all);
    }
  }
  return {
    contract: contract ? { reference: contract.reference, startsAt: contract.startsAt, endsAt: contract.endsAt, inForce: contractInForce(contract, now), maxApiClients: contract.maxApiClients, maxWebhooks: contract.maxWebhooks, apiRequestsPerMinute: contract.apiRequestsPerMinute } : null,
    apiKeys: Object.fromEntries(clients.map((c) => [c.status, c._count._all])),
    apiRequests30d: usage._sum.requests ?? 0,
    webhooks: endpoints.map((e) => ({
      id: e.id, host: safeHost(e.url), status: e.status, consecutiveFailures: e.consecutiveFailures, disabledReason: e.disabledReason,
      lastSuccessAt: e.lastSuccessAt, lastFailureAt: e.lastFailureAt, dead24h: e._count.deliveries,
    })),
    venues: venues.map((v) => ({
      id: v.id, nameAr: v.nameAr, nameEn: v.nameEn, accessEnabled: v.accessEnabled,
      provider: v.accessProvider ? { slug: v.accessProvider.slug, kind: v.accessProvider.kind, enabled: v.accessProvider.isEnabled, lastHealthAt: v.accessProvider.lastHealthAt, lastHealthOk: v.accessProvider.lastHealthOk } : null,
      credential: v.accessCredential ? { keyVersion: v.accessCredential.keyVersion, rotatedAt: v.accessCredential.rotatedAt, revoked: !!v.accessCredential.revokedAt } : null,
      deadJobs24h: deadByVenue.get(v.id) ?? 0,
    })),
    subscriptions: finance.map((f) => ({ businessId: f.business.id, nameAr: f.business.nameAr, plan: f.business.plan, status: f.business.subscriptionStatus, trialEndsAt: f.business.trialEndsAt })),
  };
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
