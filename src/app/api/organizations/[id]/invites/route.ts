import { ok, err } from "@/lib/api";
import { siteUrl } from "@/lib/url";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { createEmailInvite } from "@/lib/organizations/associations";
import { emailInviteSchema } from "@/lib/organizations/rules";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { isEmailEnabled, sendEmail } from "@/lib/services/email";
import { orgInviteEmail } from "@/lib/organizations/invite-email";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/organizations/:id/invites — invite somebody by email to
 * CREATE a new business under the organization. The business they
 * create is theirs: their account owns it, with its own dashboard,
 * customers and money; it is simply associated from day one.
 *
 * The invite link is returned either way, so the organization can send
 * it over WhatsApp when email is not configured.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org invites POST", async () => {
    const { id } = await params;
    const { caller, organization, authority } = await requireOrgAccess(id, "org.associations.manage");
    const limited = await rateLimit("orgInvite", caller.userId);
    if (!limited.ok) return tooManyRequests(limited);
    const parsed = emailInviteSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const invite = await createEmailInvite({
      organizationId: id,
      byUserId: caller.userId,
      authority,
      email: parsed.data.email,
      relation: parsed.data.relation,
    });
    const link = siteUrl(`/signup?org_invite=${invite.token}`);
    let emailed = false;
    if (isEmailEnabled()) {
      const r = await sendEmail({
        to: parsed.data.email,
        ...orgInviteEmail(organization.nameAr, link),
      });
      emailed = r.ok;
    }
    return ok({ invite: { id: invite.id, expiresAt: invite.expiresAt.toISOString(), link, emailed } }, 201);
  });
}
