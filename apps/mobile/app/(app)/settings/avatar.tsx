import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { api } from "@/lib/api";
import {
  PARENT_AVATAR_KEYS,
  parentAvatarSourceForKey,
  resolveAvatarKey,
  type ParentAvatarKey,
} from "@/lib/parent-avatar";
import { getToken, updateStoredUser } from "@/lib/session";

export default function AvatarPickerScreen() {
  const router = useRouter();
  const [handle, setHandle] = useState("Parent");
  const [selected, setSelected] = useState<ParentAvatarKey>("parent-01");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me(token);
        setHandle(me.anonymousHandle);
        setSelected(resolveAvatarKey(me.avatarKey, me.anonymousHandle));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function onSave() {
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    try {
      const result = await api.updateAvatar(token, selected);
      await updateStoredUser({ avatarKey: result.avatarKey });
      router.back();
    } catch {
      Alert.alert("Could not update avatar", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ScreenLoader label="Loading avatars" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Pick a character for your anonymous parent profile. Other parents only
        see this icon — never your photo.
      </Text>

      <View style={styles.previewCard}>
        <Image
          source={parentAvatarSourceForKey(selected)}
          style={styles.previewImage}
        />
        <Text style={styles.previewHandle}>{handle}</Text>
      </View>

      <View style={styles.grid}>
        {PARENT_AVATAR_KEYS.map((key) => {
          const active = key === selected;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Select avatar ${key}`}
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(key)}
              style={[styles.choice, active && styles.choiceActive]}
            >
              <Image
                source={parentAvatarSourceForKey(key)}
                style={styles.choiceImage}
              />
              {active ? (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Button label="Save avatar" onPress={onSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  lead: {
    ...typography.supporting,
    color: colors.textMuted,
    lineHeight: 22,
  },
  previewCard: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  previewImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  previewHandle: {
    ...typography.body,
    fontFamily: typography.bold,
    color: colors.text,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  choice: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  choiceActive: {
    borderColor: colors.primary,
  },
  choiceImage: {
    width: "100%",
    height: "100%",
  },
  checkBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
});
