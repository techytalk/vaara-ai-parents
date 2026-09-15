import { useRef, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type ViewToken,
} from "react-native";
import { colors, radii, shadows, spacing, typography } from "@/constants/theme";

const slides: Array<{
  key: string;
  image: ImageSourcePropType;
  title: string;
  body: string;
}> = [
  {
    key: "circles",
    image: require("../../assets/illustrations/auth-school-circles.png"),
    title: "Your kids’ school and class circles",
    body: "Meet parents from your child’s school, class and neighbourhood. Ask. Share. Learn. Together.",
  },
  {
    key: "curriculum",
    image: require("../../assets/illustrations/auth-same-board.png"),
    title: "Advice from the same board",
    body: "Hear from CBSE, IB, IGCSE and Cambridge parents facing the same choices.",
  },
  {
    key: "community",
    image: require("../../assets/illustrations/auth-ask-private.png"),
    title: "Ask anything, stay private",
    body: "Real opinions and local tips — without sharing your real name.",
  },
];

export function AuthPitchStrip() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<(typeof slides)[number]>>(null);
  const [page, setPage] = useState(0);
  const [slideWidth, setSlideWidth] = useState(() =>
    Math.max(width - spacing.md * 2, 240)
  );
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<(typeof slides)[number]>[] }) => {
      const index = viewableItems[0]?.index;
      if (index != null) setPage(index);
    }
  ).current;

  return (
    <View
      style={styles.wrap}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== slideWidth) setSlideWidth(next);
      }}
    >
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={slides}
        keyExtractor={(item) => item.key}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 55 }}
        getItemLayout={(_, index) => ({
          length: slideWidth,
          offset: slideWidth * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: slideWidth }]}>
            <Image
              source={item.image}
              style={styles.art}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <View style={styles.copy}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.dots}>
        {slides.map((slide, index) => (
          <Pressable
            key={slide.key}
            accessibilityRole="button"
            accessibilityLabel={`Pitch ${index + 1} of ${slides.length}`}
            onPress={() => {
              setPage(index);
              listRef.current?.scrollToIndex({ index, animated: true });
            }}
          >
            <View style={[styles.dot, index === page && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
  },
  slide: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    minHeight: 104,
    ...shadows.card,
  },
  art: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  copy: { flex: 1 },
  title: {
    ...typography.supporting,
    fontFamily: typography.bold,
    color: colors.primaryDark,
    fontSize: 15,
  },
  body: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 4,
    lineHeight: 19,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
});
