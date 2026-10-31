import { escapeHtml } from "@/lib/services/email-templates";
import { INVITE_DAYS } from "./rules";

/**
 * The email inviting somebody to create their business under an
 * organization. The organization's name is the registrant's own text:
 * escaped in the body so it cannot add markup or links to mail sent
 * from our domain, and kept to one line in the subject so it cannot
 * smuggle in a header.
 */
export function orgInviteEmail(organizationName: string, link: string): { subject: string; html: string } {
  const oneLine = organizationName.replace(/[\r\n]+/g, " ").trim();
  return {
    subject: `دعوة من ${oneLine} على موعد`,
    html:
      `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8">` +
      `<p>جهة <b>${escapeHtml(oneLine)}</b> بتدعوك تنشئ صفحة نشاطك على موعد وتنضم لدليلها.</p>` +
      `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>` +
      `<p>الدعوة صالحة ${INVITE_DAYS} يوم. لو مش متوقعها، تجاهل الرسالة.</p></div>`,
  };
}
