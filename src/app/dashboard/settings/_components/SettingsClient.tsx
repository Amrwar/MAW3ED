"use client";

import { useState } from "react";
import { User, Clock, Eye, CreditCard, Zap, Bell } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import ProfileForm from "./ProfileForm";
import AvailabilityForm from "./AvailabilityForm";
import PublicPagePreview from "./PublicPagePreview";
import DepositSettingsForm from "./DepositSettingsForm";
import AutoConfirmSetting from "./AutoConfirmSetting";
import NotificationSettingsForm, {
  type NotificationPrefs,
} from "./NotificationSettingsForm";
import SubscriptionPanel from "./SubscriptionPanel";
import { canUseFeature, getMonthlyBookingLimit, type Plan, type SubscriptionStatus } from "@/lib/plans";

export type Profile = {
  id:             string;
  slug:           string;
  nameAr:         string;
  nameEn:         string;
  taglineAr:      string;
  phone:          string;
  whatsapp:       string;
  address:        string;
  /** The owner's pin, or null when none has been set. */
  location:       { lat: number; lng: number } | null;
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
  /** ?tab= from a link such as the setup checklist; "hours" is an alias for availability. */
  initialTab?:        string;
  profile:            Profile;
  availability:       AvailabilityDay[];
  cities:             City[];
  categories:         CategoryItem[];
  services:           ServicePreview[];
  depositEnabled:     boolean;
  depositPercent:     number;
  autoConfirm:        boolean;
  notificationPrefs:  NotificationPrefs;
  plan:               Plan;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd:   string | null;
  effectivePlan:      Plan;
  daysUntilExpiry:    number | null;
};

const TAB_IDS = ["profile", "availability", "payments", "notifications", "subscription", "preview"] as const;
const TAB_ICONS = [User, Clock, CreditCard, Bell, Zap, Eye];

type Tab = typeof TAB_IDS[number];

export default function SettingsClient({
  initialTab,
  profile,
  availability,
  cities,
  categories,
  services,
  depositEnabled,
  depositPercent,
  autoConfirm,
  notificationPrefs,
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  effectivePlan,
  daysUntilExpiry,
}: Props) {
  const [tab,            setTab]            = useState<Tab>(() => {
    const wanted = initialTab === "hours" ? "availability" : initialTab;
    return (TAB_IDS as readonly string[]).includes(wanted ?? "") ? (wanted as Tab) : "profile";
  });
  const [currentProfile, setCurrentProfile] = useState<Profile>(profile);
  const { t } = useLanguage();
  const st = t.dashboard.settings;
  const monthlyLimit = getMonthlyBookingLimit(effectivePlan);

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
              color:         "var(--color-ink)",
              letterSpacing: "-0.03em",
              lineHeight:    1.2,
            }}
          >
            {st.title}
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-subtle)", marginTop: 5, lineHeight: 1.5 }}>
            إدارة بيانات النشاط التجاري ومعلومات التواصل والهوية
          </p>
        </div>
      </div>

      {/* ── Premium tab strip ───────────────────────────────── */}
      <div className="mb-8 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <div
          className="flex gap-1 p-1 rounded-[var(--radius-lg)]"
          style={{
            background:   "var(--color-surface-3)",
            width:        "fit-content",
            minWidth:     "max-content",
            border:       "1.5px solid var(--color-line)",
          }}
        >
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 rounded-[var(--radius-md)] font-semibold transition-all duration-150 whitespace-nowrap"
              style={
                tab === id
                  ? {
                      padding:     "9px 18px",
                      fontSize:    13,
                      background:  "var(--color-ink)",
                      color:       "var(--color-surface)",
                      boxShadow:   "0 2px 8px rgba(17,32,28,0.18)",
                    }
                  : {
                      padding:     "9px 18px",
                      fontSize:    13,
                      color:       "var(--color-muted)",
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
        <>
          <AutoConfirmSetting
            initial={autoConfirm}
            monthlyLimit={Number.isFinite(monthlyLimit) ? monthlyLimit : null}
          />
          <AvailabilityForm initialAvailability={availability} />
        </>
      )}
      {tab === "payments" && (
        <DepositSettingsForm
          initialEnabled={depositEnabled}
          initialPercent={depositPercent}
          canUseDeposits={canUseFeature(effectivePlan, "deposits")}
        />
      )}
      {tab === "notifications" && (
        <NotificationSettingsForm
          initial={notificationPrefs}
          whatsappAvailable={canUseFeature(effectivePlan, "whatsapp")}
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
