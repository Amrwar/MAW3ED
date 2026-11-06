export type Service = {
  id: string;
  businessId: string;
  nameAr: string;
  nameEn?: string;
  descriptionAr?: string;
  /** Machine English of descriptionAr (lib/translate). */
  descriptionEn?: string;
  /** Its English name or description was translated by machine. */
  autoEnglish?: boolean;
  duration: number; // in minutes
  price: number;
  currency: string;
  category?: string;
  isAvailable: boolean;
  image?: string;
};

export type TimeSlot = {
  time: string;
  available: boolean;
};

export type BookingStep = "service" | "date" | "time" | "details" | "confirm";
