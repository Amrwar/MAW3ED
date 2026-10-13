import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { spacing } from "@/constants/theme";
import { useAuth } from "./AuthProvider";
import type { AppRole } from "./roles";

const SPACE: Record<AppRole, { label: string; href: "/(customer)" | "/(business)" | "/(admin)" }> = {
  customer: { label: "مساحة العميل", href: "/(customer)" },
  business: { label: "إدارة نشاطك", href: "/(business)" },
  admin: { label: "الإدارة", href: "/(admin)" },
};

/**
 * Moving between spaces, for an account that is more than one thing —
 * an owner who also books, an admin who also owns a salon. Shows only
 * the spaces this account may enter (rolesFor), and nothing at all for
 * the common case of one.
 */
export function RoleSwitcher({ current }: { current: AppRole }) {
  const { roles } = useAuth();
  const others = roles.filter((r) => r !== current);
  if (others.length === 0) return null;

  return (
    <Card>
      <Text variant="label" tone="subtle">
        تبديل المساحة
      </Text>
      <View style={styles.row}>
        {others.map((role) => (
          <Button
            key={role}
            label={SPACE[role].label}
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
