import { ChatThreadScreen } from "@/components/chat/ChatThreadScreen";
import { useLocalSearchParams } from "expo-router";

export default function GroupScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  return <ChatThreadScreen mode="group" circleId={String(circleId)} />;
}
