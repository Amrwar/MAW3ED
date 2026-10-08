import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Neon speaks HTTP/WebSocket to its own proxy, not plain Postgres on a
 * socket, so a local database is unreachable through that adapter.
 * Until this existed, running the project at all required credentials
 * to the production database — which meant there was no way to try
 * something destructive without trying it on real customers.
 *
 * Decided by the host in DATABASE_URL rather than by NODE_ENV, because
 * what matters is which database is on the other end, not which mode
 * the process thinks it is in.
 */
function isLocalDatabase(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function createPrismaClient() {
  // Strip channel_binding=require — @neondatabase/serverless uses HTTP/WS
  // transport which doesn't support SCRAM channel binding.
  const connectionString = (process.env.DATABASE_URL ?? "").replace(
    /[&?]channel_binding=require/g,
    ""
  );
  const adapter = isLocalDatabase(connectionString)
    ? new PrismaPg({ connectionString })
    : new PrismaNeon({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
