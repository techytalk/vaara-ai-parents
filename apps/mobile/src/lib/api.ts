import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

export const API_URL =
  extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:3000";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  anonymousHandle: string;
  onboardingComplete: boolean;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type Curriculum = {
  id: string;
  code: string;
  name: string;
  grades: Array<{ id: string; code: string; label: string }>;
};

export type School = {
  id: string;
  name: string;
  branch: string | null;
  city: string;
  state: string | null;
  pinCode: string | null;
  verified: boolean;
  normalizedKey?: string;
  displayLabel: string;
};

export type Child = {
  id: string;
  nickname: string;
  gender: string;
  curriculumId: string;
  gradeId: string;
  schoolId: string;
  curriculum: { code: string; name: string };
  grade: { code: string; label: string };
  school: School;
};

export type Location = {
  pinCode: string;
  locality: string | null;
  city: string | null;
  state: string | null;
  communityName: string | null;
  communityKey: string | null;
};

export type Circle = {
  id: string;
  circleType:
    | "curriculum"
    | "locality"
    | "class"
    | "school"
    | "community";
  key: string;
  displayName: string;
  metadata: Record<string, unknown>;
  memberCount: number;
};

export type CircleAuthor = {
  userId: string;
  anonymousHandle: string;
  contextLabel: string;
};

