import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus } from "lucide-react";
import Button from "@/components/ui/Button";
import type { OnboardingData } from "./OnboardingForm";

const schema = z.object({
  taglineAr: z.string().max(120).optional(),
  about:     z.string().max(600).optional(),
  address:   z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  data:   OnboardingData;
  onNext: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
}

export default function Step2Details({ data, onNext, onBack }: Props) {
  const { register, handleSubmit, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      taglineAr: data.taglineAr,
      about:     data.about,
      address:   data.address,
    },
  });

  const about    = watch("about")    ?? "";
  const tagline  = watch("taglineAr") ?? "";

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-1">
          تفاصيل عملك
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          أضف وصفًا ومعلومات إضافية تساعد العملاء على معرفتك أكثر
        </p>
      </div>

      {/* Image placeholders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cover */}
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            صورة الغلاف{" "}
            <span className="text-[var(--color-text-muted)] text-xs">(اختياري)</span>
          </p>
          <div className="h-24 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col items-center justify-center gap-1.5 cursor-not-allowed">
            <ImagePlus size={20} className="text-[var(--color-text-muted)]" />
            <p className="text-xs text-[var(--color-text-muted)]">رفع الصور قريبًا</p>
          </div>
        </div>

        {/* Logo */}
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            شعار العمل{" "}
            <span className="text-[var(--color-text-muted)] text-xs">(اختياري)</span>
          </p>
          <div className="h-24 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col items-center justify-center gap-1.5 cursor-not-allowed">
            <ImagePlus size={20} className="text-[var(--color-text-muted)]" />
            <p className="text-xs text-[var(--color-text-muted)]">رفع الشعار قريبًا</p>
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            جملة تعريفية قصيرة{" "}
            <span className="text-[var(--color-text-muted)] text-xs">(اختياري)</span>
          </label>
          <span className="text-xs text-[var(--color-text-muted)]">{tagline.length}/120</span>
        </div>
        <input
          type="text"
          placeholder="مثال: رعاية صحية متكاملة بأحدث التقنيات"
          className="input w-full"
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
          <span className="text-xs text-[var(--color-text-muted)]">{about.length}/600</span>
        </div>
        <textarea
          rows={4}
          placeholder="اكتب وصفًا موجزًا عن عملك، تخصصاتك، وما يميزك عن المنافسين..."
          className="input w-full resize-none"
          maxLength={600}
          {...register("about")}
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
          className="input w-full"
          {...register("address")}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          → رجوع
        </Button>
        <Button type="submit" variant="primary" className="flex-1">
          التالي ←
        </Button>
      </div>
    </form>
  );
}
