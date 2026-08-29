import { config } from "dotenv";
import { resolve } from "path";
import { Redis, type RedisOptions } from "ioredis";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

let redis: Redis | null = null;

function requireUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return url;
}

function redisOptions(url: string, blocking: boolean): RedisOptions {
  return {
    // BullMQ and pub/sub subscribers block indefinitely, so they must never
    // give up on a command. Request-scoped callers need a bounded wait or a
    // Redis outage turns into a hung HTTP request.
    maxRetriesPerRequest: blocking ? null : 2,
    enableReadyCheck: false,
    connectTimeout: 5000,
    tls: url.startsWith("rediss://") ? {} : undefined,
  };
}

function attachErrorLogging(client: Redis, label: string): Redis {
  // Without a listener, ioredis connection errors surface as an unhandled
  // 'error' event and take the whole process down.
  client.on("error", (error) => {
    console.error(`[redis:${label}]`, error.message);
  });
  return client;
}

export function isRedisEnabled(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedis(): Redis {
  const url = requireUrl();

  if (!redis) {
    redis = attachErrorLogging(
      new Redis(url, redisOptions(url, false)),
      "shared"
    );
  }

  return redis;
}

export function createRedisConnection(): Redis {
  const url = requireUrl();
  return attachErrorLogging(new Redis(url, redisOptions(url, true)), "blocking");
}
