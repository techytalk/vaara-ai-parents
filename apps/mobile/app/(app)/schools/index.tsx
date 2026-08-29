import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  api,
  type Location,
  type SchoolListItem,
} from "@/lib/api";
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
  onPress,
}: {
  school: SchoolListItem;
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
          <StarRating value={school.ratingAvg} />
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
  const [results, setResults] = useState<SchoolListItem[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [locationRequired, setLocationRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadSchools = useCallback(async (
    q: string,
    selectedTab: SchoolsTab,
    scope: Location | null
  ) => {
    const currentRequest = ++requestId.current;
    const trimmed = q.trim();
    if (trimmed.length === 1) {
      return;
    }
    setLoading(true);
    setError(null);
    setLocationRequired(false);
    try {
      const token = await getToken();
      if (!token) return;
      const sort = selectedTab === "reviews" ? "rating" : undefined;
      const schools =
        trimmed.length >= 2
          ? await api.searchSchools(token, {
              q: trimmed,
              city: scope?.city ?? undefined,
              pin: scope?.pinCode ?? undefined,
              sort: sort ?? "relevance",
              limit: 30,
            })
          : await api.getNearbySchools(token, {
              city: scope?.city ?? undefined,
              pin: scope?.pinCode ?? undefined,
              sort: sort ?? "nearby",
              limit: 30,
            });
      if (currentRequest === requestId.current) {
        setResults(schools);
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not load schools";
      if (message.includes("pin code or city")) {
        setLocationRequired(true);
        setResults([]);
      } else {
        setError(message);
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setBootLoading(false);
        return;
      }
      try {
        const currentLocation = await api.getLocation(token).catch(() => null);
        setLocation(currentLocation);
        await loadSchools("", "discover", currentLocation);
      } finally {
        setBootLoading(false);
      }
    });
  }, [loadSchools]);

  useEffect(() => {
    if (bootLoading) return;
    const timer = setTimeout(() => {
      void loadSchools(query, tab, location);
    }, 300);
    return () => clearTimeout(timer);
  }, [bootLoading, loadSchools, location, query, tab]);

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
              await loadSchools(query, tab, location);
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
          onSubmitEditing={() => loadSchools(query, tab, location)}
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

        {error ? (
          <InlineError
            message={error}
            onRetry={() => loadSchools(query, tab, location)}
          />
        ) : null}
        {loading ? <ScreenLoader label="Searching schools" /> : null}

        {!loading && results.length === 0 ? (
          <EmptyState
            icon={locationRequired ? "location-outline" : "school-outline"}
            title={
              locationRequired
                ? "Add your location"
                : query.length >= 2
                  ? "No schools found"
                  : "No nearby schools yet"
            }
            message={
              locationRequired
                ? "Add your pin code or city to discover relevant schools."
                : query.length >= 2
                ? "Try a different name or nearby area."
                : "Schools matching your pin code or city will appear here."
            }
            actionLabel={locationRequired ? "Add location" : undefined}
            onAction={
              locationRequired
                ? () => router.push("/onboarding/location")
                : undefined
            }
          />
        ) : null}

        {!loading && results.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={tab === "reviews" ? "Top rated nearby" : "Nearby schools"}
            />
            <View style={styles.list}>
              {results.map((school) => (
                <SchoolCard
                  key={school.id}
                  school={school}
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
