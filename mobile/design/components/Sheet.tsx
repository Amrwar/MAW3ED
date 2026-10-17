import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type KeyboardEvent } from "react-native";
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
 *
 * It keeps above the keyboard itself. A Modal is its own window. On
 * Android RN's Modal dialog does ask for SOFT_INPUT_ADJUST_RESIZE, but
 * under edge-to-edge the window is not resized; on iOS nothing resizes
 * at all. So a sheet with a text field (country search, price filter)
 * would sit under the keyboard. The lift is the overlap between the
 * keyboard's top and the backdrop's own height, max(0, rootHeight -
 * screenY): where the window did resize, the backdrop is already short,
 * the overlap is zero, and that guard is what stops a double lift. The panel's
 * max height follows the space left, and its list scrolls inside it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  testID,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Actions pinned under the content, always in reach. */
  footer?: ReactNode;
  /** For the end-to-end tests (.maestro/): the panel gets this id. */
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { isTablet, height } = useLayout();
  const { t, dir } = useLocale();
  const [progress] = useState(() => new Animated.Value(0));
  const [rootHeight, setRootHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    if (!open || Platform.OS === "web") return;
    // iOS announces before it moves (so the sheet moves with it); Android only after.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e: KeyboardEvent) => setKeyboardTop(e.endCoordinates.screenY));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardTop(null));
    return () => {
      show.remove();
      hide.remove();
      setKeyboardTop(null);
    };
  }, [open]);

  const lift = keyboardTop !== null && rootHeight > 0 ? Math.max(0, rootHeight - keyboardTop) : 0;
  const room = (rootHeight || height) - lift;

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
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      // Already up when the sheet opens (a focused field behind it): no
      // show event will come, so start from where it is now.
      onShow={() => setKeyboardTop(Platform.OS !== "web" && Keyboard.isVisible() ? (Keyboard.metrics()?.screenY ?? null) : null)}
    >
      {/* A Modal is a separate native root and does not inherit the app's
          direction, so it is set again here. */}
      <View
        style={[styles.backdrop, isTablet && styles.centred, { direction: dir, paddingBottom: lift + (isTablet ? spacing.xl : 0) }]}
        onLayout={(e) => setRootHeight(e.nativeEvent.layout.height)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} accessibilityRole="button" />
        <Animated.View
          accessibilityViewIsModal
          testID={testID}
          style={[
            styles.panel,
            isTablet ? styles.tablet : styles.phone,
            {
              // On a tablet the centred backdrop pads xl on each side as well.
              maxHeight: lift > 0 ? room - insets.top - spacing.sm - (isTablet ? spacing.xl * 2 : 0) : room * (isTablet ? 0.8 : 0.9),
              // Over the keyboard there is no home indicator to clear.
              paddingBottom: isTablet ? spacing.lg : lift > 0 ? spacing.md : insets.bottom + spacing.md,
            },
            { transform: [{ translateY }], opacity: progress },
          ]}
        >
          {!isTablet ? <View style={styles.grabber} /> : null}
          <View style={styles.head}>
            <Text variant="heading" accessibilityRole="header" style={styles.title} numberOfLines={2} testID="sheet-title">
              {title}
            </Text>
            <IconButton icon="close" label={t("close")} onPress={onClose} testID="sheet-close" />
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
