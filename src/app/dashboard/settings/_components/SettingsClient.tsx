"use client";

import { useState } from "react";
import { User, Clock, Eye, CreditCard, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import ProfileForm from "./ProfileForm";
import AvailabilityForm from "./AvailabilityForm";
import PublicPagePreview from "./PublicPagePreview";
import DepositSettingsForm from "./DepositSettingsForm";
import SubscriptionPanel from "./SubscriptionPanel";
import type { Plan, SubscriptionStatus } from "@/lib/plans";

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
  profile:            Profile;
  availability:       AvailabilityDay[];
  cities:             City[];
  categories:         CategoryItem[];
  services:           ServicePreview[];
  depositEnabled:     boolean;
  depositPercent:     number;
  plan:               Plan;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd:   string | null;
  effectivePlan:      Plan;
  daysUntilExpiry:    number | null;
};

const TAB_IDS = ["profile", "availability", "payments", "subscription", "preview"] as const;
const TAB_ICONS = [User, Clock, CreditCard, Zap, Eye];

type Tab = typeof TAB_IDS[number];

export default function SettingsClient({
  profile,
  availability,
  cities,
  categories,
  services,
  depositEnabled,
  depositPercent,
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  effectivePlan,
  daysUntilExpiry,
}: Props) {
  const [tab,            setTab]            = useState<Tab>("profile");
  const [currentProfile, setCurrentProfile] = useState<Profile>(profile);
  const { t } = useLanguage();
  const st = t.dashboard.settings;

  const TABS = TAB_IDS.map((id, i) => ({
    id,
    label: st.tabs[id as keyof typeof st.tabs],
    Icon:  TAB_ICONS[i],
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[var(--color-text-primary)]">{st.title}</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          {st.subtitle}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-[var(--color-surface-2)] rounded-xl p-1.5 w-fit">
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
      {tab === "payments" && (
        <DepositSettingsForm
          initialEnabled={depositEnabled}
          initialPercent={depositPercent}
          canUseDeposits={effectivePlan === "PRO"}
        />
      )}
      {tab === "subscription" && (
        <SubscriptionPanel
          plan={plan}
          subscriptionStatus={subscriptionStatus}
          currentPeriodEnd={currentPeriodEnd}
          effectivePlan={effectivePlan}
          daysUntilExpiry={daysUntilExpiry}
        />
      )}
      {tab === "preview" && (
        <PublicPagePreview profile={currentProfile} services={services} />
      )}
    </div>
  );
}
