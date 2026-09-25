import type { QueryClient } from "@tanstack/react-query";
import type {
  AuthoredPost,
  CirclePost,
  HomeFeedPost,
  PollView,
  PostComment,
  SavedPost,
  ThreadCapabilities,
} from "@/lib/api";

export type PostThreadData = {
  post: CirclePost;
  replies: PostComment[];
  readOnly: boolean;
  capabilities: ThreadCapabilities | null;
  authoritative: boolean;
};

export type HomeFeedCache = {
  pages: Array<{ posts: HomeFeedPost[]; nextCursor: string | null }>;
  pageParams: unknown[];
};

export type CircleFeedCache = {
  posts: CirclePost[];
  memberCount: number;
};

export function postThreadQueryKey(
  circleId: string,
  postId: string,
  shareId?: string
) {
  return shareId
    ? (["postThread", circleId, postId, shareId] as const)
    : (["postThread", circleId, postId] as const);
}

export function findCachedCirclePost(
  queryClient: QueryClient,
  circleId: string,
  postId: string,
  shareId?: string
): CirclePost | undefined {
  const thread = queryClient.getQueryData<PostThreadData>(
    postThreadQueryKey(circleId, postId, shareId)
  );
  if (thread?.post) return thread.post;

  const home = queryClient.getQueryData<HomeFeedCache>(["homeFeed"]);
  const fromHome = home?.pages
    .flatMap((page) => page.posts)
    .find((post) => post.id === postId);
  if (fromHome) return fromHome;

  const circle = queryClient.getQueryData<CircleFeedCache>([
    "circleFeed",
    circleId,
  ]);
  return circle?.posts.find((post) => post.id === postId);
}

export function upsertPostInFeeds(
  queryClient: QueryClient,
  post: CirclePost,
  circleId: string
) {
  queryClient.setQueryData<HomeFeedCache | undefined>(["homeFeed"], (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        posts: page.posts.map((item) =>
          item.id === post.id ? { ...item, ...post } : item
        ),
      })),
    };
  });
  queryClient.setQueryData<CircleFeedCache | undefined>(
    ["circleFeed", circleId],
    (current) => {
      if (!current) return current;
      return {
        ...current,
        posts: current.posts.map((item) =>
          item.id === post.id ? { ...item, ...post } : item
        ),
      };
    }
  );
}

export function mergePostIntoMyPosts(
  queryClient: QueryClient,
  post: CirclePost,
  circleId: string
) {
  queryClient.setQueryData<AuthoredPost[] | undefined>(["myPosts"], (current) => {
    if (!current) return current;
    return current.map((item) =>
      item.id === post.id
        ? {
            ...item,
            body: post.body,
            tag: post.tag,
            replyCount: post.replyCount,
            editedAt: post.editedAt ?? item.editedAt,
            circleId: item.circleId || circleId,
          }
        : item
    );
  });
}

export function removePostFromFeeds(
  queryClient: QueryClient,
  postId: string,
  circleId: string,
  options?: { removeThreadQueries?: boolean }
) {
  queryClient.setQueryData<HomeFeedCache | undefined>(["homeFeed"], (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        posts: page.posts.filter((item) => item.id !== postId),
      })),
    };
  });
  queryClient.setQueryData<CircleFeedCache | undefined>(
    ["circleFeed", circleId],
    (current) => {
      if (!current) return current;
      return {
        ...current,
        posts: current.posts.filter((item) => item.id !== postId),
      };
    }
  );
  queryClient.setQueryData<AuthoredPost[] | undefined>(["myPosts"], (current) =>
    current?.filter((item) => item.id !== postId)
  );
  queryClient.setQueryData<SavedPost[] | undefined>(
    ["me", "savedPosts"],
    (current) => current?.filter((item) => item.id !== postId)
  );
  queryClient.setQueryData<string[] | undefined>(
    ["me", "savedPostIds"],
    (current) => current?.filter((id) => id !== postId)
  );
  if (options?.removeThreadQueries !== false) {
    removePostThreadQueries(queryClient, circleId, postId);
  }
}

