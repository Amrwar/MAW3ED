import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Card, Text, Button, spacing, useLocale } from "@/design";
import { useAuth } from "./AuthProvider";
import type { AppRole } from "./roles";

const SPACE: Record<AppRole, { ar: string; en: string; href: "/(customer)" | "/(business)" | "/(admin)" }> = {
  customer: { ar: "مساحة العميل", en: "Customer space", href: "/(customer)" },
  business: { ar: "إدارة نشاطك", en: "Manage your business", href: "/(business)" },
  admin: { ar: "الإدارة", en: "Admin", href: "/(admin)" },
};

/**
 * Moving between spaces, for an account that is more than one thing —
 * an owner who also books, an admin who also owns a salon. Shows only
 * the spaces this account may enter (rolesFor), and nothing at all for
 * the common case of one.
 */
export function RoleSwitcher({ current }: { current: AppRole }) {
  const { roles } = useAuth();
  const { lang } = useLocale();
  const others = roles.filter((r) => r !== current);
  if (others.length === 0) return null;

  return (
    <Card>
      <Text variant="label" tone="subtle">
        {lang === "ar" ? "تبديل المساحة" : "Switch space"}
      </Text>
      <View style={styles.row}>
        {others.map((role) => (
          <Button
            key={role}
            label={SPACE[role][lang]}
            variant="outline"
            onPress={() => router.replace(SPACE[role].href)}
            style={styles.button}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  button: { flexGrow: 1 },
});
