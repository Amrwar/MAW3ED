/**
 * Arabic HTML email templates for Maw3ed booking notifications.
 * Plain HTML — no React, no external renderer. Works in all email clients.
 */

import type { BookingEmailData } from "./email";

const AR_DAYS: string[] = [
  "الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت",
];
const AR_MONTHS: string[] = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function formatDateAr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return `${AR_DAYS[date.getDay()]}، ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

// ── Shared layout wrapper ─────────────────────────────────────

function layout(body: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>موعد</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo bar -->
        <tr><td style="background:#6366f1;border-radius:16px 16px 0 0;padding:20px 32px;">
          <p style="margin:0;color:white;font-size:22px;font-weight:900;letter-spacing:-0.5px;">موعد</p>
        </td></tr>

        <!-- Body card -->
        <tr><td style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            أُرسلت هذه الرسالة تلقائيًا من منصة <strong>موعد</strong> · لا تردّ على هذا البريد
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Row helper ────────────────────────────────────────────────

function row(label: string, value: string, ltr = false): string {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;width:40%;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#111827;text-align:${ltr ? "left" : "right"};direction:${ltr ? "ltr" : "rtl"};">${value}</td>
  </tr>`;
}

// ── Customer confirmation template ────────────────────────────

export function customerConfirmationHtml(d: BookingEmailData): string {
  const body = `
    <!-- Heading -->
    <p style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">تم تسجيل حجزك ✅</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">
      أهلًا <strong>${d.customerName}</strong>، تم استلام حجزك بنجاح. سيتواصل معك الفريق قريبًا لتأكيده.
    </p>

    <!-- Details table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${row("المنشأة",   d.businessName)}
      ${row("الخدمة",   d.serviceName)}
      ${row("التاريخ",  formatDateAr(d.date))}
      ${row("الوقت",    `${d.startTime} – ${d.endTime}`, true)}
      ${row("الإجمالي", `${d.totalPrice.toLocaleString("ar-EG")} ${d.currency}`)}
    </table>

    ${d.notes ? `
    <!-- Notes -->
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">ملاحظاتك</p>
      <p style="margin:0;font-size:14px;color:#374151;">${d.notes}</p>
    </div>` : ""}

    <!-- Status pill -->
    <div style="display:inline-block;background:#fef3c7;color:#d97706;padding:6px 16px;border-radius:999px;font-size:13px;font-weight:700;margin-bottom:24px;">
      ⏳ في انتظار التأكيد
    </div>

    ${d.bookingUrl ? `
    <!-- Booking link CTA -->
    <div style="margin-bottom:24px;">
      <a href="${d.bookingUrl}"
         style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;">
        عرض الحجز وإدارته ←
      </a>
    </div>
    <p style="margin:0 0 20px;font-size:12px;color:#9ca3af;">
      احتفظ بهذا الرابط للرجوع إليه في أي وقت وإلغاء الحجز إذا لزم الأمر.
    </p>` : ""}

    <!-- Divider -->
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />

    <p style="margin:0;font-size:13px;color:#9ca3af;">شكرًا لاستخدامك <strong style="color:#6366f1;">موعد</strong> 🙏</p>
  `;
  return layout(body);
}

// ── Customer reminder template ────────────────────────────────

export function customerReminderHtml(d: BookingEmailData): string {
  const body = `
    <!-- Heading -->
    <p style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">تذكير بموعدك غداً ⏰</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">
      أهلًا <strong>${d.customerName}</strong>، هذا تذكير بموعدك المحجوز غداً.
    </p>

    <!-- Details table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${row("المنشأة",   d.businessName)}
      ${row("الخدمة",   d.serviceName)}
      ${row("التاريخ",  formatDateAr(d.date))}
      ${row("الوقت",    `${d.startTime} – ${d.endTime}`, true)}
      ${row("الإجمالي", `${d.totalPrice.toLocaleString("ar-EG")} ${d.currency}`)}
    </table>

    <!-- Reminder note -->
    <div style="background:#eff6ff;border-right:3px solid #3b82f6;border-radius:0 10px 10px 0;padding:12px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#1d4ed8;font-weight:600;">
        📅 موعدك مؤكد — نراك غداً!
      </p>
    </div>

    ${d.bookingUrl ? `
    <!-- Booking management link -->
    <div style="margin-bottom:24px;">
      <a href="${d.bookingUrl}"
         style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;">
        عرض الحجز أو إلغائه ←
      </a>
    </div>` : ""}

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />

    <p style="margin:0;font-size:13px;color:#9ca3af;">شكرًا لاستخدامك <strong style="color:#6366f1;">موعد</strong> 🙏</p>
  `;
  return layout(body);
}

// ── Business owner alert template ─────────────────────────────

export function businessAlertHtml(d: BookingEmailData): string {
  const body = `
    <!-- Heading -->
    <p style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827;">موعد جديد 🗓️</p>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">
      لديك حجز جديد ينتظر تأكيدك في لوحة التحكم.
    </p>

    <!-- Details table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${row("العميل",     d.customerName)}
      ${row("الهاتف",     d.customerPhone, true)}
      ${row("الخدمة",     d.serviceName)}
      ${row("التاريخ",    formatDateAr(d.date))}
      ${row("الوقت",      `${d.startTime} – ${d.endTime}`, true)}
      ${row("الإجمالي",   `${d.totalPrice.toLocaleString("ar-EG")} ${d.currency}`)}
    </table>

    ${d.notes ? `
    <!-- Customer notes -->
    <div style="background:#fff7ed;border-right:3px solid #f97316;border-radius:0 10px 10px 0;padding:12px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">ملاحظات العميل</p>
      <p style="margin:0;font-size:14px;color:#374151;">${d.notes}</p>
    </div>` : ""}

    <!-- CTA -->
    <a href="${process.env.AUTH_URL ?? "https://maw3ed.net"}dashboard/bookings"
       style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;margin-bottom:24px;">
      إدارة الحجوزات ←
    </a>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />

    <p style="margin:0;font-size:13px;color:#9ca3af;">
      تم إرسال هذا التنبيه تلقائيًا من منصة <strong style="color:#6366f1;">موعد</strong>.
    </p>
  `;
  return layout(body);
}
