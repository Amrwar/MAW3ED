import { ok } from "@/lib/api";
import { readInvite } from "@/lib/organizations/associations";
import { orgHandle } from "@/lib/organizations/route";

/**
 * GET /api/public/org-invites/:token — what an invitation link shows
 * before sign-up: who is inviting, and until when. The unguessable
 * token is the credential; nothing else about the organization or
 * anyone's data is returned.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return orgHandle("org invite read", async () => {
    const { token } = await params;
    const invite = await readInvite(token);
    return ok({
      invite: {
        organization: invite.organization,
        relation: invite.relation,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  });
}
