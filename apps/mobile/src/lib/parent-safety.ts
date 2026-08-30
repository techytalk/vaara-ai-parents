import { useCallback } from "react";
import { Alert } from "react-native";
import { api } from "@/lib/api";
import { useSubmitReport } from "@/providers/ReportProvider";
import { getToken } from "@/lib/session";

export function useParentSafetyActions() {
  const submitReport = useSubmitReport();

  return useCallback(
    (options: {
      handle: string;
      userId: string;
      onBlocked?: () => void;
    }) => {
      Alert.alert(options.handle, "Choose a safety action.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report parent",
          onPress: () => {
            submitReport({
              title: `Report ${options.handle}`,
              submit: async (reason) => {
                const token = await getToken();
                if (!token) throw new Error("Not signed in");
                await api.reportUser(token, options.userId, reason);
              },
            });
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
    },
    [submitReport]
  );
}
