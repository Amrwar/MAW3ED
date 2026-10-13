import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, elevation, motion, radius, spacing } from "../tokens";
import { useLocale } from "../locale";
import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import { Touchable } from "./Touchable";

type ToastTone = "ok" | "danger" | "info";

interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** ms; long enough to read a sentence. */
  duration?: number;
}

const ICON: Record<ToastTone, IconName> = { ok: "checkmark-circle", danger: "alert-circle", info: "information-circle" };
// Tokens only. On night, the tones are told apart by icon shape; ok
// alone takes the lifted jade, as success does elsewhere on dark.
const ACCENT: Record<ToastTone, string> = { ok: colors.nightAccent, danger: colors.star, info: colors.nightText };

const ToastContext = createContext<(input: ToastInput) => void>(() => undefined);

/**
 * A short confirmation that something happened — "Booking cancelled".
 * Not for errors that need a decision (that is a Dialog) or that block
 * the screen (ErrorState).
 *
 * Night, Deep Anchor's colour, so it reads over any screen. Announced to
 * screen readers when it appears — it may vanish before anyone could
 * reach it — and dismissable by tap. One at a time; a new one replaces
 * the last rather than stacking.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start(() => setToast(null));
  }, [opacity]);

  const show = useCallback(
    (input: ToastInput) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...input, id: Date.now() });
      AccessibilityInfo.announceForAccessibility(input.message);
      Animated.timing(opacity, { toValue: 1, duration: motion.normal, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, input.duration ?? 4000);
    },
    [hide, opacity],
  );

  const value = useMemo(() => show, [show]);
  const tone = toast?.tone ?? "info";

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.host, { bottom: insets.bottom + 72, opacity }]}
        >
          <Touchable
            accessibilityRole="alert"
            accessibilityLabel={toast.message}
            accessibilityHint={t("dismiss")}
            onPress={hide}
            style={styles.toast}
          >
            <Icon name={ICON[tone]} color={ACCENT[tone]} />
            <View style={styles.text}>
              <Text variant="label" tone="inverse">
                {toast.message}
              </Text>
            </View>
          </Touchable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: { position: "absolute", start: spacing.lg, end: spacing.lg, alignItems: "center" },
  toast: {
    width: "100%",
    maxWidth: 480,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.night,
    ...elevation.float,
  },
  text: { flex: 1 },
});
