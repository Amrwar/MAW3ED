import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/AuthProvider";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { VERSION_LABEL } from "@/constants/version";
import { spacing } from "@/constants/theme";

export default function AdminAccount() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <Text variant="title">حسابي</Text>
      <View style={styles.stack}>
        <Card>
          <Text variant="bodyBold">{user?.name ?? user?.email ?? "—"}</Text>
          <Text variant="caption" tone="subtle">
            {user?.adminRole}
          </Text>
        </Card>
        <RoleSwitcher current="admin" />
        <Button
          label="تسجيل الخروج"
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
