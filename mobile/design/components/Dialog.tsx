import { useState, type ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { colors, elevation, radius, spacing, tones } from "../tokens";
import { useLocale } from "../locale";
import { Text } from "./Text";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

/**
 * A centred dialog — for a decision that interrupts, not a task. Most
 * things that look like dialogs should be sheets; this is for "are you
 * sure", "something needs your attention".
 *
 * Announced as an alert-like modal; Android back dismisses it.
 */
export function Dialog({
  open,
  onClose,
  title,
  body,
  icon,
  tone = "neutral",
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  icon?: IconName;
  tone?: "neutral" | "danger" | "jade" | "warn";
  children?: ReactNode;
  actions: ReactNode;
}) {
  const c = tones[tone];
  // A Modal is a separate native root and does not inherit direction.
  const { dir } = useLocale();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { direction: dir }]}>
        <View style={styles.panel} accessibilityViewIsModal accessibilityRole="alert">
          {icon ? (
            <View style={[styles.icon, { backgroundColor: c.bg }]}>
              <Icon name={icon} size="lg" color={c.fg} />
            </View>
          ) : null}
          <Text variant="heading" align="center" accessibilityRole="header">
            {title}
          </Text>
          {body ? (
            <Text variant="body" tone="muted" align="center">
              {body}
            </Text>
          ) : null}
          {children}
          <View style={styles.actions}>{actions}</View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * "Are you sure?" with the consequence spelled out. The confirming
 * button names the action ("Cancel booking"), never just "OK", and is
 * red when the action destroys something. While it runs, both buttons
 * wait — a second tap must not cancel twice.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      body={body}
      icon={destructive ? "alert-circle-outline" : "help-circle-outline"}
      tone={destructive ? "danger" : "jade"}
      actions={
        <>
          <Button
            label={confirmLabel}
            variant={destructive ? "danger" : "primary"}
            loading={busy}
            fullWidth
            onPress={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button label={t("cancel")} variant="outline" disabled={busy} fullWidth onPress={onClose} />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  panel: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...elevation.float,
  },
  icon: { alignSelf: "center", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
