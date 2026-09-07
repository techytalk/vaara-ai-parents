import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system";
import { api, type CirclePost } from "./api";
import { trackShareConversion } from "./analytics";

function previewText(post: Pick<CirclePost, "body" | "poll">): string {
  const text = post.body.trim() || post.poll?.question || "A parent post";
  return text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text;
}

function shareMessage(preview: string, url: string, circleName?: string) {
  const via = circleName
    ? `Shared via Vaara Parents (${circleName})`
    : "Shared via Vaara Parents";
  return `${preview}\n\n${via}\n${url}`;
}

export async function sharePostLink(params: {
  token: string;
  circleId: string;
  postId: string;
  post: Pick<CirclePost, "body" | "poll">;
  circleName?: string;
}): Promise<void> {
  const preview = previewText(params.post);
  try {
    const share = await api.createPostShare(
      params.token,
      params.circleId,
      params.postId
    );
    const message = shareMessage(preview, share.url, params.circleName);
    if (Platform.OS === "ios") {
      await Share.share({ message, url: share.url });
      trackShareConversion("post");
      return;
    }
    await Share.share({ message });
    trackShareConversion("post");
  } catch {
    const via = params.circleName
      ? `— via Vaara Parents (${params.circleName})`
      : "— via Vaara Parents";
    await Share.share({ message: `${preview}\n\n${via}` });
    trackShareConversion("post");
  }
}

export async function sharePostMedia(params: {
  token: string;
  circleId: string;
  postId: string;
  post: Pick<CirclePost, "body" | "poll" | "media">;
  circleName?: string;
}): Promise<void> {
  const media = params.post.media?.[0];
  if (!media) {
    await sharePostLink(params);
    return;
  }
  let shareUrl = "";
  try {
    const share = await api.createPostShare(
      params.token,
      params.circleId,
      params.postId
    );
    shareUrl = share.url;
  } catch {
    shareUrl = "";
  }
  const caption = shareMessage(
    previewText(params.post),
    shareUrl || media.url,
    params.circleName
  );
  try {
    const filename = media.type === "video" ? "vaara-share.mp4" : "vaara-share.jpg";
    const local = `${FileSystem.cacheDirectory}${filename}`;
    const download = await FileSystem.downloadAsync(media.url, local);
    if (Platform.OS === "ios") {
      await Share.share({ url: download.uri, message: caption });
      trackShareConversion("post_media");
      return;
    }
    await Share.share({ message: `${caption}\n${media.url}` });
    trackShareConversion("post_media");
  } catch {
    await Share.share({ message: caption || media.url });
    trackShareConversion("post_media");
  }
}
