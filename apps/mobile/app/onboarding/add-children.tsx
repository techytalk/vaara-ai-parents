import { Redirect } from "expo-router";

/** Legacy route — children flow moved to /onboarding/children */
export default function AddChildrenRedirect() {
  return <Redirect href="/onboarding/children" />;
}
