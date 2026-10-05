export type Category = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  iconSvg?: string;
  color: string;
  bgColor: string;
  count?: number;
};

export type BusinessHours = {
  day: string;
  dayAr: string;
  open: string;
  close: string;
  closed?: boolean;
};

export type Business = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn?: string;
  category: string;
  categorySlug: string;
  rating: number;
  reviewCount: number;
  location: string;
  locationAr: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  coverImage?: string;
  logoImage?: string;
  images?: string[];
  isVerified: boolean;
  isFeatured?: boolean;
  isOpen?: boolean;
  tags?: string[];
  hours?: BusinessHours[];
  about?: string;
  aboutAr?: string;
  minPrice?: number;
  maxPrice?: number;
};
