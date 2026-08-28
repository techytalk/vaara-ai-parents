import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
        <Pressable
          style={styles.button}
          onPress={() => this.setState({ error: null })}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#f8f9fc",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#5c5c7a",
    marginBottom: 16,
    lineHeight: 22,
  },
  box: {
    maxHeight: 220,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e4ef",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  message: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#dc2626",
  },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
