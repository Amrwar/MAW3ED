"use client";

import { useState } from "react";
import {
  Loader2, Check, X,
  Palette, LayoutGrid, Phone,
  MapPin, } from "lucide-react";
import type { Profile, City, CategoryItem } from "./SettingsClient";
import ImageUpload from "@/components/shared/ImageUpload";
import LocationField from "@/components/shared/LocationField";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  profile:    Profile;
  cities:     City[];
  categories: CategoryItem[];
  onSaved:    (updated: Partial<Profile>) => void;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:   "var(--color-surface)",
  border:       "1.5px solid var(--color-line)",
  borderRadius: 20,
  boxShadow:    "0 1px 6px rgba(17,32,28,0.05)",
  overflow:     "hidden",
};

const cardHead: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  gap:            12,
  padding:        "14px 22px",
  background:     "var(--color-ground)",
  borderBottom:   "1px solid var(--color-surface-3)",
};

const cardBody: React.CSSProperties = {
  padding: "22px 24px",
};

const label: React.CSSProperties = {
  fontSize:    12,
  fontWeight:  600,
  color:       "var(--color-ink-2)",
  display:     "block",
  marginBottom: 6,
};

const hint: React.CSSProperties = {
  fontSize:   11,
  color:      "var(--color-subtle)",
  marginTop:  3,
};

const fieldBase: React.CSSProperties = {
  width:         "100%",
  borderRadius:  10,
  border:        "1.5px solid var(--color-line)",
  background:    "var(--color-surface-2)",
  color:         "var(--color-ink)",
  fontSize:      14,
  paddingBlock:  10,
  paddingInline: 12,
  outline:       "none",
  transition:    "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  lineHeight:    1.5,
};

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--color-jade)";
  e.currentTarget.style.background  = "var(--color-surface)";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(10,95,71,0.1)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--color-line)";
  e.currentTarget.style.background  = "var(--color-surface-2)";
  e.currentTarget.style.boxShadow   = "none";
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({
  icon,
  title,
  subtitle,
  iconBg = "var(--color-jade-tint)",
  iconColor = "var(--color-jade)",
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
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>{title}</p>
          <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 1 }}>{subtitle}</p>
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
      {/* The control sits inside the label, so the label names it. As a
          sibling it named nothing: every field on this form, the two
          selects included, had no accessible name. */}
      <label style={{ display: "block" }}>
        <span style={label}>
          {labelText}
          {required && <span style={{ color: "var(--color-danger)", marginInlineStart: 3 }}>*</span>}
        </span>
        {children}
      </label>
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
  const [location,   setLocation]   = useState(profile.location);
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
        // null, not undefined: JSON.stringify drops an undefined key
        // entirely, so an emptied field was never sent and the server
        // kept the old value. Removing a photo and saving appeared to
        // do nothing, and so did clearing a phone number or an address.
        body:    JSON.stringify({
          nameAr:     form.nameAr.trim(),
          nameEn:     form.nameEn.trim()     || null,
          taglineAr:  form.taglineAr.trim()  || null,
          phone:      form.phone.trim()      || null,
          whatsapp:   form.whatsapp.trim()   || null,
          address:    form.address.trim()    || null,
          about:      form.about.trim()      || null,
          // These two are required — a business cannot have no city and
          // no category — so an empty one means "unchanged", not "clear".
          cityId:     form.cityId            || undefined,
          categoryId: form.categoryId        || undefined,
          coverImage: coverImage             || null,
          logoImage:  logoImage              || null,
          latitude:   location?.lat ?? null,
          longitude:  location?.lng ?? null,
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
              border:       "1.5px solid var(--color-line)",
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
                border:       "1.5px solid var(--color-line)",
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
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink-2)", marginBottom: 6 }}>
                {isAr ? "شعار مربع عالي الجودة" : "High-quality square logo"}
              </p>
              <p style={{ fontSize: 11, color: "var(--color-subtle)", lineHeight: 1.7 }}>
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
        iconBg="var(--color-jade-tint)"
        iconColor="var(--color-jade)"
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
            label={isAr ? `جملة تعريفية قصيرة (${form.taglineAr.length}/120)` : `Short Tagline (${form.taglineAr.length}/120)`}
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
        iconBg="var(--color-ok-soft)"
        iconColor="var(--color-ok)"
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
                style={{ insetInlineEnd: 12, color: "var(--color-subtle)", pointerEvents: "none" }}
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
                style={{ insetInlineEnd: 12, color: "var(--color-subtle)", pointerEvents: "none", width: 13, height: 13 }}
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
              placeholder={isAr ? "مثال: 4 شارع التحرير، المعادي، القاهرة" : "e.g. 4 Tahrir St., Maadi, Cairo"}
              onFocus={onFocus}
              onBlur={onBlur}
            />
            <MapPin
              size={13}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ insetInlineEnd: 12, color: "var(--color-subtle)", pointerEvents: "none" }}
            />
          </div>
        </Field>

        {/* Pin */}
        <Field
          label={isAr ? "الموقع على الخريطة" : "Location on the map"}
          hint={
            isAr
              ? "افتح مكانك على Google Maps، اضغط مشاركة ← نسخ الرابط، والصقه هنا. بيظهر للعملاء على الخريطة وفي \"قريب مني\" في التطبيق."
              : "Open your place in Google Maps, tap Share → Copy link, and paste it here. Customers see it on the app's map and in \"Near me\"."
          }
        >
          <LocationField
            value={location}
            onChange={(next) => {
              setLocation(next);
              setSuccess(false);
            }}
            inputStyle={fieldBase}
          />
        </Field>
      </Section>

      {/* ── Feedback ─────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3.5"
          style={{ background: "var(--color-danger-soft)", border: "1.5px solid var(--color-danger-line)" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "var(--color-danger-soft)" }}
          >
            <X size={10} strokeWidth={2.5} style={{ color: "var(--color-danger)" }} />
          </div>
          <p style={{ fontSize: 13, color: "var(--color-danger)", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
      {success && (
        <div
          className="flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3.5"
          style={{ background: "var(--color-ok-soft)", border: "1.5px solid var(--color-ok-line)" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-ok-soft)" }}
          >
            <Check size={10} strokeWidth={2.5} style={{ color: "var(--color-ok)" }} />
          </div>
          <p style={{ fontSize: 13, color: "var(--color-ok)", fontWeight: 600 }}>
            {isAr ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully"}
          </p>
        </div>
      )}

      {/* ── Save action bar ─────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-[var(--radius-lg)] px-5 py-4"
        style={{
          background: "var(--color-ground)",
          border:     "1.5px solid var(--color-line)",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 12, color: "var(--color-subtle)" }}>
          {isAr ? "التغييرات ستُحدَّث فوراً على صفحة حجزك العامة" : "Changes will update immediately on your public booking page"}
        </p>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-[var(--radius-md)] font-extrabold text-white transition-all duration-150 disabled:opacity-60 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)] text-[0.8125rem]"
          style={{
            padding:       "10px 22px",
            background:    "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade-hover) 60%, var(--color-jade) 100%)",
            boxShadow:     "0 3px 12px rgba(10,95,71,0.28)",
            border:        "none",
            cursor:        saving ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em" }}
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
