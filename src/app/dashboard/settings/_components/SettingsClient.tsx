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
export type CategoryItem = { id: string; nameAr: string; nameEn: string; icon: string };
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
    <div style={{ maxWidth: 900, margin: "0 auto" }}>

      {/* ── Premium page header ─────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            style={{
              fontSize:      26,
              fontWeight:    900,
              color:         "#0F172A",
              letterSpacing: "-0.03em",
              lineHeight:    1.2,
            }}
          >
            {st.title}
          </h1>
          <p style={{ fontSize: 13, color: "#94A3B8", marginTop: 5, lineHeight: 1.5 }}>
            إدارة بيانات النشاط التجاري ومعلومات التواصل والهوية
          </p>
        </div>
      </div>

      {/* ── Premium tab strip ───────────────────────────────── */}
      <div className="mb-8 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <div
          className="flex gap-1 p-1 rounded-2xl"
          style={{
            background:   "#F1F5F9",
            width:        "fit-content",
            minWidth:     "max-content",
            border:       "1.5px solid #E2E8F0",
          }}
        >
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 rounded-xl font-semibold transition-all duration-150 whitespace-nowrap"
              style={
                tab === id
                  ? {
                      padding:     "9px 18px",
                      fontSize:    13,
                      background:  "#0F172A",
                      color:       "#FFFFFF",
                      boxShadow:   "0 2px 8px rgba(15,23,42,0.18)",
                    }
                  : {
                      padding:     "9px 18px",
                      fontSize:    13,
                      color:       "#64748B",
                      background:  "transparent",
                    }
              }
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
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
          canUseDeposits={effectivePlan === "PREMIUM"}
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
