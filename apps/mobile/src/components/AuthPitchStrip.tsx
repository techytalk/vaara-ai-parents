import { useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows, spacing, typography } from "@/constants/theme";

const slides = [
  {
    key: "circles",
    icon: "people-outline" as const,
    tint: colors.teal,
    title: "School and class circles",
    body: "Meet parents from your child’s school, class and neighbourhood.",
  },
  {
    key: "curriculum",
    icon: "library-outline" as const,
    tint: colors.amber,
    title: "Advice from the same board",
    body: "Hear from IB, CBSE, IGCSE and Cambridge parents facing the same choices.",
  },
  {
    key: "community",
    icon: "shield-checkmark-outline" as const,
    tint: colors.coral,
    title: "Ask anything, stay private",
    body: "Questions and local tips — without sharing your real name.",
  },
] as const;

export function AuthPitchStrip() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<(typeof slides)[number]>>(null);
  const [page, setPage] = useState(0);
  const slideWidth = Math.max(width - spacing.xl * 2, 240);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<(typeof slides)[number]>[] }) => {
      const index = viewableItems[0]?.index;
      if (index != null) setPage(index);
    }
  ).current;

  return (
    <View style={styles.wrap}>
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
            <View style={[styles.iconWrap, { backgroundColor: `${item.tint}18` }]}>
              <Ionicons name={item.icon} size={22} color={item.tint} />
            </View>
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
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 96,
    ...shadows.card,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  title: {
    ...typography.supporting,
    fontFamily: typography.bold,
    color: colors.text,
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
