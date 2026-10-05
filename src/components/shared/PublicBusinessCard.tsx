"use client";

import Link from "next/link";
import { MapPin, BadgeCheck } from "lucide-react";
import type { PublicBusiness } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { coverClassFor } from "@/lib/category-cover";

interface Props {
  business: PublicBusiness;
  className?: string;
  /** Taller cover for featured placement rows */
  featured?: boolean;
}

export default function PublicBusinessCard({ business, className, featured = false }: Props) {
  const { t, lang } = useLanguage();
  const card = t.businessCard;
  const isAr = lang === "ar";

  const name = lang === "en" && business.nameEn ? business.nameEn : business.nameAr;
  const catName = isAr
    ? business.category.nameAr
    : (business.category as { nameEn?: string }).nameEn || business.category.nameAr;

  const href = `/company/${business.slug}`;

  return (
    <article className={cn("card card-hover flex h-full flex-col overflow-hidden", className)}>

      <Link href={href} className="relative block shrink-0">
        {business.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.coverImage}
            alt={name}
            className={cn("w-full object-cover", featured ? "h-56" : "h-[11.5rem]")}
          />
        ) : (
          <span
            role="img"
            aria-label={name}
            className={cn("block w-full", coverClassFor(business.category.slug), featured ? "h-56" : "h-[11.5rem]")}
          />
        )}

        <span className="absolute start-3.5 top-3.5 rounded-full bg-white/95 px-3 py-1.5 text-[0.71875rem] font-bold text-[var(--color-ok)]">
          {catName}
        </span>

        {business.isVerified && (
          <span className="absolute end-3.5 top-3.5 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[0.6875rem] font-bold text-[var(--color-ink)]">
            <BadgeCheck size={12} className="shrink-0 text-[var(--color-jade)]" aria-hidden="true" />
            {card.verified}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">

        <div className="min-w-0">
          <h3 className="truncate text-[1.0625rem] font-bold text-[var(--color-ink)]">
            <Link href={href} className="text-inherit hover:text-[var(--color-jade)] transition-colors">
              {name}
            </Link>
          </h3>
          {business.taglineAr && (
            <p className="mt-1.5 line-clamp-1 text-[0.8125rem] text-[var(--color-subtle)]">
              {business.taglineAr}
            </p>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-[0.78125rem] text-[var(--color-subtle)]">
          <MapPin size={13} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
          {business.city.nameAr}
        </p>

        <div className="mt-auto flex items-center gap-3 border-t border-[var(--color-line)] pt-3.5">
          {business.minPrice ? (
            <span className="text-[0.8125rem] text-[var(--color-subtle)]">
              {card.from}{" "}
              <strong className="num text-[0.9375rem] font-extrabold text-[var(--color-ink)]">
                {num(business.minPrice, lang)}
              </strong>{" "}
              {card.currency}
            </span>
          ) : (
            <span className="text-[0.8125rem] text-[var(--color-subtle)]">&nbsp;</span>
          )}

          <Link href={href} className="btn btn-primary btn-sm btn-pill ms-auto shrink-0">
            {card.bookNow}
          </Link>
        </div>
      </div>
    </article>
  );
}
