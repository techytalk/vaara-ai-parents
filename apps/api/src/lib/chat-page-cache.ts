import {
  chatLinearPageKey,
  chatThreadPageKey,
  getCachedJson,
  PAGE_CACHE_TTL,
  setCachedJson,
} from "@vaara/redis";
import type { ChatMessageView } from "../services/chat.js";

export const CHAT_PAGE_MAX = 100;

export type CachedChatMessage = ChatMessageView & {
  threadOpen?: boolean;
};

type ChatPage = { messages: CachedChatMessage[] };

function forCache(message: CachedChatMessage): CachedChatMessage {
  return {
    ...message,
    reactions: [],
    attachments: message.attachments.map((item) => ({ ...item, url: null })),
  };
}

export function toClientChatMessages(
  messages: CachedChatMessage[]
): ChatMessageView[] {
  return messages.map((message) => {
    const { threadOpen: _threadOpen, ...rest } = message;
    return rest;
  });
}

async function readPage(key: string): Promise<CachedChatMessage[] | null> {
  const page = await getCachedJson<ChatPage>(key);
  return page?.messages ?? null;
}

async function writePage(
  key: string,
  messages: CachedChatMessage[]
): Promise<void> {
  const sorted = [...messages]
    .map(forCache)
    .sort((a, b) => a.seq - b.seq)
    .slice(-CHAT_PAGE_MAX);
  await setCachedJson(key, { messages: sorted }, PAGE_CACHE_TTL.chat);
}

export async function readCachedLinearMessages(
  circleId: string
): Promise<CachedChatMessage[] | null> {
  return readPage(chatLinearPageKey(circleId));
}

export async function readCachedThreadMessages(
  threadId: string
): Promise<CachedChatMessage[] | null> {
  return readPage(chatThreadPageKey(threadId));
}

export async function writeCachedLinearMessages(
  circleId: string,
  messages: CachedChatMessage[]
): Promise<void> {
  await writePage(chatLinearPageKey(circleId), messages);
}

export async function writeCachedThreadMessages(
  threadId: string,
  messages: CachedChatMessage[]
): Promise<void> {
  await writePage(chatThreadPageKey(threadId), messages);
}

async function upsertIntoPage(
  key: string,
  message: CachedChatMessage
): Promise<"inserted" | "updated" | "miss"> {
  const page = await readPage(key);
  if (!page) return "miss";
  const existing = page.find((item) => item.id === message.id);
  const messages = page.filter((item) => item.id !== message.id);
  if (existing) {
    messages.push(
      forCache({
        ...existing,
        body: message.body,
        status: message.status,
        editedAt: message.editedAt,
        attachments:
          message.attachments.length > 0
            ? message.attachments
            : existing.attachments,
        author: message.author,
      })
    );
    await writePage(key, messages);
    return "updated";
  }
  messages.push(forCache(message));
  await writePage(key, messages);
  return "inserted";
}

async function bumpLinearParent(message: CachedChatMessage): Promise<void> {
  if (!message.threadId) return;
  const page = await readCachedLinearMessages(message.circleId);
  if (!page) return;
  const preview =
    (message.body ?? "").trim().slice(0, 80) || message.lastReplyPreview;
  let changed = false;
  const next = page.map((item) => {
    if (item.sideThreadId !== message.threadId) return item;
    changed = true;
    return {
      ...item,
      replyCount: item.replyCount + 1,
      lastReplyPreview: preview || item.lastReplyPreview,
      threadOpen: true,
    };
  });
  if (changed) await writeCachedLinearMessages(message.circleId, next);
}

export async function patchCachedLinearSideThread(params: {
  circleId: string;
  messageId: string;
  threadId: string;
}): Promise<void> {
  const page = await readCachedLinearMessages(params.circleId);
  if (!page) return;
  let changed = false;
  const next = page.map((item) => {
    if (item.id !== params.messageId) return item;
    changed = true;
    return {
      ...item,
      sideThreadId: params.threadId,
      threadOpen: true,
    };
  });
  if (changed) await writeCachedLinearMessages(params.circleId, next);
}

export async function upsertCachedChatMessage(
  message: ChatMessageView
): Promise<void> {
  if (message.threadId) {
    const result = await upsertIntoPage(
      chatThreadPageKey(message.threadId),
      message
    );
    if (result === "inserted") await bumpLinearParent(message);
    return;
  }
  await upsertIntoPage(chatLinearPageKey(message.circleId), message);
}
