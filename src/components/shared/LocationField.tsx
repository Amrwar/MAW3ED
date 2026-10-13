"use client";

import { useState } from "react";
import { MapPin, X, ExternalLink } from "lucide-react";
import { isShortMapsLink, mapsUrl, parseLocation, type LatLng } from "@/lib/geo";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * The pin customers see on the app's map and use for "near me".
 *
 * Paste a Google Maps link to the place (or type "lat, lng"); the
 * coordinates are read out of it on the spot and shown back with a link
 * to check them. Nothing is looked up from the written address — a pin
 * the owner did not set is a pin that is not there.
 */
export default function LocationField({
  value,
  onChange,
  inputStyle,
}: {
  value: LatLng | null;
  onChange: (next: LatLng | null) => void;
  inputStyle?: React.CSSProperties;
}) {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function read(raw: string) {
    setText(raw);
    if (!raw.trim()) {
      setError(null);
      return;
    }
    const found = parseLocation(raw);
    if (found) {
      onChange(found);
      setText("");
      setError(null);
      return;
    }
    setError(
      isShortMapsLink(raw)
        ? isAr
          ? "اللينك القصير مفيهوش الإحداثيات. افتحه في المتصفح وانسخ اللينك الطويل من شريط العنوان."
          : "Short links don't contain the coordinates. Open it in a browser and copy the full link from the address bar."
        : isAr
          ? "مش لاقيين إحداثيات في اللي اتكتب. الصق لينك المكان من Google Maps أو اكتب: 30.0444, 31.2357"
          : "No coordinates found. Paste the place's Google Maps link, or type e.g. 30.0444, 31.2357",
    );
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-[0.8125rem]">
          <MapPin size={14} className="shrink-0 text-[var(--color-jade)]" aria-hidden="true" />
          <span dir="ltr" className="num font-semibold text-[var(--color-ink)]">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
          <a
            href={mapsUrl(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto inline-flex items-center gap-1 text-[var(--color-jade)] hover:underline"
          >
            {isAr ? "اتأكد على الخريطة" : "Check on map"} <ExternalLink size={12} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded p-1 text-[var(--color-subtle)] hover:bg-[var(--color-surface-3)]"
            aria-label={isAr ? "شيل الموقع" : "Remove location"}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <input
        value={text}
        onChange={(e) => read(e.target.value)}
        dir="ltr"
        inputMode="url"
        style={inputStyle}
        className={inputStyle ? undefined : "w-full rounded-[var(--radius-md)] border border-[var(--color-line-2)] px-3 py-2 text-[0.875rem]"}
        placeholder={value ? (isAr ? "الصق لينك جديد عشان تغيّر الموقع" : "Paste a new link to change it") : "https://www.google.com/maps/place/…"}
        aria-label={isAr ? "لينك الموقع على Google Maps" : "Google Maps link"}
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <p role="alert" className="m-0 text-[0.75rem] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
