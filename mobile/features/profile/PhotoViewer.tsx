import { useRef, useState } from "react";
import { FlatList, Image, Modal, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Text, colors, spacing, useLocale } from "@/design";
import { num } from "@/lib/format";

/**
 * Photos, full screen, one at a time, swiped through.
 *
 * Kept left-to-right whatever the language: a strip of pictures has no
 * reading direction, and a mirrored FlatList pages backwards on some
 * platforms. The counter is read out so a screen reader knows where it is.
 */
export function PhotoViewer({
  photos,
  start,
  onClose,
}: {
  photos: { url: string; caption: string | null }[];
  /** Index to open on, or null when closed. */
  start: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const [index, setIndex] = useState(start ?? 0);
  const list = useRef<FlatList>(null);

  // Each opening starts on the photo that was tapped.
  const [opened, setOpened] = useState(start);
  if (opened !== start) {
    setOpened(start);
    if (start !== null) setIndex(start);
  }

  const photo = photos[index];

  return (
    <Modal visible={start !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.page} accessibilityViewIsModal>
        <FlatList
          ref={list}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={start ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p, i) => `${i}:${p.url}`}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          // Web has no momentum event for a mouse-wheel or the arrow buttons.
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            if (i !== index && i >= 0 && i < photos.length) setIndex(i);
          }}
          scrollEventThrottle={64}
          style={{ direction: "ltr" }}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: "center" }}>
              <Image
                source={{ uri: item.url }}
                style={{ width, height: height * 0.7 }}
                resizeMode="contain"
                accessibilityLabel={item.caption ?? (ar ? "صورة من المكان" : "Photo of the place")}
              />
            </View>
          )}
        />

        <View style={[styles.top, { top: insets.top + spacing.sm }]}>
          <IconButton icon="close" label={ar ? "اقفل" : "Close"} onPress={onClose} variant="night" color={colors.inverse} />
          <Text variant="label" tone="inverse" accessibilityLiveRegion="polite">
            {ar
              ? `${num(index + 1, lang)} من ${num(photos.length, lang)}`
              : `${num(index + 1, lang)} of ${num(photos.length, lang)}`}
          </Text>
        </View>

        {photo?.caption ? (
          <View style={[styles.caption, { bottom: insets.bottom + 80 }]}>
            <Text variant="body" tone="inverse" align="center">
              {photo.caption}
            </Text>
          </View>
        ) : null}

        {photos.length > 1 ? (
          <View style={[styles.arrows, { bottom: insets.bottom + spacing.lg }]}>
            <IconButton
              icon="chevron-back"
              label={ar ? "الصورة اللي قبلها" : "Previous photo"}
              variant="night"
              color={colors.inverse}
              disabled={index === 0}
              onPress={() => list.current?.scrollToIndex({ index: Math.max(0, index - 1) })}
            />
            <IconButton
              icon="chevron-forward"
              label={ar ? "الصورة اللي بعدها" : "Next photo"}
              variant="night"
              color={colors.inverse}
              disabled={index >= photos.length - 1}
              onPress={() => list.current?.scrollToIndex({ index: Math.min(photos.length - 1, index + 1) })}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.night },
  top: {
    position: "absolute",
    start: spacing.lg,
    end: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  caption: { position: "absolute", start: spacing.xl, end: spacing.xl },
  arrows: {
    position: "absolute",
    start: spacing.lg,
    end: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