export type CirclePostMedia = {
  id: string;
  type: "image" | "video";
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type CirclePost = {
  id: string;
  body: string;
  tag: string;
  replyCount: number;
  createdAt: string;
  media: CirclePostMedia[];
  author: CircleAuthor;
};

export type CircleMember = CircleAuthor;

export type ConversationPreview = {
  id: string;
  peer: { userId: string; anonymousHandle: string };
  lastMessage: { body: string; createdAt: string } | null;
  unread: boolean;
};

export type DirectMessage = {
  id: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  senderHandle: string;
};

export type Activity = {
  id: string;
  title: string;
  description: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  feeAmount: number | null;
  feeCurrency: string;
  minGradeId: string | null;
  maxGradeId: string | null;
  locationText: string | null;
  imageUrl: string | null;
  pinCodes: string[];
  curriculumIds: string[];
  createdAt: string;
  updatedAt: string;
  provider?: {
    orgName: string;
    providerType: string;
    verified: boolean;
  };
};

export type ProviderProfile = {
  providerType: string;
  orgName: string;
  description: string | null;
  logoUrl: string | null;
  verified: boolean;
  servicePinCodes: string[];
  onboardingComplete: boolean;
};

export type Reminder = {
  id: string;
  title: string;
  note: string | null;
  fireAt: string;
  sent: boolean;
  activityId: string | null;
  activityTitle?: string | null;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type AppVersionInfo = {
  latestVersion: string;
  minimumVersion: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
};

export type NotificationPrefs = {
  circle_posts?: boolean;
  direct_messages?: boolean;
  reminders?: boolean;
  activity_nearby?: boolean;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  register: (body: {
    email: string;
    password: string;
    role?: "parent" | "provider";
    displayName?: string;
  }) =>
    request<AuthResponse>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) => request<AuthUser>("/v1/me", {}, token),

  getCurricula: () => request<Curriculum[]>("/v1/reference/curricula"),

  getChildren: (token: string) =>
    request<Child[]>("/v1/me/children", {}, token),

  getLocation: (token: string) =>
    request<Location | null>("/v1/me/location", {}, token),

  searchSchools: (
    token: string,
    params: { q: string; city?: string; pin?: string }
  ) => {
    const search = new URLSearchParams({ q: params.q });
    if (params.city) search.set("city", params.city);
    if (params.pin) search.set("pin", params.pin);
    return request<School[]>(`/v1/schools/search?${search}`, {}, token);
  },

  createSchool: (
    token: string,
    body: {
      name: string;
      branch: string;
      city: string;
      state?: string;
      pinCode?: string;
    }
  ) =>
    request<School>("/v1/schools", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  addChild: (
    token: string,
    body: {
      nickname: string;
      gender: string;
      curriculumId: string;
      gradeId: string;
      schoolId: string;
    }
  ) =>
    request<Child>("/v1/me/children", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  deleteChild: (token: string, childId: string) =>
    request<{ ok: boolean }>(`/v1/me/children/${childId}`, {
      method: "DELETE",
    }, token),

  updateChild: (
    token: string,
    childId: string,
    body: {
      nickname?: string;
      gender?: string;
      curriculumId?: string;
      gradeId?: string;
      schoolId?: string;
    }
  ) =>
    request<Child>(`/v1/me/children/${childId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  updateLocation: (
    token: string,
    body: {
      pinCode: string;
      locality?: string;
      city?: string;
      state?: string;
      communityName?: string;
    }
  ) =>
    request<Location & { onboardingComplete?: boolean }>("/v1/me/location", {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  getCircles: (token: string) =>
    request<Circle[]>("/v1/circles", {}, token),

  getCircleMembers: (token: string, circleId: string) =>
    request<CircleMember[]>(`/v1/circles/${circleId}/members`, {}, token),

  getCircleFeed: (
    token: string,
    circleId: string,
    params?: { cursor?: string; scope?: "local" | "all" }
  ) => {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.scope) qs.set("scope", params.scope);
    const q = qs.toString();
    return request<{ posts: CirclePost[]; nextCursor: string | null }>(
      `/v1/circles/${circleId}/feed${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  createPost: (
    token: string,
    circleId: string,
    body: {
      body: string;
      tag?: string;
      targetCircleIds?: string[];
      media?: Array<{
        storageKey: string;
        mediaType: "image" | "video";
        mimeType: string;
        width?: number;
        height?: number;
        durationMs?: number;
      }>;
    }
  ) =>
    request<CirclePost>(`/v1/circles/${circleId}/posts`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  getMediaStatus: (token: string) =>
    request<{ configured: boolean }>("/v1/media/status", {}, token),

  createMediaUpload: (
    token: string,
    body: {
      fileName: string;
      mediaType: "image" | "video";
      mimeType: string;
      sizeBytes: number;
    }
  ) =>
    request<{
      storageKey: string;
      uploadUrl: string;
      publicUrl: string;
      expiresInSeconds: number;
    }>(
      "/v1/media/upload-url",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  getPost: (token: string, circleId: string, postId: string) =>
    request<{
      post: CirclePost;
      replies: Array<{
        id: string;
        body: string;
        createdAt: string;
        author: CircleAuthor;
      }>;
    }>(`/v1/circles/${circleId}/posts/${postId}`, {}, token),

  addReply: (
    token: string,
    circleId: string,
    postId: string,
    body: string
  ) =>
    request<{
      id: string;
      body: string;
      createdAt: string;
      author: CircleAuthor;
    }>(`/v1/circles/${circleId}/posts/${postId}/replies`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }, token),

  getConversations: (token: string) =>
    request<ConversationPreview[]>("/v1/conversations", {}, token),

  startConversation: (
    token: string,
    body: { peerUserId: string; circleId?: string; postId?: string }
  ) =>
    request<{ id: string; peer: { userId: string; anonymousHandle: string } }>(
      "/v1/conversations",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  getMessages: (token: string, conversationId: string) =>
    request<{
      peer: { userId: string; anonymousHandle: string };
      messages: DirectMessage[];
    }>(`/v1/conversations/${conversationId}/messages`, {}, token),

  sendMessage: (token: string, conversationId: string, body: string) =>
    request<DirectMessage>(
      `/v1/conversations/${conversationId}/messages`,
      { method: "POST", body: JSON.stringify({ body }) },
      token
    ),

  markConversationRead: (token: string, conversationId: string) =>
    request<{ ok: boolean }>(
      `/v1/conversations/${conversationId}/read`,
      { method: "PATCH" },
      token
    ),

  blockUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/v1/me/blocks/${userId}`, {
      method: "POST",
    }, token),

  getProviderProfile: (token: string) =>
    request<ProviderProfile | null>("/v1/provider/profile", {}, token),

  updateProviderProfile: (
    token: string,
    body: {
      providerType: string;
      orgName: string;
      description?: string;
      servicePinCodes: string[];
    }
  ) =>
    request<ProviderProfile>("/v1/provider/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  getProviderActivities: (token: string) =>
    request<Activity[]>("/v1/provider/activities", {}, token),

  createProviderActivity: (
    token: string,
    body: Partial<Activity> & {
      title: string;
      description: string;
      pinCodes: string[];
      curriculumIds?: string[];
      status?: string;
    }
  ) =>
    request<Activity>("/v1/provider/activities", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  updateProviderActivity: (
    token: string,
    activityId: string,
    body: Record<string, unknown>
  ) =>
    request<Activity>(`/v1/provider/activities/${activityId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  deleteProviderActivity: (token: string, activityId: string) =>
    request<{ ok: boolean }>(`/v1/provider/activities/${activityId}`, {
      method: "DELETE",
    }, token),

  discoverActivities: (
    token: string,
    params?: { pin?: string; curriculum?: string; q?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.pin) qs.set("pin", params.pin);
    if (params?.curriculum) qs.set("curriculum", params.curriculum);
    if (params?.q) qs.set("q", params.q);
    const q = qs.toString();
    return request<Activity[]>(
      `/v1/activities${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  getActivity: (token: string, activityId: string) =>
    request<Activity>(`/v1/activities/${activityId}`, {}, token),

  registerPushToken: (token: string, pushToken: string) =>
    request<{ ok: boolean }>("/v1/me/push-token", {
      method: "POST",
      body: JSON.stringify({ pushToken }),
    }, token),

  getNotificationPrefs: (token: string) =>
    request<NotificationPrefs>("/v1/me/notification-prefs", {}, token),

  updateNotificationPrefs: (token: string, prefs: NotificationPrefs) =>
    request<NotificationPrefs>("/v1/me/notification-prefs", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    }, token),

  getReminders: (token: string) =>
    request<Reminder[]>("/v1/me/reminders", {}, token),

  createReminder: (
    token: string,
    body: {
      title: string;
      note?: string;
      fireAt: string;
      activityId?: string;
    }
  ) =>
    request<Reminder>("/v1/me/reminders", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  deleteReminder: (token: string, reminderId: string) =>
    request<{ ok: boolean }>(`/v1/me/reminders/${reminderId}`, {
      method: "DELETE",
    }, token),

  getNotifications: (token: string) =>
    request<AppNotification[]>("/v1/me/notifications", {}, token),

  markNotificationRead: (token: string, notificationId: string) =>
    request<{ ok: boolean }>(`/v1/me/notifications/${notificationId}/read`, {
      method: "PATCH",
    }, token),

  markAllNotificationsRead: (token: string) =>
    request<{ ok: boolean }>("/v1/me/notifications/read-all", {
      method: "PATCH",
    }, token),

  getAppVersion: () => request<AppVersionInfo>("/v1/app/version"),
};
