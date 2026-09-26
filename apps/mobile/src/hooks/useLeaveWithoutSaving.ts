import { useCallback } from "react";
import { Alert } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

/**
 * Blocks leaving a Child 360 form when there are unsaved edits.
 * Uses usePreventRemove (required for native-stack; raw beforeRemove+preventDefault breaks JS/native sync).
 */
export function useLeaveWithoutSaving(dirty: boolean, saving = false) {
  const navigation = useNavigation();
  const shouldPrevent = dirty && !saving;

  usePreventRemove(
    shouldPrevent,
    useCallback(
      ({ data }) => {
        Alert.alert("Leave without saving?", "Your changes will be lost.", [
          { text: "Stay", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: () => navigation.dispatch(data.action),
          },
        ]);
      },
      [navigation]
    )
  );
}
