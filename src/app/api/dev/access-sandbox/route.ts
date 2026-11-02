import { z } from "zod";
import { authorizeCron } from "@/lib/security/cron-auth";
import { log } from "@/lib/logger";
import { sandboxAllowed } from "@/lib/access/provider";
import {
  confirmPendingSandboxPasses,
  ensureSandboxProvider,
  sandboxGateExit,
  sandboxGateScan,
  SANDBOX_MODES,
  SANDBOX_SLUG,
  setSandboxMode,
} from "@/lib/access/sandbox";
import { ingestProviderEvent } from "@/lib/access/events";

/**
 * POST /api/dev/access-sandbox — drives the SANDBOX access provider for
 * QA: its failure mode, its imaginary gate, its delayed confirmations.
 *
 * A 404 wherever the sandbox is not allowed (lib/access/provider.ts:
 * never on Vercel, never in a production build without ACCESS_SANDBOX=1),
 * and only with the cron secret. Events the sandbox raises go through
 * the real, signature-checking ingestion path — or, with deliver: false,
 * come back signed for the caller to POST to the webhook route itself.
 */

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ensure-provider") }),
  z.object({ action: z.literal("mode"), mode: z.enum(SANDBOX_MODES) }),
  z.object({ action: z.literal("gate"), token: z.string().min(1).max(200), gate: z.string().max(100).nullish(), site: z.string().max(120).nullish(), deliver: z.boolean().default(true) }),
  z.object({ action: z.literal("exit"), token: z.string().min(1).max(200), gate: z.string().max(100).nullish() }),
  z.object({ action: z.literal("confirm") }),
]);

function notFound() {
  return new Response("Not found", { status: 404 });
}

async function deliver(event: { raw: string; headers: Headers }) {
  return ingestProviderEvent(SANDBOX_SLUG, event.raw, event.headers);
}

export async function POST(req: Request) {
  if (!sandboxAllowed()) return notFound();
  const allowed = authorizeCron(req, "access-sandbox");
  if (!allowed.ok) return allowed.response;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 422 });
  const body = parsed.data;
  try {
    switch (body.action) {
      case "ensure-provider": {
        const p = await ensureSandboxProvider();
        return Response.json({ ok: true, provider: { id: p.id, slug: p.slug, kind: p.kind } });
      }
      case "mode":
        await setSandboxMode(body.mode);
        return Response.json({ ok: true, mode: body.mode });
      case "gate": {
        const r = await sandboxGateScan(body.token, body.gate ?? null, new Date(), body.site ?? null);
        if (!body.deliver) {
          return Response.json({ ok: true, granted: r.granted, reason: r.reason, event: r.event ? { raw: r.event.raw, headers: Object.fromEntries(r.event.headers) } : null });
        }
        const outcome = r.event ? await deliver(r.event) : null;
        return Response.json({ ok: true, granted: r.granted, reason: r.reason, delivered: outcome });
      }
      case "exit": {
        const r = await sandboxGateExit(body.token, body.gate ?? null);
        const outcome = r.event ? await deliver(r.event) : null;
        return Response.json({ ok: true, delivered: outcome });
      }
      case "confirm": {
        const events = await confirmPendingSandboxPasses();
        const outcomes = [];
        for (const e of events) outcomes.push(await deliver(e));
        return Response.json({ ok: true, confirmed: events.length, outcomes });
      }
    }
  } catch (e) {
    log.error("[access sandbox]", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
