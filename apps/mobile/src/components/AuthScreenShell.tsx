import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnboardingContentStyle } from "@/components/onboarding/ui";
import { colors, spacing } from "@/constants/theme";

export type AuthDensityBand = "short" | "regular" | "tall";

/**
 * Usable height below the stack header. Short phones compress type/spacing;
 * tall phones get a little more breathing room. See docs/AUTH_SCREEN_FIT.md.
 */
export function useAuthDensityBand(): AuthDensityBand {
  const { height: windowHeight } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const usable = windowHeight - headerHeight - insets.bottom;

  if (usable < 560) return "short";
  if (usable > 700) return "tall";
  return "regular";
}

/**
 * Fixed-height auth chrome: no vertical ScrollView in the default social path.
 * When `scrollBody` is true (email form open), only the column scrolls so the
 * keyboard can reach fields without bringing back the pitch-strip layout.
 */
export function AuthScreenShell({
  band,
  scrollBody = false,
  body,
  footer,
}: {
  band: AuthDensityBand;
  scrollBody?: boolean;
  body: ReactNode;
  footer: ReactNode;
}) {
  const contentStyle = useOnboardingContentStyle({
    includeVertical: false,
  });
  const padTop = band === "short" ? spacing.sm : spacing.md;
  const padBottom = band === "short" ? spacing.sm : spacing.md;

  const columnStyle = [
    styles.column,
    contentStyle,
    {
      paddingTop: padTop,
      paddingBottom: padBottom,
      gap: band === "short" ? spacing.sm : spacing.md,
    },
  ];

  const content = (
    <>
      <View style={styles.body}>{body}</View>
      <View style={styles.footer}>{footer}</View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scrollBody ? (
          <ScrollView
            style={styles.safe}
            contentContainerStyle={[columnStyle, styles.scrollContent]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.safe, columnStyle, styles.fixedColumn]}>
            {content}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  column: {
    width: "100%",
  },
  fixedColumn: {
    flex: 1,
    justifyContent: "space-between",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  body: {
    flexShrink: 1,
    gap: spacing.sm,
  },
  footer: {
    flexShrink: 0,
    gap: spacing.sm,
  },
});
