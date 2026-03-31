export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type Booking = {
  id: string;
  businessId: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  date: string;
  time: string;
  status: BookingStatus;
  totalPrice: number;
  currency: string;
  notes?: string;
  createdAt: string;
};

export type Testimonial = {
  id: string;
  authorName: string;
  authorRole: string;
  businessName?: string;
  avatarInitials: string;
  rating: number;
  text: string;
  type: "customer" | "business";
};
