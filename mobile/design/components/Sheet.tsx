import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, elevation, motion, radius, spacing } from "../tokens";
import { useLayout } from "../layout";
import { useLocale } from "../locale";
import { Text } from "./Text";
import { IconButton } from "./IconButton";

/**
 * A bottom sheet: a task that belongs to this screen — filters, a
 * choice from a list, a booking's actions — rising from where the thumb
 * already is.
 *
 * Closed by the backdrop, the close button, or Android's back button
 * (onRequestClose). `accessibilityViewIsModal` keeps a screen reader
 * inside it while it is open. On a tablet it becomes a centred panel —
 * a sheet stretched across an iPad is a strip of grey.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Actions pinned under the content, always in reach. */
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { isTablet, height } = useLayout();
  const { t, dir } = useLocale();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!open) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.normal,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [isTablet ? 24 : 320, 0] });

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* A Modal is a separate native root and does not inherit the app's
          direction, so it is set again here. */}
      <View style={[styles.backdrop, isTablet && styles.centred, { direction: dir }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} accessibilityRole="button" />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            isTablet ? styles.tablet : styles.phone,
            { maxHeight: height * (isTablet ? 0.8 : 0.9), paddingBottom: isTablet ? spacing.lg : insets.bottom + spacing.md },
            { transform: [{ translateY }], opacity: progress },
          ]}
        >
          {!isTablet ? <View style={styles.grabber} /> : null}
          <View style={styles.head}>
            <Text variant="heading" accessibilityRole="header" style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <IconButton icon="close" label={t("close")} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
  centred: { justifyContent: "center", alignItems: "center", padding: spacing.xl },
  panel: { backgroundColor: colors.surface, ...elevation.float },
  phone: { borderTopStartRadius: radius.xl, borderTopEndRadius: radius.xl },
  tablet: { width: "100%", maxWidth: 560, borderRadius: radius.xl },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line2,
    marginTop: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingStart: spacing.xl,
    paddingEnd: spacing.sm,
    paddingTop: spacing.sm,
  },
  title: { flex: 1 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.sm,
  },
});
