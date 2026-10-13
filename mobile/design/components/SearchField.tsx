import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, fonts, radius, spacing, touchTarget } from "../tokens";
import { useLocale } from "../locale";
import { Icon } from "./Icon";
import { Touchable } from "./Touchable";

/**
 * The search box. A pill, so it reads as "search" before anyone reads
 * the placeholder — and, unlike a form field, it carries its purpose in
 * the placeholder and the accessibility label rather than a label above.
 *
 * The clear button appears once there is something to clear, and is a
 * real button with a name.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  ...rest
}: Omit<TextInputProps, "onSubmitEditing"> & {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
}) {
  const { isRTL, t } = useLocale();
  const label = placeholder ?? t("search");

  return (
    <View style={styles.field} accessibilityRole="search">
      <Icon name="search" color={colors.subtle} />
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={colors.subtle}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCorrect={false}
        {...rest}
        style={[styles.input, { textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }]}
      />
      {value ? (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={t("clear")}
          onPress={() => onChangeText("")}
          hitSlop={12}
          borderless
        >
          <Icon name="close-circle" color={colors.subtle} />
        </Touchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    paddingHorizontal: spacing.lg,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, minHeight: touchTarget - 4 },
});
