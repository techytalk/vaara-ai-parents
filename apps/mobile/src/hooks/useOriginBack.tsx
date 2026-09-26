import { useLayoutEffect } from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { colors, typography } from "@/constants/theme";
import {
  backLabelForOrigin,
  leaveToOrigin,
  type NavFrom,
} from "@/lib/nav-back";

/** Parse `from` search param used when jumping into a hidden tab / root screen. */
export function useNavFrom(): NavFrom | undefined {
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const raw = params.from;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return undefined;
}

export function useNavChildId(): string | undefined {
  const params = useLocalSearchParams<{ childId?: string | string[] }>();
  const raw = params.childId;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return undefined;
}

/**
 * For Stack / Tabs screens that show a native header: add an explicit back
 * control when opened with `from=…` (e.g. from More).
 */
export function useOriginBackHeader(options?: {
  /** Force showing back even without `from` (e.g. always leave to More). */
  always?: boolean;
  fallbackFrom?: NavFrom;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const from = useNavFrom();
  const childId = useNavChildId();
  const always = options?.always ?? false;
  const fallbackFrom = options?.fallbackFrom ?? "more";

  useLayoutEffect(() => {
    const origin = from ?? (always ? fallbackFrom : undefined);
    if (!origin) return;

    const label = backLabelForOrigin(origin);
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Back to ${label}`}
          onPress={() =>
            leaveToOrigin(router, {
              from: origin,
              childId,
            })
          }
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", marginLeft: 4 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
          <Text
            style={{
              fontFamily: typography.semibold,
              fontSize: 17,
              color: colors.text,
              marginLeft: -4,
            }}
          >
            {label}
          </Text>
        </Pressable>
      ),
    });
  }, [always, childId, fallbackFrom, from, navigation, router]);
}
