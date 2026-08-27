import { pool } from "@vaara/db";
import {
  enqueueListingCreated,
  enqueueMessageCreated,
  enqueuePostCreated,
  invalidateCircleFeedCache,
  invalidateTopicFeedCache,
  isRedisEnabled,
  publishCircleEvent,
  publishConversationEvent,
  publishTopicEvent,
  type CircleTarget,
} from "@vaara/redis";
import { notifyCirclePostMulti, notifyDirectMessage } from "../services/notifications.js";
import { notifyTopicFollowers } from "./topics.js";

export async function dispatchPostCreated(params: {
  postId: string;
  authorId: string;
  postPreview: string;
  targets: CircleTarget[];
  topicIds: string[];
  topicPreview: string;
  topicSlugs: string[];
  circleIds: string[];
}) {
  if (isRedisEnabled()) {
    await enqueuePostCreated({
      postId: params.postId,
      authorId: params.authorId,
      postPreview: params.postPreview,
      targets: params.targets,
      topicIds: params.topicIds,
      topicPreview: params.topicPreview,
      circleIds: params.circleIds,
      topicSlugs: params.topicSlugs,
    });
  } else {
    const client = await pool.connect();
    try {
      await notifyCirclePostMulti(client, {
        targets: params.targets,
        postId: params.postId,
        authorId: params.authorId,
        postPreview: params.postPreview,
      });
      if (params.topicIds.length > 0) {
        await notifyTopicFollowers(client, {
          postId: params.postId,
          authorId: params.authorId,
          topicIds: params.topicIds,
          preview: params.topicPreview,
        });
      }
    } finally {
      client.release();
    }
  }

  await Promise.all(
    params.circleIds.map(async (circleId) => {
      await invalidateCircleFeedCache(circleId);
      await publishCircleEvent(circleId, {
        type: "post.new",
        circleId,
        postId: params.postId,
      });
    })
  );

  await Promise.all(
    params.topicSlugs.map((slug) =>
      publishTopicEvent(slug, { type: "post.new", postId: params.postId })
    )
  );
}

export async function dispatchMessageCreated(params: {
  conversationId: string;
  messageId: string;
  senderId: string;
  recipientId: string;
  senderHandle: string;
  messagePreview: string;
}) {
  await publishConversationEvent(params.conversationId, {
    type: "message.new",
    conversationId: params.conversationId,
    messageId: params.messageId,
    senderId: params.senderId,
  });

  if (isRedisEnabled()) {
    await enqueueMessageCreated(params);
    return;
  }

  const client = await pool.connect();
  try {
    await notifyDirectMessage(client, {
      recipientId: params.recipientId,
      senderHandle: params.senderHandle,
      conversationId: params.conversationId,
      messagePreview: params.messagePreview,
    });
  } finally {
    client.release();
  }
}

export async function dispatchListingCreated(params: {
  listingId: string;
  sellerId: string;
  title: string;
  communityKey: string | null;
  pinCode: string;
}) {
  if (!isRedisEnabled()) {
    return;
  }
  await enqueueListingCreated(params);
}

export async function invalidateTopicCaches(slugs: string[]) {
  await Promise.all(slugs.map((slug) => invalidateTopicFeedCache(slug)));
}
