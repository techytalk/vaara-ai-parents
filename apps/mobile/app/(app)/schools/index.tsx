import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Chip,
  EmptyState,
  InlineError,
  ScreenLoader,
  SearchField,
  SectionHeader,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api, type School } from "@/lib/api";
import { getToken } from "@/lib/session";

type SchoolsTab = "discover" | "reviews";

function StarRating({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <View style={styles.ratingRow}>
      <Ionicons name="star" size={14} color={colors.amber} />
      <Text style={styles.ratingText}>{value.toFixed(1)}</Text>
    </View>
  );
}

function SchoolCard({
  school,
  rating,
  onPress,
}: {
  school: School;
  rating?: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.schoolCard, pressed && styles.pressed]}
    >
      <View style={styles.schoolCopy}>
        <Text style={styles.schoolName} numberOfLines={2}>
          {school.displayLabel}
        </Text>
        <Text style={styles.schoolMeta} numberOfLines={1}>
          {[school.city, school.pinCode].filter(Boolean).join(" · ")}
        </Text>
        <View style={styles.schoolFooter}>
          <StarRating value={rating} />
          {school.verified ? (
            <View style={styles.verifiedPill}>
              <Ionicons
                name="shield-checkmark"
                size={11}
                color={colors.primaryDark}
              />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.schoolArt}>
        <Ionicons name="school" size={36} color={colors.primaryDark} />
      </View>
    </Pressable>
  );
}

export default function SchoolsBrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SchoolsTab>("discover");
  const [results, setResults] = useState<School[]>([]);
  const [ratings, setRatings] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchSchools = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setRatings({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const schools = await api.searchSchools(token, { q: trimmed });
      setResults(schools);
      const ratingEntries = await Promise.all(
        schools.slice(0, 12).map(async (school) => {
          try {
            const profile = await api.getSchoolProfile(token, school.id);
            return [school.id, profile.ratingAvg] as const;
          } catch {
            return [school.id, null] as const;
          }
        })
      );
      setRatings(Object.fromEntries(ratingEntries));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setBootLoading(false);
        return;
      }
      try {
        const [children, location] = await Promise.all([
          api.getChildren(token).catch(() => []),
          api.getLocation(token).catch(() => null),
        ]);
        const seed =
          children[0]?.school?.city ??
          location?.locality ??
          location?.pinCode ??
          "";
        if (seed.length >= 2) {
          setQuery(seed);
          await searchSchools(seed);
        }
      } finally {
        setBootLoading(false);
      }
    });
  }, [searchSchools]);

  const displayed = useMemo(() => {
    const list = [...results];
    if (tab === "reviews") {
      return list.sort(
        (a, b) => (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0)
      );
    }
    return list;
  }, [results, ratings, tab]);

  if (bootLoading) return <ScreenLoader label="Loading schools" />;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await searchSchools(query);
            }}
          />
        }
      >
        <Text style={styles.headline}>Schools</Text>
        <Text style={styles.lead}>
          Browse school profiles and parent reviews. Fee details are shared by
          parents in their own words — not listed by Vaara.
        </Text>

        <SearchField
          placeholder="Search schools by name or location"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => searchSchools(query)}
          returnKeyType="search"
        />

        <View style={styles.tabs}>
          <Chip
            label="Discover"
            selected={tab === "discover"}
            onPress={() => setTab("discover")}
          />
          <Chip
            label="Reviews"
            selected={tab === "reviews"}
            onPress={() => setTab("reviews")}
          />
        </View>

        {error ? <InlineError message={error} onRetry={() => searchSchools(query)} /> : null}
        {loading ? <ScreenLoader label="Searching schools" /> : null}

        {!loading && displayed.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title={query.length >= 2 ? "No schools found" : "Search for a school"}
            message={
              query.length >= 2
                ? "Try a different name or nearby area."
                : "Enter at least two characters to find schools near you."
            }
          />
        ) : null}

        {!loading && displayed.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={tab === "reviews" ? "Top rated nearby" : "Nearby schools"}
            />
            <View style={styles.list}>
              {displayed.map((school) => (
                <SchoolCard
                  key={school.id}
                  school={school}
                  rating={ratings[school.id]}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/schools/[id]",
                      params: { id: school.id },
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  headline: {
    ...typography.screenTitle,
    color: colors.navy,
    fontFamily: typography.bold,
  },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: -6,
  },
  tabs: { flexDirection: "row", gap: spacing.xs },
  section: { gap: spacing.sm },
  list: { gap: spacing.sm },
  schoolCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.75 },
  schoolCopy: { flex: 1, minWidth: 0 },
  schoolName: {
    ...typography.body,
    color: colors.text,
    fontFamily: typography.bold,
  },
  schoolMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: typography.regular,
    marginTop: 3,
  },
  schoolFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 6,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: {
    ...typography.caption,
    color: colors.text,
    fontFamily: typography.semibold,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  verifiedText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: typography.semibold,
    fontSize: 10,
  },
  schoolArt: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
