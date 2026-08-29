import {
  circleChannel,
  conversationChannel,
  topicChannel,
} from "./channels.js";
import { getRedis, isRedisEnabled } from "./client.js";

export type RealtimeEvent =
  | {
      type: "post.new";
      circleId: string;
      postId: string;
    }
  | {
      type: "message.new";
      conversationId: string;
      messageId: string;
      senderId: string;
    }
  | {
      type: "poll.vote";
      circleId: string;
      postId: string;
    };

async function publish(channel: string, event: RealtimeEvent): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    await getRedis().publish(channel, JSON.stringify(event));
  } catch (error) {
    // The write already succeeded; losing the live nudge only means clients
    // fall back to polling.
    console.error("[redis:pubsub]", (error as Error).message);
  }
}

export async function publishCircleEvent(
  circleId: string,
  event: Extract<RealtimeEvent, { type: "post.new" | "poll.vote" }>
): Promise<void> {
  await publish(circleChannel(circleId), event);
}

export async function publishConversationEvent(
  conversationId: string,
  event: Extract<RealtimeEvent, { type: "message.new" }>
): Promise<void> {
  await publish(conversationChannel(conversationId), event);
}

export async function publishTopicEvent(
  slug: string,
  event: { type: "post.new"; postId: string }
): Promise<void> {
  await publish(topicChannel(slug), {
    type: "post.new",
    circleId: slug,
    postId: event.postId,
  });
}
