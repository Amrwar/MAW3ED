import { router } from "expo-router";
import { IconButton, colors, useLocale } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { useFavoriteIds, useToggleFavorite } from "./queries";

/**
 * The heart on a card or a business screen.
 *
 * Signed out, it asks the person to sign in rather than pretending to
 * save — a favourite kept only on this phone would vanish on the next
 * one. Signed in, it reflects the server's list and changes at once.
 */
export function FavoriteButton({
  businessId,
  name,
  variant = "plain",
}: {
  businessId: string;
  name: string;
  variant?: "plain" | "filled";
}) {
  const { user } = useAuth();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const ids = useFavoriteIds(Boolean(user));
  const toggle = useToggleFavorite();
  const saved = ids.data?.has(businessId) ?? false;

  return (
    <IconButton
      icon={saved ? "heart" : "heart-outline"}
      color={saved ? colors.danger : undefined}
      variant={variant}
      label={
        saved
          ? ar
            ? `شيل ${name} من المحفوظات`
            : `Remove ${name} from favorites`
          : ar
            ? `احفظ ${name}`
            : `Save ${name}`
      }
      accessibilityState={{ selected: saved }}
      onPress={() => {
        if (!user) {
          router.push("/(auth)/login");
          return;
        }
        toggle.mutate({ businessId, save: !saved });
      }}
    />
  );
}
