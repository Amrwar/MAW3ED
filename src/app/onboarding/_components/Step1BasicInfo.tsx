import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Category, City } from "@prisma/client";
import Button from "@/components/ui/Button";
import type { OnboardingData } from "./OnboardingForm";

const schema = z.object({
  nameAr:     z.string().min(2, "أدخل اسم العمل بالعربية"),
  nameEn:     z.string().optional(),
  categoryId: z.string().min(1, "اختر التخصص"),
  cityId:     z.string().min(1, "اختر المدينة"),
  phone:      z.string().min(8, "أدخل رقم الهاتف"),
  whatsapp:   z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  data:       OnboardingData;
  categories: Category[];
  cities:     City[];
  onNext:     (d: Partial<OnboardingData>) => void;
}

export default function Step1BasicInfo({ data, categories, cities, onNext }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nameAr:     data.nameAr,
      nameEn:     data.nameEn,
      categoryId: data.categoryId,
      cityId:     data.cityId,
      phone:      data.phone,
      whatsapp:   data.whatsapp,
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-1">
          مرحبًا! لنبدأ بمعلوماتك الأساسية
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          هذه المعلومات ستظهر على صفحتك العامة للعملاء
        </p>
      </div>

      {/* Arabic name */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          اسم العمل بالعربية <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="مثال: عيادة د. أحمد، صالون بيلا"
          className="input w-full"
          {...register("nameAr")}
        />
        {errors.nameAr && (
          <p className="mt-1 text-xs text-red-500">{errors.nameAr.message}</p>
        )}
      </div>

      {/* English name */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          اسم العمل بالإنجليزية{" "}
          <span className="text-[var(--color-text-muted)] text-xs">(اختياري — يُستخدم لتوليد الرابط)</span>
        </label>
        <input
          type="text"
          placeholder="Dr. Ahmed Clinic"
          dir="ltr"
          className="input w-full"
          {...register("nameEn")}
        />
      </div>

      {/* Category + City */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            التخصص <span className="text-red-500">*</span>
          </label>
          <select className="input w-full" {...register("categoryId")}>
            <option value="">-- اختر التخصص --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.nameAr}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="mt-1 text-xs text-red-500">{errors.categoryId.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            المدينة <span className="text-red-500">*</span>
          </label>
          <select className="input w-full" {...register("cityId")}>
            <option value="">-- اختر المدينة --</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
          {errors.cityId && (
            <p className="mt-1 text-xs text-red-500">{errors.cityId.message}</p>
          )}
        </div>
      </div>

      {/* Phone + WhatsApp */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            رقم الهاتف <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            placeholder="01XXXXXXXXX"
            dir="ltr"
            className="input w-full"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            واتساب{" "}
            <span className="text-[var(--color-text-muted)] text-xs">(اختياري)</span>
          </label>
          <input
            type="tel"
            placeholder="201XXXXXXXXX+"
            dir="ltr"
            className="input w-full"
            {...register("whatsapp")}
          />
        </div>
      </div>

      <Button type="submit" variant="primary" fullWidth className="mt-2">
        التالي ←
      </Button>
    </form>
  );
}
