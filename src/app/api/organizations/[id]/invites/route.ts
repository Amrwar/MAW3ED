import { ok, err } from "@/lib/api";
import { siteUrl } from "@/lib/url";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { createEmailInvite } from "@/lib/organizations/associations";
import { emailInviteSchema } from "@/lib/organizations/rules";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { isEmailEnabled, sendEmail } from "@/lib/services/email";

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
        subject: `دعوة من ${organization.nameAr} على موعد`,
        html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8"><p>جهة <b>${organization.nameAr}</b> بتدعوك تنشئ صفحة نشاطك على موعد وتنضم لدليلها.</p><p><a href="${link}">${link}</a></p><p>الدعوة صالحة 14 يوم. لو مش متوقعها، تجاهل الرسالة.</p></div>`,
      });
      emailed = r.ok;
    }
    return ok({ invite: { id: invite.id, expiresAt: invite.expiresAt.toISOString(), link, emailed } }, 201);
  });
}
