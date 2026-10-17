import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../tokens";

/**
 * The one way something becomes tappable.
 *
 * Feedback the way each platform does it — a ripple on Android, a dim
 * on iOS — so the app feels native on both rather than iOS-on-Android.
 * A disabled control is announced as disabled, not just greyed out.
 *
 * `hitSlop` widens the tappable area of a small visual element (a 24pt
 * icon) to the 48pt target without making it look bigger.
 *
 * react-native-web ignores hitSlop, so on web a Touchable given one
 * gets a transparent ::after box at least 44pt square, centred on it:
 * the same bigger target, still without changing how it looks.
 *
 * State is passed as the standard aria-* props as well as
 * accessibilityState: React Native reads both on iOS and Android, and
 * react-native-web reads only aria-* — without them a chip is a
 * "checkbox" with no checked state on web, which axe rightly fails.
 */
const SELECTABLE = new Set(["tab", "option", "gridcell", "row", "treeitem"]);
const CHECKABLE = new Set(["checkbox", "radio", "switch", "menuitemcheckbox", "menuitemradio"]);

const WEB = Platform.OS === "web";
let hitCssAdded = false;

/** The one stylesheet rule behind the web's hit areas (see above). */
function addHitCss() {
  if (hitCssAdded || typeof document === "undefined") return;
  hitCssAdded = true;
  const el = document.createElement("style");
  el.textContent =
    "[data-hit]{overflow:visible!important}" +
    // Centred by auto margins inside a negative inset, so it reads the
    // same in either direction: at least 44px each way, never smaller.
    '[data-hit]::after{content:"";position:absolute;inset:-24px;margin:auto;' +
    "width:max(100%,44px);height:max(100%,44px)}";
  document.head.appendChild(el);
}

export function Touchable({
  style,
  disabled,
  pressedOpacity = 0.6,
  rippleColor = colors.line2,
  borderless = false,
  accessibilityState,
  ...rest
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  pressedOpacity?: number;
  rippleColor?: string;
  borderless?: boolean;
}) {
  const state = { ...accessibilityState, disabled: Boolean(disabled) };
  // Each state is only valid ARIA on some roles: "selected" belongs to
  // tabs and options, and on a plain button it is a toggle, aria-pressed.
  const role = (rest.role ?? rest.accessibilityRole ?? "button") as string;
  const selectable = SELECTABLE.has(role);
  const checkable = CHECKABLE.has(role);
  const hit = WEB && rest.hitSlop != null;
  if (hit) addHitCss();
  return (
    <Pressable
      {...rest}
      {...(hit ? ({ dataSet: { hit: "1" } } as object) : null)}
      disabled={disabled}
      accessibilityState={state}
      aria-disabled={state.disabled}
      aria-checked={checkable ? state.checked : undefined}
      aria-selected={selectable ? state.selected : undefined}
      aria-pressed={!selectable && !checkable && state.selected !== undefined ? state.selected : undefined}
      aria-busy={state.busy}
      aria-expanded={state.expanded}
      android_ripple={disabled ? undefined : { color: rippleColor, borderless, foreground: true }}
      style={({ pressed }) => [
        style,
        Platform.OS === "ios" && pressed && !disabled ? { opacity: pressedOpacity } : null,
      ]}
    />
  );
}
