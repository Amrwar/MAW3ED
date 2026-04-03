"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import type { Profile, City, CategoryItem } from "./SettingsClient";
import ImageUpload from "@/components/shared/ImageUpload";

type Props = {
  profile:    Profile;
  cities:     City[];
  categories: CategoryItem[];
  onSaved:    (updated: Partial<Profile>) => void;
};

export default function ProfileForm({ profile, cities, categories, onSaved }: Props) {
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

    if (!form.nameAr.trim()) { setError("اسم العمل مطلوب"); return; }

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
      if (!res.ok) { setError(data.error || "حدث خطأ أثناء الحفظ"); return; }

      setSuccess(true);
      onSaved({ ...form, coverImage: coverImage, logoImage: logoImage });
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Image placeholders */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-[var(--color-text-primary)]">الصور</h3>

        {/* Cover */}
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">صورة الغلاف</p>
          <ImageUpload
            variant="cover"
            value={coverImage}
            onChange={setCoverImage}
            onRemove={() => setCoverImage(null)}
            label="JPG أو PNG أو WebP — حتى 5MB"
          />
        </div>

        {/* Logo */}
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">شعار العمل</p>
          <ImageUpload
            variant="logo"
            value={logoImage}
            onChange={setLogoImage}
            onRemove={() => setLogoImage(null)}
            label="شعار مربع — حتى 5MB"
          />
        </div>
      </div>

      {/* Basic info */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-[var(--color-text-primary)]">المعلومات الأساسية</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">
              اسم العمل (عربي) <span className="text-red-500">*</span>
            </label>
            <input
              value={form.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
              className="input w-full mt-1.5"
              placeholder="مثال: عيادة الدكتور أحمد"
            />
          </div>
          <div>
            <label className="form-label">اسم العمل (إنجليزي)</label>
            <input
              value={form.nameEn}
              onChange={(e) => set("nameEn", e.target.value)}
              className="input w-full mt-1.5"
              placeholder="e.g. Dr. Ahmed Clinic"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <label className="form-label">
            شعار قصير{" "}
            <span className="text-[var(--color-text-muted)] font-normal">
              ({form.taglineAr.length}/120)
            </span>
          </label>
          <input
            value={form.taglineAr}
            onChange={(e) => set("taglineAr", e.target.value.slice(0, 120))}
            className="input w-full mt-1.5"
            placeholder="مثال: أفضل خدمات العناية بالبشرة في القاهرة"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">التخصص</label>
            <select
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className="input w-full mt-1.5"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">المدينة</label>
            <select
              value={form.cityId}
              onChange={(e) => set("cityId", e.target.value)}
              className="input w-full mt-1.5"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">
            نبذة عن العمل{" "}
            <span className="text-[var(--color-text-muted)] font-normal">
              ({form.about.length}/600)
            </span>
          </label>
          <textarea
            value={form.about}
            onChange={(e) => set("about", e.target.value.slice(0, 600))}
            rows={4}
            className="input w-full mt-1.5 resize-none"
            placeholder="اكتب وصفًا مختصرًا يساعد العملاء على معرفة المزيد عن عملك..."
          />
        </div>
      </div>

      {/* Contact */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-[var(--color-text-primary)]">بيانات التواصل</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">رقم الهاتف</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="input w-full mt-1.5"
              placeholder="01XXXXXXXXX"
              dir="ltr"
            />
          </div>
          <div>
            <label className="form-label">رقم واتساب</label>
            <input
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              className="input w-full mt-1.5"
              placeholder="201XXXXXXXXX+"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <label className="form-label">العنوان</label>
          <input
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            className="input w-full mt-1.5"
            placeholder="مثال: ٤ شارع التحرير، المعادي، القاهرة"
          />
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-3 rounded-xl flex items-center gap-2">
          <Check size={15} />
          تم حفظ التغييرات بنجاح
        </p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary gap-2 min-w-36"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </form>
  );
}
