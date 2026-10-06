import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getAccountUser, getFavorites } from "@/lib/account/queries";
import { translations, type Lang } from "@/lib/i18n";
import { cookies } from "next/headers";
import FavoriteCard from "../_components/FavoriteCard";

export const metadata: Metadata = { title: "محفوظاتي", robots: { index: false, follow: false } };

export default async function FavoritesPage() {
  const user = await getAccountUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  const favorites = await getFavorites(user.id);

  if (favorites.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Heart size={24} strokeWidth={1.7} />}
          title={t.account.emptyFavorites}
          body={t.account.emptyFavoritesBody}
          action={
            <Link href="/businesses" className="btn btn-primary btn-sm">
              {t.account.browse}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {favorites.map((f) => (
        <li key={f.id} className="min-w-0">
          <FavoriteCard business={f.business} />
        </li>
      ))}
    </ul>
  );
}