/** Drop every cached post by this author after a block. */
export function removeAuthorFromFeeds(
  queryClient: QueryClient,
  authorId: string
) {
  const isAuthor = (post: {
    authorId?: string;
    author?: { userId?: string };
  }) =>
    post.authorId === authorId || post.author?.userId === authorId;

  queryClient.setQueryData<HomeFeedCache | undefined>(["homeFeed"], (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        posts: page.posts.filter((item) => !isAuthor(item)),
      })),
    };
  });

  queryClient.setQueriesData<CircleFeedCache | undefined>(
    { queryKey: ["circleFeed"] },
    (current) => {
      if (!current) return current;
      return {
        ...current,
        posts: current.posts.filter((item) => !isAuthor(item)),
      };
    }
  );
}

export function removePostThreadQueries(
  queryClient: QueryClient,
  circleId: string,
  postId: string
) {
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        key[0] === "postThread" &&
        key[1] === circleId &&
        key[2] === postId
      );
    },
  });
}

export function setSavedPostId(
  queryClient: QueryClient,
  postId: string,
  saved: boolean
) {
  queryClient.setQueryData<string[] | undefined>(
    ["me", "savedPostIds"],
    (current) => {
      const next = new Set(current ?? []);
      if (saved) next.add(postId);
      else next.delete(postId);
      return [...next];
    }
  );
  if (!saved) {
    queryClient.setQueryData<SavedPost[] | undefined>(
      ["me", "savedPosts"],
      (current) => current?.filter((item) => item.id !== postId)
    );
  } else {
    void queryClient.invalidateQueries({ queryKey: ["me", "savedPosts"] });
  }
}

export function patchPostThread(
  queryClient: QueryClient,
  circleId: string,
  postId: string,
  shareId: string | undefined,
  updater: (current: PostThreadData) => PostThreadData
) {
  queryClient.setQueryData<PostThreadData | undefined>(
    postThreadQueryKey(circleId, postId, shareId),
    (current) => (current ? updater(current) : current)
  );
}

export function mergeCirclePostFields(
  queryClient: QueryClient,
  circleId: string,
  postId: string,
  shareId: string | undefined,
  patch: Partial<CirclePost>
) {
  patchPostThread(queryClient, circleId, postId, shareId, (current) => ({
    ...current,
    post: { ...current.post, ...patch },
  }));
  const thread = queryClient.getQueryData<PostThreadData>(
    postThreadQueryKey(circleId, postId, shareId)
  );
  if (thread?.post) {
    upsertPostInFeeds(queryClient, thread.post, circleId);
    if (patch.replyCount != null || patch.body != null || patch.tag != null) {
      mergePostIntoMyPosts(queryClient, thread.post, circleId);
    }
  }
}

export function appendThreadReply(
  queryClient: QueryClient,
  circleId: string,
  postId: string,
  shareId: string | undefined,
  comment: PostComment
) {
  patchPostThread(queryClient, circleId, postId, shareId, (current) => {
    if (current.replies.some((item) => item.id === comment.id)) {
      return current;
    }
    return {
      ...current,
      replies: [...current.replies, comment],
      post: {
        ...current.post,
        replyCount: current.post.replyCount + 1,
      },
    };
  });
  const thread = queryClient.getQueryData<PostThreadData>(
    postThreadQueryKey(circleId, postId, shareId)
  );
  if (thread?.post) {
    upsertPostInFeeds(queryClient, thread.post, circleId);
    mergePostIntoMyPosts(queryClient, thread.post, circleId);
  }
}

export function mergeThreadPoll(
  queryClient: QueryClient,
  circleId: string,
  postId: string,
  shareId: string | undefined,
  poll: PollView
) {
  mergeCirclePostFields(queryClient, circleId, postId, shareId, { poll });
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );
  return results;
}
