import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Screen, Text, Card, Button, spacing, useLocale } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { VERSION_LABEL } from "@/constants/version";
import { DesignSystemLink } from "@/features/dev/DesignSystemLink";

export default function AdminAccount() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const { lang } = useLocale();
  const T = (a: string, e: string) => (lang === "ar" ? a : e);

  return (
    <Screen
      hero={
        <Text variant="display" tone="inverse" accessibilityRole="header">
          {T("حسابي", "Account")}
        </Text>
      }
    >
      <View style={styles.stack}>
        <Card>
          <Text variant="bodyBold">{user?.name ?? user?.email ?? "—"}</Text>
          <Text variant="caption" tone="subtle">
            {user?.adminRole}
          </Text>
        </Card>
        <RoleSwitcher current="admin" />
        <Button
          label={T("تسجيل الخروج", "Sign out")}
          variant="outline"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await signOut();
            } finally {
              setBusy(false);
            }
          }}
        />
        <DesignSystemLink />
        <Text variant="caption" tone="subtle" style={styles.version}>
          {VERSION_LABEL}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, marginTop: spacing.lg },
  version: { textAlign: "center" },
});
