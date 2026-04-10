"use client";

import { useState } from "react";
import {
  Loader2, Check, X,
  Palette, LayoutGrid, Phone,
  AlignLeft, Tag, MapPin, Globe,
} from "lucide-react";
import type { Profile, City, CategoryItem } from "./SettingsClient";
import ImageUpload from "@/components/shared/ImageUpload";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  profile:    Profile;
  cities:     City[];
  categories: CategoryItem[];
  onSaved:    (updated: Partial<Profile>) => void;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:   "#FFFFFF",
  border:       "1.5px solid #E2E8F0",
  borderRadius: 20,
  boxShadow:    "0 1px 6px rgba(15,23,42,0.05)",
  overflow:     "hidden",
};

const cardHead: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  gap:            12,
  padding:        "14px 22px",
  background:     "#FAFBFD",
  borderBottom:   "1px solid #F1F5F9",
};

const cardBody: React.CSSProperties = {
  padding: "22px 24px",
};

const label: React.CSSProperties = {
  fontSize:    12,
  fontWeight:  600,
  color:       "#374151",
  display:     "block",
  marginBottom: 6,
};

const hint: React.CSSProperties = {
  fontSize:   11,
  color:      "#94A3B8",
  marginTop:  3,
};

const fieldBase: React.CSSProperties = {
  width:         "100%",
  borderRadius:  10,
  border:        "1.5px solid #E2E8F0",
  background:    "#F8FAFC",
  color:         "#0F172A",
  fontSize:      14,
  paddingBlock:  10,
  paddingInline: 12,
  outline:       "none",
  transition:    "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  lineHeight:    1.5,
};

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#1D4ED8";
  e.currentTarget.style.background  = "#FFFFFF";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(29,78,216,0.1)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#E2E8F0";
  e.currentTarget.style.background  = "#F8FAFC";
  e.currentTarget.style.boxShadow   = "none";
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({
  icon,
  title,
  subtitle,
  iconBg = "#EFF6FF",
  iconColor = "#1D4ED8",
  children,
}: {
  icon:       React.ReactNode;
  title:      string;
  subtitle:   string;
  iconBg?:    string;
  iconColor?: string;
  children:   React.ReactNode;
}) {
  return (
    <div style={card}>
      <div style={cardHead}>
        <div
          style={{
            width:           32,
            height:          32,
            borderRadius:    10,
            background:      iconBg,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            flexShrink:      0,
            color:           iconColor,
          }}
        >
          {icon}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</p>
          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{subtitle}</p>
        </div>
      </div>
      <div style={cardBody}>{children}</div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({
  label: labelText,
  hint: hintText,
  required,
  children,
}: {
  label:     string;
  hint?:     string;
  required?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <div>
      <label style={label}>
        {labelText}
        {required && <span style={{ color: "#EF4444", marginInlineStart: 3 }}>*</span>}
      </label>
      {children}
      {hintText && <p style={hint}>{hintText}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProfileForm({ profile, cities, categories, onSaved }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  const [form, setForm] = useState({
    nameAr:     profile.nameAr,
    nameEn:     profile.nameEn,
    taglineAr:  profile.taglineAr,
    phone:      profile.phone,
    whatsapp:   profile.whatsapp,
    address:    profile.address,
    about:      profile.about,
    cityId:     profile.cityId,
    categoryId: profile.categoryId,
  });
  const [coverImage, setCoverImage] = useState<string | null>(profile.coverImage ?? null);
  const [logoImage,  setLogoImage]  = useState<string | null>(profile.logoImage  ?? null);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  function set(field: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.nameAr.trim()) { setError(isAr ? "اسم العمل مطلوب" : "Business name is required"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/business", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          nameAr:     form.nameAr.trim(),
          nameEn:     form.nameEn.trim()     || undefined,
          taglineAr:  form.taglineAr.trim()  || undefined,
          phone:      form.phone.trim()      || undefined,
          whatsapp:   form.whatsapp.trim()   || undefined,
          address:    form.address.trim()    || undefined,
          about:      form.about.trim()      || undefined,
          cityId:     form.cityId            || undefined,
          categoryId: form.categoryId        || undefined,
          coverImage: coverImage             || undefined,
          logoImage:  logoImage              || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || (isAr ? "حدث خطأ أثناء الحفظ" : "An error occurred while saving")); return; }

      setSuccess(true);
      onSaved({ ...form, coverImage, logoImage });
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(isAr ? "حدث خطأ في الاتصال" : "Connection error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Section 1: Visual Identity ─────────────────────── */}
      <Section
        icon={<Palette size={14} />}
        title={isAr ? "الهوية البصرية" : "Visual Identity"}
        subtitle={isAr ? "شعار النشاط وصورة الغلاف التي تظهر في صفحة الحجز" : "Business logo and cover image shown on the booking page"}
      >
        {/* Cover image */}
        <div style={{ marginBottom: 20 }}>
          <p style={label}>{isAr ? "صورة الغلاف" : "Cover Image"}</p>
          <div
            style={{
              borderRadius: 14,
              overflow:     "hidden",
              border:       "1.5px solid #E2E8F0",
            }}
          >
            <ImageUpload
              variant="cover"
              value={coverImage}
              onChange={setCoverImage}
              onRemove={() => setCoverImage(null)}
            />
          </div>
          <p style={hint}>{isAr ? "JPG أو PNG أو WebP · حتى 5MB · الحجم المقترح: 1200×400px" : "JPG, PNG or WebP · up to 5MB · recommended size: 1200×400px"}</p>
        </div>

        {/* Logo image — side by side with helper text */}
        <div>
          <p style={label}>{isAr ? "شعار النشاط" : "Business Logo"}</p>
          <div className="flex items-start gap-4">
            <div
              style={{
                borderRadius: 14,
                overflow:     "hidden",
                border:       "1.5px solid #E2E8F0",
                flexShrink:   0,
              }}
            >
              <ImageUpload
                variant="logo"
                value={logoImage}
                onChange={setLogoImage}
                onRemove={() => setLogoImage(null)}
              />
            </div>
            <div style={{ paddingTop: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                {isAr ? "شعار مربع عالي الجودة" : "High-quality square logo"}
              </p>
              <p style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.7 }}>
                {isAr ? (
                  <>
                    PNG أو JPG أو WebP · حتى 5MB
                    <br />الحجم المقترح: 400×400px
                    <br />يظهر على بطاقة الحجز وصفحتك العامة
                  </>
                ) : (
                  <>
                    PNG, JPG or WebP · up to 5MB
                    <br />Recommended size: 400×400px
                    <br />Shown on the booking card and your public page
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Section 2: Basic Info ──────────────────────────── */}
      <Section
        icon={<LayoutGrid size={14} />}
        title={isAr ? "المعلومات الأساسية" : "Basic Information"}
        subtitle={isAr ? "اسم النشاط والتخصص والمدينة والنبذة التعريفية" : "Business name, category, city and description"}
        iconBg="#F5F3FF"
        iconColor="#6D28D9"
      >
        {/* Name row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
          <Field label={isAr ? "اسم العمل بالعربية" : "Business Name (Arabic)"} required>
            <input
              value={form.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
              style={fieldBase}
              placeholder={isAr ? "مثال: عيادة الدكتور أحمد" : "e.g. عيادة الدكتور أحمد"}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>
          <Field
            label={isAr ? "اسم العمل بالإنجليزية" : "Business Name (English)"}
            hint={isAr ? "اختياري — للعملاء الدوليين" : "Optional — for international customers"}
          >
            <input
              value={form.nameEn}
              onChange={(e) => set("nameEn", e.target.value)}
              style={fieldBase}
              placeholder="e.g. Dr. Ahmed Clinic"
              dir="ltr"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>
        </div>

        {/* Tagline */}
        <div style={{ marginBottom: 16 }}>
          <Field
            label={isAr ? `شعار قصير (${form.taglineAr.length}/120)` : `Short Tagline (${form.taglineAr.length}/120)`}
            hint={isAr ? "جملة قصيرة تصف نشاطك — تظهر تحت الاسم في الصفحة" : "A short sentence describing your business — shown below the name"}
          >
            <input
              value={form.taglineAr}
              onChange={(e) => set("taglineAr", e.target.value.slice(0, 120))}
              style={fieldBase}
              placeholder={isAr ? "مثال: أفضل خدمات العناية بالبشرة في القاهرة" : "e.g. Best skincare services in Cairo"}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>
        </div>

        {/* Category + City row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
          <Field label={isAr ? "التخصص" : "Category"}>
            <select
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              style={fieldBase}
              onFocus={onFocus}
              onBlur={onBlur}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {isAr ? c.nameAr : c.nameEn}
                </option>
              ))}
            </select>
          </Field>
          <Field label={isAr ? "المدينة" : "City"}>
            <select
              value={form.cityId}
              onChange={(e) => set("cityId", e.target.value)}
              style={fieldBase}
              onFocus={onFocus}
              onBlur={onBlur}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* About */}
        <Field
          label={isAr ? `نبذة عن العمل (${form.about.length}/600)` : `About Your Business (${form.about.length}/600)`}
          hint={isAr ? "وصف مختصر يساعد العملاء على معرفة المزيد — تظهر في صفحة الحجز" : "A brief description to help customers learn more — shown on the booking page"}
        >
          <textarea
            value={form.about}
            onChange={(e) => set("about", e.target.value.slice(0, 600))}
            rows={4}
            style={{ ...fieldBase, resize: "none", lineHeight: 1.7 }}
            placeholder={isAr ? "اكتب وصفًا مختصرًا يساعد العملاء على معرفة المزيد عن عملك..." : "Write a brief description to help customers learn more about your business..."}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </Field>
      </Section>

      {/* ── Section 3: Contact ──────────────────────────────── */}
      <Section
        icon={<Phone size={14} />}
        title={isAr ? "بيانات التواصل" : "Contact Information"}
        subtitle={isAr ? "أرقام الهاتف وواتساب وعنوان النشاط" : "Phone numbers, WhatsApp and business address"}
        iconBg="#ECFDF5"
        iconColor="#065F46"
      >
        {/* Phone + WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
          <Field label={isAr ? "رقم الهاتف" : "Phone Number"}>
            <div className="relative">
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                style={{ ...fieldBase, paddingInlineEnd: 36 }}
                placeholder="01XXXXXXXXX"
                dir="ltr"
                onFocus={onFocus}
                onBlur={onBlur}
              />
              <Phone
                size={13}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ insetInlineEnd: 12, color: "#94A3B8", pointerEvents: "none" }}
              />
            </div>
          </Field>
          <Field
            label={isAr ? "رقم واتساب" : "WhatsApp Number"}
            hint={isAr ? "مع رمز الدولة — مثال: 201XXXXXXXXX+" : "With country code — e.g. +201XXXXXXXXX"}
          >
            <div className="relative">
              <input
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                style={{ ...fieldBase, paddingInlineEnd: 36 }}
                placeholder="201XXXXXXXXX+"
                dir="ltr"
                onFocus={onFocus}
                onBlur={onBlur}
              />
              {/* WhatsApp icon as SVG */}
              <svg
                className="absolute top-1/2 -translate-y-1/2"
                style={{ insetInlineEnd: 12, color: "#94A3B8", pointerEvents: "none", width: 13, height: 13 }}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.523 5.847L.057 23.5l5.802-1.52A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.488-5.184-1.34l-.371-.22-3.444.903.92-3.352-.242-.386A9.938 9.938 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
            </div>
          </Field>
        </div>

        {/* Address */}
        <Field
          label={isAr ? "العنوان" : "Address"}
          hint={isAr ? "الحي والشارع والمدينة كما تريد أن يظهر للعملاء" : "Neighborhood, street and city as you want it shown to customers"}
        >
          <div className="relative">
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              style={{ ...fieldBase, paddingInlineEnd: 36 }}
              placeholder={isAr ? "مثال: ٤ شارع التحرير، المعادي، القاهرة" : "e.g. 4 Tahrir St., Maadi, Cairo"}
              onFocus={onFocus}
              onBlur={onBlur}
            />
            <MapPin
              size={13}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ insetInlineEnd: 12, color: "#94A3B8", pointerEvents: "none" }}
            />
          </div>
        </Field>
      </Section>

      {/* ── Feedback ─────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "#FEE2E2" }}
          >
            <X size={10} strokeWidth={2.5} style={{ color: "#EF4444" }} />
          </div>
          <p style={{ fontSize: 13, color: "#B91C1C", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
      {success && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#DCFCE7" }}
          >
            <Check size={10} strokeWidth={2.5} style={{ color: "#16A34A" }} />
          </div>
          <p style={{ fontSize: 13, color: "#15803D", fontWeight: 600 }}>
            {isAr ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully"}
          </p>
        </div>
      )}

      {/* ── Save action bar ─────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-5 py-4"
        style={{
          background: "#FAFBFD",
          border:     "1.5px solid #E2E8F0",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 12, color: "#94A3B8" }}>
          {isAr ? "التغييرات ستُحدَّث فوراً على صفحة حجزك العامة" : "Changes will update immediately on your public booking page"}
        </p>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl font-black text-white transition-all duration-150 disabled:opacity-60"
          style={{
            padding:       "10px 22px",
            fontSize:      13,
            background:    "linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)",
            boxShadow:     "0 3px 12px rgba(29,78,216,0.28)",
            border:        "none",
            cursor:        saving ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.filter    = "brightness(1.08)";
              el.style.boxShadow = "0 5px 18px rgba(29,78,216,0.38)";
              el.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.filter    = "";
            el.style.boxShadow = "0 3px 12px rgba(29,78,216,0.28)";
            el.style.transform = "";
          }}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {isAr ? "جاري الحفظ..." : "Saving..."}
            </>
          ) : (
            <>
              <Check size={14} />
              {isAr ? "حفظ التغييرات" : "Save Changes"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
