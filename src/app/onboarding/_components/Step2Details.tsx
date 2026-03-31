import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "@/components/ui/Button";
import type { OnboardingData } from "./OnboardingForm";

const schema = z.object({
  phone:     z.string().min(8, "أدخل رقم الهاتف"),
  whatsapp:  z.string().optional(),
  address:   z.string().optional(),
  taglineAr: z.string().max(120).optional(),
  about:     z.string().max(600).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  data:   OnboardingData;
  onNext: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
}

export default function Step2Details({ data, onNext, onBack }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone:     data.phone,
      whatsapp:  data.whatsapp,
      address:   data.address,
      taglineAr: data.taglineAr,
      about:     data.about,
    },
  });

  const about = watch("about") ?? "";

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-1">
          تفاصيل عملك
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          بيانات التواصل وعرض قصير عن عملك
        </p>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          رقم الهاتف <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          placeholder="01xxxxxxxxx"
          dir="ltr"
          className="input"
          {...register("phone")}
        />
        {errors.phone && (
          <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
        )}
      </div>

      {/* WhatsApp */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          واتساب{" "}
          <span className="text-[var(--color-text-muted)] text-xs">(اختياري)</span>
        </label>
        <input
          type="tel"
          placeholder="01xxxxxxxxx"
          dir="ltr"
          className="input"
          {...register("whatsapp")}
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          العنوان التفصيلي{" "}
          <span className="text-[var(--color-text-muted)] text-xs">(اختياري)</span>
        </label>
        <input
          type="text"
          placeholder="مثال: ٥ شارع التحرير، المعادي، القاهرة"
          className="input"
          {...register("address")}
        />
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          جملة تعريفية قصيرة{" "}
          <span className="text-[var(--color-text-muted)] text-xs">(اختياري)</span>
        </label>
        <input
          type="text"
          placeholder="مثال: رعاية صحية متكاملة بأحدث التقنيات"
          className="input"
          maxLength={120}
          {...register("taglineAr")}
        />
      </div>

      {/* About */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            نبذة عن عملك{" "}
            <span className="text-[var(--color-text-muted)] text-xs">(اختياري)</span>
          </label>
          <span className="text-xs text-[var(--color-text-muted)]">
            {about.length}/600
          </span>
        </div>
        <textarea
          rows={4}
          placeholder="اكتب وصفًا موجزًا عن عملك، تخصصاتك، وما يميزك..."
          className="input resize-none"
          maxLength={600}
          {...register("about")}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          → رجوع
        </Button>
        <Button type="submit" variant="primary" className="flex-2 flex-1">
          التالي ←
        </Button>
      </div>
    </form>
  );
}
