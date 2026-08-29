import "./env.js";
import { createServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { createRedisConnection, isRedisEnabled } from "@vaara/redis";
import { pool } from "@vaara/db";
import { verifyToken } from "@vaara/api/auth";

if (!isRedisEnabled()) {
  console.error("REDIS_URL is required for the realtime gateway");
  process.exit(1);
}

type ClientState = {
  userId: string;
  subscriptions: Set<string>;
  alive: boolean;
};

const clients = new Map<WebSocket, ClientState>();
const channelRefCounts = new Map<string, number>();
const subscriber = createRedisConnection();

subscriber.on("message", (channel, message) => {
  for (const [socket, state] of clients) {
    if (socket.readyState !== socket.OPEN) continue;
    if (!state.subscriptions.has(channel)) continue;
    socket.send(
      JSON.stringify({
        channel,
        event: JSON.parse(message),
      })
    );
  }
});

async function subscribeChannel(channel: string) {
  const count = channelRefCounts.get(channel) ?? 0;
  channelRefCounts.set(channel, count + 1);
  if (count === 0) {
    await subscriber.subscribe(channel);
  }
}

async function unsubscribeChannel(channel: string) {
  const count = channelRefCounts.get(channel) ?? 0;
  if (count <= 1) {
    channelRefCounts.delete(channel);
    await subscriber.unsubscribe(channel);
    return;
  }
  channelRefCounts.set(channel, count - 1);
}

async function canSubscribe(
  userId: string,
  channel: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    if (channel.startsWith("circle:")) {
      const circleId = channel.slice("circle:".length);
      const { rows } = await client.query(
        `SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2`,
        [circleId, userId]
      );
      return rows.length > 0;
    }

    if (channel.startsWith("conversation:")) {
      const conversationId = channel.slice("conversation:".length);
      const { rows } = await client.query(
        `SELECT 1 FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
      );
      return rows.length > 0;
    }

    if (channel.startsWith("topic:")) {
      const slug = channel.slice("topic:".length);
      const { rows } = await client.query(
        `SELECT 1 FROM topic_follows tf
         JOIN topics t ON t.id = tf.topic_id
         WHERE tf.user_id = $1 AND t.slug = $2`,
        [userId, slug]
      );
      return rows.length > 0;
    }

    return false;
  } finally {
    client.release();
  }
}

const port = Number(process.env.PORT ?? process.env.REALTIME_PORT ?? 3002);
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "realtime" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: "/ws" });

// Phones on mobile networks disappear without a close frame. Without this the
// server keeps feeding events to sockets nobody is listening on.
const HEARTBEAT_MS = 30_000;
setInterval(() => {
  for (const [socket, state] of clients) {
    if (!state.alive) {
      socket.terminate();
      continue;
    }
    state.alive = false;
    socket.ping();
  }
}, HEARTBEAT_MS).unref();

wss.on("connection", async (socket, req) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    socket.close(4401, "Unauthorized");
    return;
  }

  let userId: string;
  try {
    const payload = await verifyToken(token);
    userId = payload.sub;
  } catch {
    socket.close(4401, "Unauthorized");
    return;
  }

  const state: ClientState = { userId, subscriptions: new Set(), alive: true };
  clients.set(socket, state);

  socket.on("pong", () => {
    state.alive = true;
  });

  socket.send(JSON.stringify({ type: "connected", userId }));

  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as {
        type?: string;
        channel?: string;
      };

      if (message.type === "subscribe" && message.channel) {
        if (state.subscriptions.has(message.channel)) {
          socket.send(
            JSON.stringify({ type: "subscribed", channel: message.channel })
          );
          return;
        }

        const allowed = await canSubscribe(userId, message.channel);
        if (!allowed) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Not allowed to subscribe",
              channel: message.channel,
            })
          );
          return;
        }

        state.subscriptions.add(message.channel);
        await subscribeChannel(message.channel);
        socket.send(
          JSON.stringify({ type: "subscribed", channel: message.channel })
        );
        return;
      }

      if (message.type === "unsubscribe" && message.channel) {
        if (state.subscriptions.delete(message.channel)) {
          await unsubscribeChannel(message.channel);
        }
        socket.send(
          JSON.stringify({ type: "unsubscribed", channel: message.channel })
        );
      }
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid message" }));
    }
  });

  socket.on("close", async () => {
    for (const channel of state.subscriptions) {
      await unsubscribeChannel(channel);
    }
    clients.delete(socket);
  });
});

server.listen(port, () => {
  console.log(`Realtime gateway listening on port ${port} (path /ws)`);
});
