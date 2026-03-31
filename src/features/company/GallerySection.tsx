export default function GallerySection() {
  const placeholders = Array.from({ length: 6 });

  return (
    <div className="py-8 border-b border-[var(--color-border)]">
      <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-5">
        الصور
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {placeholders.map((_, i) => (
          <div
            key={i}
            className={`bg-[var(--color-surface-3)] rounded-xl overflow-hidden ${
              i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"
            }`}
          >
            <div className="w-full h-full flex items-center justify-center text-3xl text-[var(--color-text-muted)]">
              📸
            </div>
          </div>
        ))}
      </div>
      <button className="mt-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
        عرض جميع الصور →
      </button>
    </div>
  );
}
