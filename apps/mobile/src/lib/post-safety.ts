import { useCallback } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { removeAuthorFromFeeds } from "@/lib/post-cache";
import { useSubmitReport } from "@/providers/ReportProvider";
import { getToken } from "@/lib/session";

export function usePostSafetyActions() {
  const submitReport = useSubmitReport();
  const queryClient = useQueryClient();

  return useCallback(
    (options: {
      circleId: string;
      postId: string;
      authorId: string;
      handle: string;
      onBlocked?: () => void;
    }) => {
      Alert.alert("Safety options", "Choose an action for this post.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report post",
          onPress: () => {
            submitReport({
              title: "Report post",
              submit: async (reason) => {
                const token = await getToken();
                if (!token) throw new Error("Not signed in");
                await api.reportPost(
                  token,
                  options.circleId,
                  options.postId,
                  reason
                );
              },
            });
          },
        },
        {
          text: "Report parent",
          onPress: () => {
            submitReport({
              title: `Report ${options.handle}`,
              submit: async (reason) => {
                const token = await getToken();
                if (!token) throw new Error("Not signed in");
                await api.reportUser(token, options.authorId, reason);
              },
            });
          },
        },
        {
          text: "Block parent",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const token = await getToken();
              if (!token) return;
              try {
                await api.blockUser(token, options.authorId, {
                  postId: options.postId,
                  circleId: options.circleId,
                });
                removeAuthorFromFeeds(queryClient, options.authorId);
                options.onBlocked?.();
                Alert.alert(
                  "Blocked",
                  "Their posts are removed from your feed. We’ll review this."
                );
              } catch (e) {
                Alert.alert(
                  "Could not block",
                  e instanceof Error ? e.message : "Please try again."
                );
              }
            })();
          },
        },
      ]);
    },
    [queryClient, submitReport]
  );
}
