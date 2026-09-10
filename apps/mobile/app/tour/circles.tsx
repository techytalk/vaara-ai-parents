import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type Circle } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { completeAppTour } from "@/lib/app-tour";
import { getToken } from "@/lib/session";
import { colors, PrimaryButton } from "@/components/onboarding/ui";
import {
  TourFrame,
  circleTypeIcon,
} from "@/components/tour/TourFrame";

const FALLBACK = [
  { key: "locality", label: "Neighbourhood" },
  { key: "school", label: "School" },
  { key: "curriculum", label: "Board" },
  { key: "class", label: "Class" },
];

export default function TourCirclesScreen() {
  const router = useRouter();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackEvent("tour_started");
    trackEvent("tour_step_view", { step: "circles" });
    getToken().then(async (token) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setCircles(await api.getCircles(token));
      } catch {
        setCircles([]);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function onSkip() {
    trackEvent("tour_skipped", { step: "circles" });
    await completeAppTour();
    router.replace("/(app)");
  }

  const items =
    circles.length > 0
      ? circles.slice(0, 5).map((circle) => ({
          key: circle.id,
          icon: circleTypeIcon(circle.circleType),
          label: circle.displayName,
        }))
      : FALLBACK.map((item) => ({
          key: item.key,
          icon: circleTypeIcon(item.key),
          label: item.label,
        }));

  return (
    <TourFrame
      step={1}
      title="You're in these circles"
      subtitle="Parents who share your area, school, board or class."
      onSkip={onSkip}
      footer={<PrimaryButton label="Next" onPress={() => router.push("/tour/ask" as never)} />}
    >
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <View style={styles.stack}>
          {items.map((item) => (
            <View key={item.key} style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TourFrame>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
});
