import { Queue } from "bullmq";
import { createRedisConnection } from "./client.js";

export const QUEUE_NAMES = {
  POSTS: "vaara-posts",
  MESSAGES: "vaara-messages",
  LISTINGS: "vaara-listings",
  MAINTENANCE: "vaara-maintenance",
} as const;

export type CircleTarget = {
  id: string;
  circle_type: string;
  display_name: string;
};

export type PostCreatedJob = {
  postId: string;
  authorId: string;
  postPreview: string;
  targets: CircleTarget[];
  topicIds: string[];
  topicPreview: string;
  circleIds: string[];
  topicSlugs: string[];
};

export type MessageCreatedJob = {
  conversationId: string;
  messageId: string;
  senderId: string;
  recipientId: string;
  senderHandle: string;
  messagePreview: string;
};

export type ListingCreatedJob = {
  listingId: string;
  sellerId: string;
  title: string;
  communityKey: string | null;
  pinCode: string;
};

let postsQueue: Queue<PostCreatedJob> | null = null;
let messagesQueue: Queue<MessageCreatedJob> | null = null;
let listingsQueue: Queue<ListingCreatedJob> | null = null;
let maintenanceQueue: Queue | null = null;

function getQueue<T>(name: string, ref: Queue<T> | null): Queue<T> {
  if (ref) return ref;
  return new Queue<T>(name, { connection: createRedisConnection() });
}

export function getPostsQueue(): Queue<PostCreatedJob> {
  if (!postsQueue) {
    postsQueue = getQueue(QUEUE_NAMES.POSTS, postsQueue);
  }
  return postsQueue;
}

export function getMessagesQueue(): Queue<MessageCreatedJob> {
  if (!messagesQueue) {
    messagesQueue = getQueue(QUEUE_NAMES.MESSAGES, messagesQueue);
  }
  return messagesQueue;
}

export function getListingsQueue(): Queue<ListingCreatedJob> {
  if (!listingsQueue) {
    listingsQueue = getQueue(QUEUE_NAMES.LISTINGS, listingsQueue);
  }
  return listingsQueue;
}

export function getMaintenanceQueue(): Queue {
  if (!maintenanceQueue) {
    maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
      connection: createRedisConnection(),
    });
  }
  return maintenanceQueue;
}

export async function enqueuePostCreated(job: PostCreatedJob): Promise<void> {
  await getPostsQueue().add("post.created", job, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

export async function enqueueMessageCreated(
  job: MessageCreatedJob
): Promise<void> {
  await getMessagesQueue().add("message.created", job, {
    attempts: 3,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

export async function enqueueListingCreated(
  job: ListingCreatedJob
): Promise<void> {
  await getListingsQueue().add("listing.created", job, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}
