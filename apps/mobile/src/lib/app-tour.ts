import * as SecureStore from "expo-secure-store";

const APP_TOUR_COMPLETE_KEY = "vaara_app_tour_complete";

export async function hasCompletedAppTour() {
  return (await SecureStore.getItemAsync(APP_TOUR_COMPLETE_KEY)) === "true";
}

export async function completeAppTour() {
  await SecureStore.setItemAsync(APP_TOUR_COMPLETE_KEY, "true");
}
