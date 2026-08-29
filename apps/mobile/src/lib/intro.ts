import * as SecureStore from "expo-secure-store";

const INTRO_COMPLETE_KEY = "vaara_intro_complete";

export async function hasCompletedIntro() {
  return (await SecureStore.getItemAsync(INTRO_COMPLETE_KEY)) === "true";
}

export async function completeIntro() {
  await SecureStore.setItemAsync(INTRO_COMPLETE_KEY, "true");
}
