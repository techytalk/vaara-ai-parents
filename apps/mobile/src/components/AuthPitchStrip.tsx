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
import { colors, radii, spacing, typography } from "@/constants/theme";

const slides = [
  {
    key: "circles",
    title: "Same school, class and locality",
    body: "Automatically join circles with parents from your child's school and neighbourhood.",
  },
  {
    key: "tutors",
    title: "Verified tutors nearby",
    body: "Discover reviewed teachers, trainers and institutions serving your area.",
  },
  {
    key: "curriculum",
    title: "Advice from the same board",
    body: "Hear from IB, IGCSE, CBSE and Cambridge parents making the same decisions.",
  },
  {
    key: "community",
    title: "One safe parent community",
    body: "Discussions, activities, marketplace and polls — without exposing your family.",
  },
] as const;

export function AuthPitchStrip() {
  const { width } = useWindowDimensions();
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
          <Pressable style={[styles.slide, { width: slideWidth }]}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </Pressable>
        )}
      />
      <View style={styles.dots}>
        {slides.map((slide, index) => (
          <View
            key={slide.key}
            style={[styles.dot, index === page && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  slide: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    minHeight: 108,
    justifyContent: "center",
  },
  title: {
    ...typography.supporting,
    fontFamily: typography.bold,
    color: colors.primaryDark,
  },
  body: {
    ...typography.supporting,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: spacing.xs,
    lineHeight: 20,
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
