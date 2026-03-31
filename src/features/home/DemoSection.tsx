import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { Play, CheckCircle, Star, MapPin, Clock } from "lucide-react";

export default function DemoSection() {
  return (
    <section className="section-padding">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Preview mockup */}
          <div className="relative order-last lg:order-first">
            {/* Phone mockup */}
            <div className="relative mx-auto w-[280px]">
              {/* Phone frame */}
              <div className="relative bg-[var(--color-brand)] rounded-[2.5rem] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.2)]">
                <div className="bg-white rounded-[2rem] overflow-hidden h-[540px]">
                  {/* Status bar */}
                  <div className="bg-[var(--color-brand)] h-8 flex items-center justify-center">
                    <div className="w-24 h-4 bg-black rounded-full" />
                  </div>

                  {/* App content mockup */}
                  <div className="p-4 space-y-3">
                    {/* Business header mini */}
                    <div className="bg-gray-100 rounded-xl h-28 flex items-end p-3">
                      <div>
                        <p className="text-xs font-bold text-[var(--color-text-primary)]">
                          عيادة د. أحمد
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span className="text-[10px] text-gray-500">4.9 (٣١٢ تقييم)</span>
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    <p className="text-xs font-bold text-gray-700">اختر الخدمة</p>
                    {[
                      { name: "كشف باطنة", price: "٢٥٠ ج", dur: "٣٠ د" },
                      { name: "كشف قلب", price: "٤٠٠ ج", dur: "٤٥ د" },
                    ].map((s) => (
                      <div
                        key={s.name}
                        className="border border-[var(--color-border)] rounded-xl p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-semibold">{s.name}</p>
                          <p className="text-[10px] text-gray-400">{s.dur}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs font-bold text-[var(--color-accent)]">
                            {s.price}
                          </p>
                          <button className="text-[9px] bg-[var(--color-brand)] text-white px-2 py-0.5 rounded-full mt-1">
                            احجز
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Time slots */}
                    <p className="text-xs font-bold text-gray-700">
                      اختر الوقت
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {["٩:٠٠", "١٠:٠٠", "١١:٠٠", "١٢:٠٠", "٢:٠٠", "٣:٠٠"].map(
                        (t, i) => (
                          <button
                            key={t}
                            className={`text-[10px] py-1.5 rounded-lg font-medium border transition-colors ${
                              i === 1
                                ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                                : "border-[var(--color-border)] text-gray-600"
                            }`}
                          >
                            {t}
                          </button>
                        )
                      )}
                    </div>

                    {/* Confirm button */}
                    <button className="w-full bg-[var(--color-accent)] text-white text-xs font-bold py-3 rounded-xl mt-2">
                      تأكيد الحجز
                    </button>
                  </div>
                </div>
              </div>

              {/* Floating confirmation card */}
              <div className="absolute -end-8 top-16 bg-white rounded-xl shadow-lg p-3 w-36 border border-[var(--color-border)]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CheckCircle size={12} className="text-green-500" />
                  <span className="text-[10px] font-bold text-green-600">
                    تم الحجز!
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">الأحد، ١٠:٠٠ ص</p>
                <p className="text-[10px] font-semibold text-gray-700">
                  كشف باطنة
                </p>
              </div>

              {/* Floating location card */}
              <div className="absolute -start-8 bottom-20 bg-white rounded-xl shadow-lg p-3 w-36 border border-[var(--color-border)]">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-[var(--color-accent)]" />
                  <span className="text-[10px] font-semibold text-gray-700">
                    المعادي، القاهرة
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: text */}
          <div>
            <p className="section-eyebrow mb-2">معاينة المنصة</p>
            <h2 className="section-title mb-4">
              تجربة حجز
              <br />
              سلسة ومريحة
            </h2>
            <p className="text-[var(--color-text-secondary)] text-base leading-relaxed mb-8">
              صممنا موعد ليكون أسرع وأسهل طريقة للحجز في مصر.
              من البحث حتى التأكيد في خطوات قليلة.
            </p>

            {/* Features list */}
            <div className="space-y-4 mb-8">
              {[
                { icon: "⚡", title: "حجز في ثوانٍ", desc: "بدون تسجيل إلزامي أو انتظار" },
                { icon: "🔔", title: "تذكيرات ذكية", desc: "واتساب وSMS قبل موعدك" },
                { icon: "🗺️", title: "موقع وتوجيه", desc: "خريطة مباشرة لمكان العمل" },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center text-lg shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[var(--color-text-primary)]">
                      {f.title}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="accent" size="lg">
              <Play size={16} />
              شاهد العرض كاملًا
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
