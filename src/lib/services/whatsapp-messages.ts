/**
 * WhatsApp message templates for Maw3ed booking notifications.
 * All messages are Arabic-first with emoji for readability on mobile.
 */

const AR_DAYS: string[] = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];
const AR_MONTHS: string[] = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatDateAr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Use noon to avoid any midnight UTC/local offset shifting the date
  const date = new Date(y, m - 1, d, 12);
  return `${AR_DAYS[date.getDay()]} ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

export interface BookingNotificationData {
  businessName:  string;
  serviceName:   string;
  date:          string; // YYYY-MM-DD
  startTime:     string; // HH:MM
  endTime:       string; // HH:MM
  customerName:  string;
  customerPhone: string;
  totalPrice:    number;
  currency:      string;
  bookingUrl?:   string | null;
}

/**
 * Message sent to the *business owner* when a new public booking arrives.
 * Sent to business.whatsapp ?? business.phone
 */
export function formatBusinessNotification(d: BookingNotificationData): string {
  return [
    `🗓️ *حجز جديد — موعد*`,
    ``,
    `👤 العميل: ${d.customerName}`,
    `📞 رقم الموبايل: ${d.customerPhone}`,
    `✂️ الخدمة: ${d.serviceName}`,
    `📅 التاريخ: ${formatDateAr(d.date)}`,
    `⏰ الوقت: ${d.startTime} – ${d.endTime}`,
    `💰 الإجمالي: ${d.totalPrice.toLocaleString("ar-EG-u-nu-latn")} ${d.currency}`,
    ``,
    `⏳ الحجز مستني تأكيدك — أكّده أو الغيه من لوحة التحكم.`,
  ].join("\n");
}

/**
 * Confirmation message sent to the *customer* after a successful booking.
 * Sent to customerPhone.
 */
export function formatCustomerConfirmation(d: BookingNotificationData): string {
  return [
    `📩 *وصل طلب حجزك!*`,
    ``,
    `🏢 ${d.businessName}`,
    `✂️ الخدمة: ${d.serviceName}`,
    `📅 ${formatDateAr(d.date)}`,
    `⏰ الوقت: ${d.startTime} – ${d.endTime}`,
    ``,
    `${d.businessName} هيأكد الحجز وهيوصلك إشعار.`,
    `شكرًا إنك استخدمت *موعد* 🙏`,
  ].join("\n");
}
