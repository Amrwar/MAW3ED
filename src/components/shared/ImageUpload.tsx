"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

interface Props {
  value?:    string | null;
  onChange:  (url: string) => void;
  onRemove?: () => void;
  /** "cover" = wide landscape banner; "logo" = small square */
  variant:   "cover" | "logo";
  folder?:   string;
  label?:    string;
}

const ACCEPTED = "image/jpeg,image/png,image/webp";

export default function ImageUpload({
  value,
  onChange,
  onRemove,
  variant,
  folder = "maw3ed/businesses",
  label,
}: Props) {
  const inputRef            = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");

  const isCover = variant === "cover";

  async function handleFile(file: File) {
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب أن يكون أقل من 5MB");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file",   file);
      form.append("folder", folder);

      const res  = await fetch("/api/upload/image", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) { setError(data.error ?? "حدث خطأ أثناء الرفع"); return; }
      onChange(data.url);
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const containerClass = isCover
    ? "relative w-full h-32 rounded-[var(--radius-md)] overflow-hidden"
    : "relative w-20 h-20 rounded-[var(--radius-md)] overflow-hidden";

  const emptyClass = isCover
    ? "w-full h-32 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[var(--color-brand)] hover:bg-[var(--color-accent-light)] transition-colors"
    : "w-20 h-20 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-brand)] hover:bg-[var(--color-accent-light)] transition-colors";

  return (
    <div className="space-y-1.5">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={handleChange}
      />

      {value ? (
        /* Preview with remove and replace controls */
        <div
          className={containerClass}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <img src={value} alt="" className="w-full h-full object-cover" />

          {/* Overlay actions. Hover-only left them invisible on a phone,
              which has no hover, and to a keyboard user tabbing onto them. */}
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs bg-white text-[var(--color-text-primary)] px-2 py-1 rounded-lg font-medium hover:bg-[var(--color-surface-3)] transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : "تغيير"}
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                aria-label="حذف الصورة"
                className="text-xs bg-[var(--color-danger)] text-white px-2 py-1 rounded-lg font-medium hover:bg-[var(--color-danger)] transition-colors"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Empty drop zone */
        <div
          className={emptyClass}
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {uploading ? (
            <Loader2 size={isCover ? 24 : 20} className="text-[var(--color-brand)] animate-spin" />
          ) : (
            <>
              <ImagePlus size={isCover ? 24 : 20} className="text-[var(--color-text-muted)]" />
              {isCover && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  اضغط أو اسحب صورة هنا
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Sub-label / helper */}
      {label && !error && (
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
