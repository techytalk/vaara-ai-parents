import type { Href, Router } from "expo-router";
import { Alert } from "react-native";
import { api, type AuthUser, type Child } from "@/lib/api";
import { invalidateFamilyMeta } from "@/lib/authenticated-state";
import { getToken, saveSession } from "@/lib/session";

/**
 * Confirm + delete a child with last-child navigation per Child 360 §14.
 */
export function confirmRemoveChild(options: {
  child: Child;
  remainingCount: number;
  router: { replace: (href: Href) => void };
  onBusy?: (busy: boolean) => void;
  onError?: (message: string) => void;
}) {
  const { child, remainingCount, router, onBusy, onError } = options;
  const name = child.nickname?.trim() || "this child";
  const isLast = remainingCount <= 1;

  Alert.alert(
    `Remove ${name}?`,
    isLast
      ? `This is your only child profile. Removing it will delete ${name}'s Child 360 information and remove you from their parent circles.\n\nYou'll need to add a child to continue.`
      : "This updates your circle memberships. Child 360 notes for this child are deleted.",
    [
      {
        text: isLast ? `Keep ${name}` : "Cancel",
        style: "cancel",
      },
      {
        text: isLast ? "Remove and add another" : "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const token = await getToken();
            if (!token) return;
            onBusy?.(true);
            try {
              const result = await api.deleteChild(token, child.id);
              if (result.user) {
                await saveSession(token, result.user as AuthUser);
              }
              invalidateFamilyMeta({
                user: result.user as AuthUser,
                children: true,
              });

              if (result.remainingChildIds.length === 0) {
                router.replace({
                  pathname: "/onboarding/children/add",
                  params: { from: "last_child_removed" },
                } as never);
                return;
              }

              const nextId = result.remainingChildIds[0];
              router.replace({
                pathname: "/(app)/child-360/[childId]",
                params: { childId: nextId },
              } as never);
            } catch (e) {
              onError?.(
                e instanceof Error ? e.message : "Failed to remove child"
              );
            } finally {
              onBusy?.(false);
            }
          })();
        },
      },
    ]
  );
}
