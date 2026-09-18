import {
  circleChannel,
  conversationChannel,
  postChannel,
  threadChannel,
  topicChannel,
  userInboxChannel,
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
    }
  | {
      type: "reply.new";
      circleId: string;
      postId: string;
      replyId: string;
    }
  | {
      type: "inbox.updated";
      userId: string;
      reason: "message" | "request" | "request_response";
      conversationId?: string;
      requestId?: string;
    }
  | {
      type: "chat.message";
      circleId: string;
      threadId?: string;
      rootMessageId?: string;
      messageId?: string;
      seq?: number;
      replyCount?: number;
    }
  | {
      type: "chat.thread";
      circleId: string;
      threadId: string;
      seq?: number;
    }
  | {
      type: "access.revoked";
      userId: string;
      circleId?: string;
      threadId?: string;
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
  event: Extract<
    RealtimeEvent,
    { type: "post.new" | "poll.vote" | "reply.new" | "chat.message" | "chat.thread" }
  >
): Promise<void> {
  await publish(circleChannel(circleId), event);
}

export async function publishPostEvent(
  postId: string,
  event: Extract<RealtimeEvent, { type: "reply.new" | "poll.vote" }>
): Promise<void> {
  await publish(postChannel(postId), event);
}

export async function publishConversationEvent(
  conversationId: string,
  event: Extract<RealtimeEvent, { type: "message.new" }>
): Promise<void> {
  await publish(conversationChannel(conversationId), event);
}

export async function publishUserInboxEvent(
  userId: string,
  event: Extract<RealtimeEvent, { type: "inbox.updated" | "access.revoked" }>
): Promise<void> {
  await publish(userInboxChannel(userId), event);
}

export async function publishThreadEvent(
  threadId: string,
  event: Extract<RealtimeEvent, { type: "chat.message" | "chat.thread" }>
): Promise<void> {
  await publish(threadChannel(threadId), event);
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
