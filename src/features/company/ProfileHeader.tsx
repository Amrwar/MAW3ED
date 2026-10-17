"use client";

import { useState } from "react";
import { countText } from "@/lib/i18n";
import {
  BadgeCheck,
  CalendarPlus,
  Check,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Star,
} from "lucide-react";
import type { OpenState } from "@/lib/discovery/hours";
import type { RatingSummary } from "@/lib/reviews";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavorites } from "@/hooks/useFavorites";
import { coverClassFor } from "@/lib/category-cover";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { telHref, whatsappHref } from "@/lib/contact";

export interface ProfileHeaderBusiness {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  categoryName: string;
  categorySlug: string;
  cityName: string;
  neighborhoodName: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  coverImage: string | null;
  logoImage: string | null;
  isVerified: boolean;
  open: OpenState;
}

interface Props {
  business: ProfileHeaderBusiness;
  summary: RatingSummary;
}

/** A logo stored in the cover slot is not a cover; treat it as absent. */
function hasRealCover(b: ProfileHeaderBusiness): boolean {
  return !!b.coverImage && b.coverImage !== b.logoImage;
}

/**
 * The top of a profile, in the order the brief asks for: cover, logo,
 * name, verified, rating, category, location, open/closed, then the
 * things you can do.
 *
 * Nothing here is invented. A business with no reviews shows no star
 * line at all rather than a placeholder figure, and an owner who has
 * not set opening hours gets no open/closed badge rather than being
 * reported shut.
 */
export default function ProfileHeader({ business: b, summary }: Props) {
  const { t, lang } = useLanguage();
  const p = t.profile;
  const isAr = lang === "ar";
  const { isFavorite, toggle } = useFavorites();
  const [shared, setShared] = useState(false);

  const name = !isAr && b.nameEn ? b.nameEn : b.nameAr;
  const saved = isFavorite(b.id);

  const place = [b.neighborhoodName, b.cityName].filter(Boolean).join(isAr ? "، " : ", ");
  const directionsQuery = encodeURIComponent([b.address, place, name].filter(Boolean).join(" "));

  async function share() {
    const url = typeof window === "undefined" ? "" : window.location.href;
    // The native sheet where there is one; the clipboard otherwise.
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        // Dismissed, or not permitted. Fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Nothing useful left to try; the URL is in the address bar.
    }
  }

  return (
    <header>
      {/* ── 1. Cover ──
          object-cover used to crop this box, and the box is about five
          times wider than it is tall. Every cover anybody has actually
          uploaded is between 1:1 and 2:1 — a square logo, a poster, a
          photo — so the crop was showing an eighteen percent band
          through the middle and slicing the business's own name in half.

          The image is drawn whole now, with a blurred, scaled copy of
          itself behind it so the box is filled rather than letterboxed
          with empty bars. Works for any shape, which matters because
          nobody uploads a 5:1 image. */}
      <div className="relative overflow-hidden bg-[var(--color-surface-3)]">
        {hasRealCover(b) ? (
          <div className="relative h-[clamp(11rem,26vw,19rem)] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.coverImage!}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-black/15" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.coverImage!}
              alt=""
              className="relative h-full w-full object-contain"
            />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className={cn("h-[clamp(11rem,26vw,19rem)] w-full", coverClassFor(b.categorySlug))}
          />
        )}
      </div>

      <div className="bg-[var(--color-ground)]">
        <div className="container-app pb-6 pt-5">
          <div className="flex flex-wrap items-start gap-5">

            {/* ── 2. Logo ── */}
            {b.logoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.logoImage}
                alt=""
                className="h-[4.75rem] w-[4.75rem] shrink-0 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] object-contain p-2"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] text-[1.625rem] font-extrabold text-[var(--color-jade)]"
              >
                {getInitials(b.nameAr)}
              </span>
            )}

            <div className="min-w-0 flex-[1_1_22rem]">
              {/* ── 3 + 4. Name, verified ── */}
              <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[clamp(1.625rem,4vw,2.375rem)] font-light leading-[1.15] tracking-tight text-[var(--color-ink)]">
                {name}
                {b.isVerified && (
                  <span className="badge badge-accent gap-1 self-center">
                    <BadgeCheck size={12} strokeWidth={2.2} aria-hidden="true" />
                    {p.verified}
                  </span>
                )}
              </h1>

              {/* ── 5 + 6 + 7 + 8. Rating, category, location, hours ── */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.84375rem] text-[var(--color-muted)]">
                {/* Only when somebody has actually reviewed it. */}
                {summary.count > 0 && summary.average !== null && (
                  <a
                    href="#reviews"
                    className="flex min-h-11 items-center gap-1.5 font-bold text-[var(--color-ink)] transition-colors hover:text-[var(--color-jade)]"
                  >
                    <Star
                      size={15}
                      aria-hidden="true"
                      className="fill-[var(--color-star)] text-[var(--color-star)]"
                    />
                    <span className="num">{summary.average.toFixed(1)}</span>
                    <span className="font-normal text-[var(--color-subtle)]">
                      ({countText(lang, summary.count, p.reviewWord)})
                    </span>
                  </a>
                )}

                <span className="badge badge-outline">{b.categoryName}</span>

                <span className="flex items-center gap-1.5">
                  <MapPin size={15} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                  {b.address || place}
                </span>

                {b.open.state === "open" && (
                  <span className="flex items-center gap-1.5 font-bold text-[var(--color-ok)]">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)]" />
                    {p.openNow}
                    <span className="num font-normal text-[var(--color-subtle)]">
                      · {p.until} {b.open.closesAt}
                    </span>
                  </span>
                )}
                {b.open.state === "closed" && (
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-line-2)]" />
                    {p.closed}
                    <span className="num text-[var(--color-subtle)]">
                      · {p.opensAt} {b.open.opensAt}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── 9. Primary actions ── */}
          <div id="profile-actions" className="mt-6 flex flex-wrap items-center gap-2.5">
            <a href="#booking" className="btn btn-primary btn-pill">
              <CalendarPlus size={16} strokeWidth={1.9} aria-hidden="true" />
              {p.bookNow}
            </a>

            {b.whatsapp && (
              <a
                href={whatsappHref(b.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-pill"
              >
                <MessageCircle size={16} strokeWidth={1.9} aria-hidden="true" />
                {p.whatsapp}
              </a>
            )}

            {b.phone && (
              <a href={telHref(b.phone)} className="btn btn-outline btn-pill">
                <Phone size={16} strokeWidth={1.9} aria-hidden="true" />
                {p.call}
              </a>
            )}

            {/* Only offered where there is an address to navigate to. */}
            {(b.address || place) && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${directionsQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-pill"
              >
                <Navigation size={16} strokeWidth={1.9} aria-hidden="true" />
                {p.directions}
              </a>
            )}

            <button type="button" onClick={share} className="btn btn-outline btn-pill">
              {shared ? (
                <Check size={16} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <Share2 size={16} strokeWidth={1.9} aria-hidden="true" />
              )}
              {shared ? p.linkCopied : p.share}
            </button>

            <button
              type="button"
              onClick={() => toggle(b.id)}
              aria-pressed={saved}
              className={cn("btn btn-outline btn-pill", saved && "text-[var(--color-danger)]")}
            >
              <Heart
                size={16}
                strokeWidth={1.9}
                aria-hidden="true"
                className={saved ? "fill-current" : undefined}
              />
              {saved ? p.saved : p.save}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
