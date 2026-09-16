import { ChatThreadScreen } from "@/components/chat/ChatThreadScreen";
import { useLocalSearchParams } from "expo-router";

export default function ThreadRoute() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  return <ChatThreadScreen mode="thread" threadId={String(threadId)} />;
}
