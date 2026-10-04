import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { money, duration as fmtDuration } from "@/lib/fmt";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated use `money()` from "@/lib/fmt" — it takes the language. */
export function formatPrice(amount: number, currency = "EGP"): string {
  return money(amount, "ar", currency);
}

/** @deprecated use `duration()` from "@/lib/fmt" — it takes the language. */
export function formatDuration(minutes: number): string {
  return fmtDuration(minutes, "ar");
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}
