import { useEffect } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";

/**
 * Blocks leaving a Child 360 form when there are unsaved edits.
 * Spec: Back with anything typed asks “Leave without saving?”
 */
export function useLeaveWithoutSaving(dirty: boolean, saving = false) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!dirty || saving) return;
      e.preventDefault();
      Alert.alert("Leave without saving?", "Your changes will be lost.", [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty, saving]);
}
