import type { Testimonial } from "@/types/booking";

export type BilingualTestimonial = Testimonial & {
  textEn:       string;
  authorRoleEn: string;
};

export const testimonials: BilingualTestimonial[] = [
  {
    id: "t1",
    authorName: "نور محمد",
    authorRole: "عميلة",
    authorRoleEn: "Customer",
    avatarInitials: "ن م",
    rating: 5,
    text: "موعد غيّر طريقة تعاملي مع الحجوزات تمامًا. الآن أقدر أحجز عند طبيبي في ثواني بدون انتظار على التليفون. تجربة رائعة!",
    textEn: "Maw3ed completely changed the way I handle appointments. Now I can book with my doctor in seconds without waiting on the phone. Amazing experience!",
    type: "customer",
  },
  {
    id: "t2",
    authorName: "أحمد سامي",
    authorRole: "مدير صالون",
    authorRoleEn: "Salon Manager",
    businessName: "صالون أوركيد",
    avatarInitials: "أ س",
    rating: 5,
    text: "منذ انضممنا لموعد، زادت حجوزاتنا بنسبة 40%. الداشبورد سهل الاستخدام، والعملاء دايما راضيين.",
    textEn: "Since joining Maw3ed, our bookings have increased by 40%. The dashboard is easy to use and customers are always satisfied.",
    type: "business",
  },
  {
    id: "t3",
    authorName: "فاطمة علي",
    authorRole: "عميلة",
    authorRoleEn: "Customer",
    avatarInitials: "ف ع",
    rating: 5,
    text: "بحثت عن صالون قريب مني وحجزت في 5 دقايق. الخدمة كانت ممتازة والتذكير بالموعد وصلني على واتساب. أنصح الكل بيه!",
    textEn: "I searched for a nearby salon and booked in 5 minutes. The service was excellent and I got a WhatsApp reminder. I recommend it to everyone!",
    type: "customer",
  },
  {
    id: "t4",
    authorName: "د. محمد خالد",
    authorRole: "طبيب وصاحب عيادة",
    authorRoleEn: "Doctor & Clinic Owner",
    businessName: "عيادة الصحة والأمل",
    avatarInitials: "م خ",
    rating: 5,
    text: "موعد أنقذني من فوضى الحجوزات. مرضاي بيحجزوا بأنفسهم ودايما منظمين. وفّر عليّا ساعات من وقتي يوميًا.",
    textEn: "Maw3ed saved me from booking chaos. My patients book themselves and are always organized. It saves me hours every day.",
    type: "business",
  },
  {
    id: "t5",
    authorName: "مريم حسن",
    authorRole: "عميلة",
    authorRoleEn: "Customer",
    avatarInitials: "م ح",
    rating: 4,
    text: "سهل جدًا وسريع. عجبني إني أقدر أشوف المواعيد المتاحة واختار اللي يناسبني. أفضل تطبيق حجز في مصر.",
    textEn: "Very easy and fast. I love being able to see available slots and choose what works for me. Best booking app in Egypt.",
    type: "customer",
  },
  {
    id: "t6",
    authorName: "لينا رضا",
    authorRole: "صاحبة مركز تجميل",
    authorRoleEn: "Beauty Center Owner",
    businessName: "لينا بيوتي سنتر",
    avatarInitials: "ل ر",
    rating: 5,
    text: "المنصة احترافية جدًا وبتساعدنا نبدو كأننا شركة كبيرة. العملاء بيرجعوا تاني بعد ما يحجزوا معانا على موعد.",
    textEn: "The platform is very professional and helps us look like a big company. Customers always come back after booking with us through Maw3ed.",
    type: "business",
  },
];
