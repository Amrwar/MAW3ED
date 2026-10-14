import { useState } from "react";
import { sized } from "@/lib/image";
import { Image, StyleSheet, View } from "react-native";
import { colors, fonts } from "../tokens";
import { Text } from "./Text";

const SIZES = { sm: 32, md: 44, lg: 64, xl: 88 } as const;

/** First letters of the first two words — "سارة محمد" → "سم", "Sara Mohamed" → "SM". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
}

/**
 * A person or a business. The photo when there is one and it loads;
 * otherwise initials on the brand tint — never a broken image or a grey
 * silhouette that looks like a missing profile. Decorative: the name
 * beside it is what a screen reader reads.
 */
export function Avatar({
  name,
  uri,
  size = "md",
  shape = "circle",
}: {
  name: string;
  uri?: string | null;
  size?: keyof typeof SIZES;
  shape?: "circle" | "rounded";
}) {
  const [failed, setFailed] = useState(false);
  const px = SIZES[size];
  const round = shape === "circle" ? px / 2 : Math.round(px * 0.28);

  return (
    <View
      style={[styles.base, { width: px, height: px, borderRadius: round }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {uri && !failed ? (
        <Image source={{ uri: sized(uri, px) }} style={{ width: px, height: px }} onError={() => setFailed(true)} />
      ) : (
        <Text
          allowFontScaling={false}
          style={{ fontFamily: fonts.bold, fontSize: px * 0.36, lineHeight: px * 0.5, color: colors.jade }}
          align="center"
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.jadeSoft,
    borderWidth: 1,
    borderColor: colors.jadeLine,
  },
});
