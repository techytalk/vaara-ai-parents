import "./env.js";
import { createServer } from "http";
import { Queue, Worker } from "bullmq";
import { createServer as createHealthServer } from "http";
import { pool } from "@vaara/db";
import {
  createRedisConnection,
  isRedisEnabled,
  QUEUE_NAMES,
  type ListingCreatedJob,
  type MessageCreatedJob,
  type PostCreatedJob,
} from "@vaara/redis";
import { notifyTopicFollowers } from "@vaara/api/topics";
import {
  notifyCirclePostMulti,
  notifyCommunityNewListing,
  notifyDirectMessage,
  processBackgroundJobs,
} from "@vaara/api/notifications";

if (!isRedisEnabled()) {
  console.error("REDIS_URL is required for the worker");
  process.exit(1);
}

const connection = createRedisConnection();

async function processPostCreated(job: PostCreatedJob) {
  const client = await pool.connect();
  try {
    await notifyCirclePostMulti(client, {
      targets: job.targets,
      postId: job.postId,
      authorId: job.authorId,
      postPreview: job.postPreview,
    });

    if (job.topicIds.length > 0) {
      await notifyTopicFollowers(client, {
        postId: job.postId,
        authorId: job.authorId,
        topicIds: job.topicIds,
        preview: job.topicPreview,
      });
    }
  } finally {
    client.release();
  }
}

async function processMessageCreated(job: MessageCreatedJob) {
  const client = await pool.connect();
  try {
    await notifyDirectMessage(client, {
      recipientId: job.recipientId,
      senderHandle: job.senderHandle,
      conversationId: job.conversationId,
      messagePreview: job.messagePreview,
    });
  } finally {
    client.release();
  }
}

async function processListingCreated(job: ListingCreatedJob) {
  const client = await pool.connect();
  try {
    await notifyCommunityNewListing(client, {
      listingId: job.listingId,
      sellerId: job.sellerId,
      title: job.title,
      communityKey: job.communityKey,
    });
  } finally {
    client.release();
  }
}

async function processMaintenanceTick() {
  const client = await pool.connect();
  try {
    const result = await processBackgroundJobs(client);
    if (
      result.remindersSent > 0 ||
      result.digestsSent > 0 ||
      result.pushesDelivered > 0 ||
      result.listingsExpired > 0
    ) {
      console.log(
        `Maintenance: ${result.remindersSent} reminders, ${result.digestsSent} digests, ${result.pushesDelivered} pushes, ${result.listingsExpired} listings expired`
      );
    }
  } finally {
    client.release();
  }
}

const postsWorker = new Worker<PostCreatedJob>(
  QUEUE_NAMES.POSTS,
  async (job) => {
    if (job.name === "post.created") {
      await processPostCreated(job.data);
    }
  },
  { connection, concurrency: 5 }
);

const messagesWorker = new Worker<MessageCreatedJob>(
  QUEUE_NAMES.MESSAGES,
  async (job) => {
    if (job.name === "message.created") {
      await processMessageCreated(job.data);
    }
  },
  { connection, concurrency: 10 }
);

const listingsWorker = new Worker<ListingCreatedJob>(
  QUEUE_NAMES.LISTINGS,
  async (job) => {
    if (job.name === "listing.created") {
      await processListingCreated(job.data);
    }
  },
  { connection, concurrency: 3 }
);

const maintenanceWorker = new Worker(
  QUEUE_NAMES.MAINTENANCE,
  async (job) => {
    if (job.name === "background.tick") {
      await processMaintenanceTick();
    }
  },
  { connection, concurrency: 1 }
);

for (const worker of [postsWorker, messagesWorker, listingsWorker, maintenanceWorker]) {
  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.name} failed:`, err);
  });
}

const maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, { connection });
const intervalMs = Number(process.env.CRON_INTERVAL_MS ?? 60000);

await maintenanceQueue.add(
  "background.tick",
  {},
  {
    repeat: { every: intervalMs },
    jobId: "background-tick",
    removeOnComplete: true,
    removeOnFail: 50,
  }
);

const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3001);
createHealthServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "worker" }));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(healthPort, () => {
  console.log(`Worker health on http://localhost:${healthPort}/health`);
  console.log("Workers running: posts, messages, listings, maintenance");
});
