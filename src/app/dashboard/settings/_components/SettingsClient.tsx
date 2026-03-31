"use client";

import { useState } from "react";
import { User, Clock, Eye } from "lucide-react";
import ProfileForm from "./ProfileForm";
import AvailabilityForm from "./AvailabilityForm";
import PublicPagePreview from "./PublicPagePreview";

export type Profile = {
  id:             string;
  slug:           string;
  nameAr:         string;
  nameEn:         string;
  taglineAr:      string;
  phone:          string;
  whatsapp:       string;
  address:        string;
  about:          string;
  cityId:         string;
  categoryId:     string;
  logoImage:      string | null;
  coverImage:     string | null;
  cityNameAr:     string;
  categoryNameAr: string;
  categoryIcon:   string;
};

export type AvailabilityDay = {
  dayOfWeek: number;
  openTime:  string;
  closeTime: string;
  isClosed:  boolean;
};

export type City         = { id: string; nameAr: string };
export type CategoryItem = { id: string; nameAr: string; icon: string };
export type ServicePreview = { nameAr: string; duration: number; price: number; currency: string };

type Props = {
  profile:      Profile;
  availability: AvailabilityDay[];
  cities:       City[];
  categories:   CategoryItem[];
  services:     ServicePreview[];
};

const TABS = [
  { id: "profile",      label: "الملف التجاري",  Icon: User  },
  { id: "availability", label: "أوقات العمل",    Icon: Clock },
  { id: "preview",      label: "معاينة الصفحة",  Icon: Eye   },
] as const;

type Tab = typeof TABS[number]["id"];

export default function SettingsClient({ profile, availability, cities, categories, services }: Props) {
  const [tab, setTab]             = useState<Tab>("profile");
  const [currentProfile, setCurrentProfile] = useState<Profile>(profile);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[var(--color-text-primary)]">الإعدادات</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          إدارة بيانات عملك وأوقات العمل
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-surface-2)] rounded-xl p-1.5 w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "profile" && (
        <ProfileForm
          profile={currentProfile}
          cities={cities}
          categories={categories}
          onSaved={(updated) => setCurrentProfile((p) => ({ ...p, ...updated }))}
        />
      )}
      {tab === "availability" && (
        <AvailabilityForm initialAvailability={availability} />
      )}
      {tab === "preview" && (
        <PublicPagePreview profile={currentProfile} services={services} />
      )}
    </div>
  );
}
