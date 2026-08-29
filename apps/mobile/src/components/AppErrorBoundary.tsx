import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app hit an error on startup. Share the message below when
          troubleshooting.
        </Text>
        <ScrollView style={styles.box}>
          <Text style={styles.message}>{this.state.error.message}</Text>
        </ScrollView>
        <Button
          label="Try again"
          onPress={() => this.setState({ error: null })}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    fontFamily: typography.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 22,
    fontFamily: typography.regular,
  },
  box: {
    maxHeight: 220,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  message: {
    fontFamily: "monospace",
    fontSize: 13,
    color: colors.coral,
  },
});
