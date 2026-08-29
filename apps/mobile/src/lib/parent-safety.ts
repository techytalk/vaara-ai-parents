import { Alert } from "react-native";
import { api } from "@/lib/api";
import { getToken } from "@/lib/session";

export function showParentSafetyActions(options: {
  handle: string;
  userId: string;
  onBlocked?: () => void;
}) {
  Alert.alert(options.handle, "Choose a safety action.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Report parent",
      onPress: async () => {
        const token = await getToken();
        if (!token) return;
        try {
          await api.reportUser(token, options.userId);
          Alert.alert("Reported", "Thank you. Our safety team can review it.");
        } catch (e) {
          Alert.alert(
            "Could not report",
            e instanceof Error ? e.message : "Please try again."
          );
        }
      },
    },
    {
      text: "Block parent",
      style: "destructive",
      onPress: async () => {
        const token = await getToken();
        if (!token) return;
        try {
          await api.blockUser(token, options.userId);
          options.onBlocked?.();
        } catch (e) {
          Alert.alert(
            "Could not block",
            e instanceof Error ? e.message : "Please try again."
          );
        }
      },
    },
  ]);
}
