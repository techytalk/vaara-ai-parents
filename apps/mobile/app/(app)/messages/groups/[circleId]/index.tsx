import { ChatThreadScreen } from "@/components/chat/ChatThreadScreen";
import { useLocalSearchParams } from "expo-router";

export default function GroupScreen() {
  const { circleId, circleName } = useLocalSearchParams<{
    circleId: string;
    circleName?: string;
  }>();
  const title =
    typeof circleName === "string" && circleName.trim()
      ? circleName.trim()
      : undefined;
  return (
    <ChatThreadScreen
      mode="group"
      circleId={String(circleId)}
      title={title}
    />
  );
}
