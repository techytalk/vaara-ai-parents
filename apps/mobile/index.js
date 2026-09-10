import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

// Explicit app context avoids EXPO_ROUTER_APP_ROOT resolution issues when the
// mobile workspace is bundled from the monorepo root.
export function App() {
  const context = require.context("./app");
  return <ExpoRoot context={context} />;
}

registerRootComponent(App);
