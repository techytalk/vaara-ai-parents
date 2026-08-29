import { Image, StyleSheet, View } from "react-native";
import { colors } from "@/constants/theme";
import { parentAvatarSource } from "@/lib/parent-avatar";

export function ParentAvatar({
  handle,
  avatarKey,
  size = 40,
}: {
  handle: string;
  avatarKey?: string | null;
  size?: number;
}) {
  return (
    <View
      accessibilityLabel={`${handle} avatar`}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Image
        source={parentAvatarSource(handle, avatarKey)}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
  },
  image: { width: "100%", height: "100%" },
});
