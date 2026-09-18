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
  roles?: Array<"parent" | "provider">;
  displayName: string | null;
  anonymousHandle: string;
  onboardingComplete: boolean;
  avatarKey?: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
  /** True when this auth call created the account (register / first OAuth). */
  isNewUser?: boolean;
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
  boardCodes?: string[];
  kind?: "preschool" | "school";
  offersPreschool?: boolean;
};

export type SchoolListItem = School & {
  ratingAvg: number | null;
  ratingCount: number;
  boardCodes?: string[];
};

export type Child = {
  id: string;
  nickname: string | null;
  gender: string;
  dateOfBirth: string | null;
  track: "school" | "preschool";
  ageYears: number | null;
  ageConfirmedAt?: string | null;
  experiencedAgeYears?: number | null;
  ageCircleUntil?: string | null;
  curriculumId: string | null;
  gradeId: string | null;
  schoolId: string;
  curriculum: { code: string; name: string } | null;
  grade: { code: string; label: string } | null;
  school: School;
};

export type Location = {
  countryCode: string;
  pinCode: string;
  postalCode?: string;
  locality: string | null;
  city: string | null;
  state: string | null;
  communityName: string | null;
  communityKey: string | null;
};

export type PostalCountry = {
  code: string;
  name: string;
  postalLabel: string;
  placeholder: string;
  provider: "india" | "zippopotam" | "manual";
  lookupSupported: boolean;
};

export type PinCodeLookup = {
  countryCode: string;
  countryName: string;
  pinCode: string;
  postalCode: string;
  state: string;
  city: string;
  district: string;
  localities: Array<{
    name: string;
    officeType: string | null;
    deliveryStatus: string | null;
  }>;
  /** @deprecated Removed from public postal responses; may be empty. */
  communities?: string[];
  source?: "db" | "external" | "bundled";
};

export type SchoolCatalogRow = {
  id: string;
  name: string;
  branch: string | null;
  locality: string | null;
  region: string | null;
  aliases: string[];
  boards: string[];
  verified?: boolean;
};

export type SchoolCatalogManifest = {
  schemaVersion: number;
  generation: number;
  checksum: string;
  compressedSize: number | null;
  rowCount: number;
  createdAt: string;
  url: string;
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export type Circle = {
  id: string;
  circleType:
    | "curriculum"
    | "locality"
    | "class"
    | "school"
    | "school_class"
    | "school_age"
    | "age_locality"
    | "community";
  key: string;
  displayName: string;
  metadata: Record<string, unknown>;
  memberCount: number;
  newPostCount?: number;
};

export type AddChildResult = {
  child: Child;
  user: AuthUser;
  circles: Circle[];
};

export type CircleAuthor = {
  userId: string;
  anonymousHandle: string;
  contextLabel: string;
  avatarKey: string;
  isGuest?: boolean;
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

export type CirclePostDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type PollView = {
  id: string;
  question: string;
  options: Array<{ id: string; label: string; voteCount: number }>;
  myOptionId: string | null;
  totalVotes: number;
  resultsVisible: boolean;
  closesAt: string | null;
};

export type ThreadAccessState =
  | "member"
  | "author"
  | "discovery_preview"
  | "share_preview";

export type ThreadCapabilities = {
  canViewPost: boolean;
  canViewReplies: boolean;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canVote: boolean;
  canMarkHelpful: boolean;
  canSave: boolean;
  canMessageAuthor: boolean;
  canOpenCircle: boolean;
  canReport: boolean;
};

export type AuthoredPost = {
  id: string;
  body: string;
  tag: string;
  replyCount: number;
  createdAt: string;
  editedAt: string | null;
  circleId: string;
  circleName: string;
  accessState: "member" | "author";
  postingContext?: "member" | "guest";
  crossPostGroupId?: string | null;
  targets?: Array<{
    circleId: string;
    circleName: string;
    accessMode: "member" | "guest";
  }>;
};

export type GuestQuota = {
  used: number;
  remaining: number;
  limit: number;
  timezone: string;
};

export type CircleDirectoryItem = {
  id: string;
  displayName: string;
  circleType: string;
  subtitle: string | null;
  accessMode: "member" | "guest";
  acceptsGuestPosts: boolean;
};

export type CrossPostResult = {
  groupId: string;
  postId: string;
  primaryCircleId: string;
  posts: Array<{
    circleId: string;
    postId: string;
    accessMode: "member" | "guest";
    displayName: string;
    isPrimary?: boolean;
  }>;
  guestQuota: GuestQuota;
};

export type CirclePost = {
  id: string;
  body: string;
  tag: string;
  replyCount: number;
  createdAt: string;
  editedAt?: string | null;
  media: CirclePostMedia[];
  documents?: CirclePostDocument[];
  poll: PollView | null;
  topics?: Array<{ slug: string; name: string; category: string | null }>;
  circles?: Array<{ id: string; displayName: string; circleType: string }>;
  author: CircleAuthor;
  authorId?: string;
  helpfulCount?: number;
  myHelpful?: boolean;
};

export type HomeFeedPost = CirclePost & {
  circleId: string;
  circleName: string;
  discovery?: boolean;
};

export type PostComment = {
  id: string;
  body: string;
  createdAt: string;
  author: CircleAuthor;
};

export type CircleMember = CircleAuthor;

export type PeerView = {
  userId: string;
  anonymousHandle: string;
  contextLabel: string;
  avatarKey: string;
  disclosureLevel: 0 | 1 | 2 | 3;
  firstName?: string;
  blockOrFlat?: string;
  fullName?: string;
  contactPhone?: string;
  vehicleDescription?: string;
};

export type DisclosureState = {
  effectiveLevel: 0 | 1 | 2 | 3;
  ownOffer: 0 | 1 | 2 | 3;
  peerOffer: 0 | 1 | 2 | 3;
  peer: PeerView | null;
};

export type ContactDetails = {
  firstName: string | null;
  blockOrFlat: string | null;
  contactPhone: string | null;
  vehicleDescription: string | null;
  updatedAt: string;
};

export type SavedPost = {
  id: string;
  circleId?: string;
  body?: string;
  tag?: string;
  createdAt?: string;
  editedAt?: string | null;
  authorHandle?: string;
  authorAvatarKey?: string;
  savedAt: string;
  unavailable?: boolean;
};

export type ListingMedia = {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
};

export type SchoolProfile = School & {
  boardCodes: string[];
  gradesOffered: string | null;
  transportAvailable: boolean | null;
  ratingAvg: number | null;
  ratingCount: number;
};

export type SchoolReview = {
  id: string;
  rating: number;
  body: string | null;
  attendanceVerified: boolean;
  academicYear: string | null;
  createdAt: string;
  author: { anonymousHandle: string; contextLabel: string };
};

export type TopicCatalogItem = {
  slug: string;
  name: string;
  description?: string | null;
  sensitive?: boolean;
  followerCount?: number;
  postCount?: number;
};

export type SchoolEvent = {
  id: string;
  schoolId?: string;
  schoolName?: string;
  title: string;
  description?: string | null;
  eventType: string;
  startsAt: string;
  endsAt?: string | null;
  unconfirmed?: boolean;
  needsReview?: boolean;
};

export type Practitioner = {
  id: string;
  name: string;
  category: string;
  clinicName: string | null;
  pinCode: string;
  locality: string | null;
  city: string | null;
  verified: boolean;
  recommendationCount: number;
};

export type ExpertSession = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  expert: { displayName: string; credentials: string; verified: boolean };
};

export type PlaydateMatch = {
  userId: string;
  anonymousHandle: string;
  avatarKey: string;
  ageBand: string;
};

export type CarpoolOffer = {
  id: string;
  role: string;
  direction: string;
  daysOfWeek: number[];
  departureTime: string;
  seats: number | null;
  notes: string | null;
  ownerUserId: string;
  ownerHandle: string;
};

export type CarpoolParticipant = {
  userId: string;
  role: string;
  disclosureConfirmed: boolean;
  handle: string;
  peerView: PeerView | null;
};

export type CarpoolArrangement = {
  id: string;
  status: string;
  departureTime: string;
  daysOfWeek: number[];
  disclaimer: string;
  participants: CarpoolParticipant[];
};

export type Listing = {
  id: string;
  kind: "for_sale" | "free" | "wanted";
  status: "active" | "reserved" | "completed" | "expired" | "removed";
  category: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: string;
  communityKey: string | null;
  pinCode: string;
  schoolId: string | null;
  gradeId: string | null;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: ListingMedia[];
  isMine: boolean;
};

export type ConversationPreview = {
  id: string;
  peer: PeerView;
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
  unread: boolean;
};

export type ChatInboxGroup = {
  kind: "group";
  id: string;
  name: string;
  circleType: string;
  preview: string | null;
  lastAt: string | null;
  unreadCount: number;
};

export type ChatInboxDm = {
  kind: "dm";
  id: string;
  contextKey: string;
  myRole: string;
  peerRole: string;
  peer: {
    userId: string;
    anonymousHandle: string;
    avatarKey: string | null;
  };
  preview: string | null;
  lastAt: string | null;
  unreadCount: number;
};

export type ChatInboxService = {
  kind: "service";
  id: string;
  name: string;
  preview: string | null;
  lastAt: string | null;
  unreadCount: number;
};

export type ChatInboxGuestThread = {
  kind: "guest_thread";
  id: string;
  circleId: string;
  circleName: string;
  title: string | null;
  preview: string | null;
  lastAt: string | null;
  replyCount: number;
  unreadCount: number;
};

export type ChatInbox = {
  groups: ChatInboxGroup[];
  guestThreads?: ChatInboxGuestThread[];
  dms: ChatInboxDm[];
  services: ChatInboxService[];
};

export type ChatHomeItem = {
  kind: "thread" | "service";
  access?: "member" | "discovery";
  id: string;
  circleId?: string;
  circleName?: string;
  circleType?: string;
  title?: string | null;
  body?: string | null;
  lastMessageAt?: string;
  replyCount?: number;
  following?: boolean;
  providerId?: string;
  name?: string;
  preview?: string | null;
};

export type ChatMessage = {
  id: string;
  seq: number;
  circleId: string;
  threadId: string | null;
  sideThreadId?: string | null;
  replyCount?: number;
  lastReplyPreview?: string | null;
  body: string | null;
  status: string;
  isLegacy: boolean;
  replyToMessageId: string | null;
  author: {
    userId: string;
    displayName: string;
    avatarKey: string | null;
    role: "parent" | "provider";
    isGuest: boolean;
  };
  createdAt: string;
  editedAt: string | null;
  reactions?: Array<{ reaction: string; count: number; mine: boolean }>;
};

export type MessageableParent = {
  userId: string;
  anonymousHandle: string;
  contextLabel: string;
  avatarKey: string;
  circleId: string;
  circleName: string;
  existingConversationId: string | null;
};

export type ParentConnectionRequest = {
  id: string;
  direction: "incoming" | "outgoing";
  peer: {
    userId: string;
    anonymousHandle: string;
    contextLabel: string;
    avatarKey: string;
  };
  introduction: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  conversationId: string | null;
  createdAt: string;
  respondedAt: string | null;
};

export type DirectMessage = {
  id: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  senderHandle: string;
};

export type ActivityCategory =
  | "tutoring"
  | "coaching"
  | "classes"
  | "arts"
  | "sports"
  | "other";

export type Activity = {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
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
  providerId?: string;
  provider?: {
    orgName: string;
    providerType: string;
    verified: boolean;
    ratingAvg?: number | null;
    ratingCount?: number;
    feeMin?: number | null;
    feeMax?: number | null;
  };
};

export type ProviderReview = {
  id: string;
  rating: number;
  body: string | null;
  engagementVerified: boolean;
  createdAt: string;
  author: CircleAuthor;
  reply: { body: string; createdAt: string } | null;
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

export type MeStats = {
  circleCount: number;
  savedPostCount: number;
  helpfulReceivedCount: number;
};

export type NotificationPrefs = {
  circle_posts?: boolean;
  circle_replies?: boolean;
  direct_messages?: boolean;
  reminders?: boolean;
  activity_nearby?: boolean;
  topics?: boolean;
  listings?: boolean;
  disclosures?: boolean;
  carpool?: boolean;
  school_events?: boolean;
  expert_sessions?: boolean;
  group_messages?: boolean;
  thread_replies?: boolean;
  thread_mentions?: boolean;
  provider_responses?: boolean;
  service_updates?: boolean;
  quiet_hours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
};

export type NotificationMute = {
  scope: "circle" | "topic" | "listing";
  scopeId: string;
  createdAt: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

const TIMEOUT_MESSAGE = "Request timed out. Check your connection and try again.";

/** Set on the errors we raise for our own timeout, never for a caller's abort. */
const TIMEOUT_FLAG = Symbol("requestTimeout");

function isTimeoutError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && TIMEOUT_FLAG in error
  );
}

function isIdempotentGet(options: RequestInit): boolean {
  return (options.method ?? "GET").toUpperCase() === "GET";
}

function isTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isTimeoutError(error)) return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror")
  );
}

async function requestOnce<T>(
  path: string,
  options: RequestInit,
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 204) {
      return undefined as T;
    }

    if (!res.ok) {
      const message =
        (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        `Request failed (${res.status})`;
      throw new ApiError(message, res.status, data);
    }
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && timedOut) {
      throw Object.assign(new Error(TIMEOUT_MESSAGE), { [TIMEOUT_FLAG]: true });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const canRetry = isIdempotentGet(options);
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      return await requestOnce<T>(path, options, token);
    } catch (error) {
      const status =
        error instanceof Error && "status" in error
          ? Number((error as Error & { status?: number }).status)
          : undefined;
      const retry =
        canRetry &&
        attempt < 2 &&
        (isTransientStatus(status ?? 0) || isRetryableNetworkError(error));
      if (!retry) throw error;
    }
  }
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

  loginWithGoogle: (body: {
    idToken: string;
    role?: "parent" | "provider";
    displayName?: string;
  }) =>
    request<AuthResponse>("/v1/auth/google", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  loginWithApple: (body: {
    identityToken: string;
    role?: "parent" | "provider";
    displayName?: string;
  }) =>
    request<AuthResponse>("/v1/auth/apple", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) => request<AuthUser>("/v1/me", {}, token),

  deleteAccount: (token: string) =>
    request<{ ok: boolean }>("/v1/me", { method: "DELETE" }, token),

  getMyPosts: (token: string) =>
    request<{ posts: AuthoredPost[]; nextCursor: string | null }>(
      "/v1/me/posts",
      {},
      token
    ),

  updateAvatar: (token: string, avatarKey: string) =>
    request<{ avatarKey: string }>(
      "/v1/me/avatar",
      { method: "PATCH", body: JSON.stringify({ avatarKey }) },
      token
    ),

  getCurricula: () => request<Curriculum[]>("/v1/reference/curricula"),

  getPostalCountries: () =>
    request<PostalCountry[]>("/v1/reference/postal-countries"),

  lookupPinCode: (pinCode: string) =>
    request<PinCodeLookup>(`/v1/reference/pin-codes/${encodeURIComponent(pinCode)}`),

  lookupPostalCode: (countryCode: string, postalCode: string) =>
    request<PinCodeLookup>(
      `/v1/reference/postal-codes/${encodeURIComponent(countryCode)}/${encodeURIComponent(postalCode)}`
    ),

  getCommunitySuggestions: (
    token: string,
    params: { country?: string; pin: string }
  ) => {
    const search = new URLSearchParams({ pin: params.pin });
    if (params.country) search.set("country", params.country);
    return request<{ communities: string[] }>(
      `/v1/reference/communities?${search}`,
      {},
      token
    );
  },

  getSchoolManifest: () =>
    request<SchoolCatalogManifest>("/v1/reference/schools/manifest"),

  getSchoolCatalog: async (generation: number) => {
    const path = `/v1/reference/schools/catalog/v${generation}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const res = await fetch(`${API_URL}${path}`, { headers });
    const text = await res.text();
    if (!res.ok) {
      let data: unknown = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
      const message =
        typeof data === "object" &&
        data &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : `Request failed (${res.status})`;
      throw new ApiError(message, res.status, data);
    }
    return { text, etag: res.headers.get("etag") };
  },

  getSchoolShortlist: (params: {
    country?: string;
    pin: string;
    locality?: string;
    region?: string;
    list?: "preschool" | "school" | "preschool_campus";
  }) => {
    const search = new URLSearchParams({ pin: params.pin });
    if (params.country) search.set("country", params.country);
    if (params.locality) search.set("locality", params.locality);
    if (params.region) search.set("region", params.region);
    if (params.list) search.set("list", params.list);
    return request<SchoolListItem[]>(
      `/v1/reference/schools/shortlist?${search}`
    );
  },

  searchSchoolsPublic: (
    params: { q: string; limit?: number },
    options?: { signal?: AbortSignal }
  ) => {
    const search = new URLSearchParams({ q: params.q });
    if (params.limit) search.set("limit", String(params.limit));
    return request<SchoolListItem[]>(
      `/v1/reference/schools/search?${search}`,
      { signal: options?.signal }
    );
  },

  getChildren: (token: string) =>
    request<Child[]>("/v1/me/children", {}, token),

  getLocation: (token: string) =>
    request<Location | null>("/v1/me/location", {}, token),

  searchSchools: (
    token: string,
    params: {
      q: string;
      city?: string;
      pin?: string;
      sort?: "relevance" | "rating";
      limit?: number;
      list?: "preschool" | "school" | "preschool_campus";
    },
    options?: { signal?: AbortSignal }
  ) => {
    const search = new URLSearchParams({ q: params.q });
    if (params.city) search.set("city", params.city);
    if (params.pin) search.set("pin", params.pin);
    if (params.sort) search.set("sort", params.sort);
    if (params.limit) search.set("limit", String(params.limit));
    if (params.list) search.set("list", params.list);
    return request<SchoolListItem[]>(
      `/v1/schools/search?${search}`,
      { signal: options?.signal },
      token
    );
  },

  getNearbySchools: (
    token: string,
    params?: {
      city?: string;
      pin?: string;
      sort?: "nearby" | "rating";
      limit?: number;
    }
  ) => {
    const search = new URLSearchParams();
    if (params?.city) search.set("city", params.city);
    if (params?.pin) search.set("pin", params.pin);
    if (params?.sort) search.set("sort", params.sort);
    if (params?.limit) search.set("limit", String(params.limit));
    const query = search.toString();
    return request<SchoolListItem[]>(
      `/v1/schools/nearby${query ? `?${query}` : ""}`,
      {},
      token
    );
  },

  createSchool: (
    token: string,
    body: {
      name: string;
      branch?: string;
      city: string;
      state?: string;
      pinCode?: string;
      locality?: string;
      kind?: "preschool" | "school";
      offersPreschool?: boolean;
      confirmCreateToken?: string;
    },
    options?: { idempotencyKey?: string }
  ) =>
    request<School>(
      "/v1/schools",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "X-Vaara-School-Dedupe": "candidates-v1",
          ...(options?.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
        },
      },
      token
    ),

  addChild: (
    token: string,
    body: {
      nickname?: string;
      gender?: string;
      dateOfBirth?: string;
      track?: "school" | "preschool";
      ageYears?: number;
      curriculumId?: string;
      gradeId?: string;
      schoolId: string;
      onboardingAttemptId?: string;
    },
    options?: { idempotencyKey?: string }
  ) =>
    request<AddChildResult>(
      "/v1/me/children",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: options?.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : undefined,
      },
      token
    ),

  deleteChild: (token: string, childId: string) =>
    request<{ ok: boolean }>(`/v1/me/children/${childId}`, {
      method: "DELETE",
    }, token),

  updateChild: (
    token: string,
    childId: string,
    body: {
      nickname?: string | null;
      gender?: string;
      dateOfBirth?: string | null;
      track?: "school" | "preschool";
      ageYears?: number | null;
      curriculumId?: string | null;
      gradeId?: string | null;
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
      countryCode?: string;
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

  searchCircleDirectory: (
    token: string,
    params?: { q?: string; type?: string; limit?: number }
  ) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.type) qs.set("type", params.type);
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<{
      circles: CircleDirectoryItem[];
      guestQuota: GuestQuota;
    }>(`/v1/circles/directory${q ? `?${q}` : ""}`, {}, token);
  },

  createCrossPosts: (
    token: string,
    body: {
      body: string;
      tag?: string;
      targetCircleIds: string[];
      media?: Array<{
        storageKey: string;
        mediaType: "image" | "video";
        mimeType: string;
        width?: number;
        height?: number;
        durationMs?: number;
      }>;
      documents?: Array<{
        storageKey: string;
        fileName: string;
        mimeType: string;
      }>;
      poll?: {
        question: string;
        options: string[];
        hideResultsUntilVote?: boolean;
        closesAt?: string;
      };
      topicSlugs?: string[];
    }
  ) =>
    request<CrossPostResult>("/v1/cross-posts", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  markCircleRead: (token: string, circleId: string) =>
    request<{ ok: boolean }>(
      `/v1/circles/${circleId}/mark-read`,
      { method: "POST" },
      token
    ),

  recordHomeFeedImpressions: (token: string, postIds: string[]) =>
    request<void>(
      "/v1/me/feed/impressions",
      {
        method: "POST",
        body: JSON.stringify({ postIds }),
      },
      token
    ),

  getHomeFeed: (
    token: string,
    params?: { cursor?: string; limit?: number }
  ) => {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<{ posts: HomeFeedPost[]; nextCursor: string | null }>(
      `/v1/me/feed${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  togglePostHelpful: (token: string, postId: string) =>
    request<{ helpful: boolean; helpfulCount: number }>(
      `/v1/me/posts/${postId}/helpful`,
      { method: "POST" },
      token
    ),

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
      poll?: {
        question: string;
        options: string[];
        hideResultsUntilVote?: boolean;
        closesAt?: string;
      };
      topicSlugs?: string[];
    }
  ) =>
    request<CirclePost>(`/v1/circles/${circleId}/posts`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  updatePost: (
    token: string,
    circleId: string,
    postId: string,
    body: {
      body?: string;
      tag?: string;
      media?: Array<{
        id?: string;
        storageKey?: string;
        mediaType?: "image" | "video";
        mimeType?: string;
        width?: number;
        height?: number;
        durationMs?: number;
      }>;
      documents?: Array<{
        id?: string;
        storageKey?: string;
        fileName?: string;
        mimeType?: string;
      }>;
      poll?: {
        question: string;
        options: string[];
      };
      topicSlugs?: string[];
    }
  ) =>
    request<CirclePost>(`/v1/circles/${circleId}/posts/${postId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  votePoll: (
    token: string,
    circleId: string,
    postId: string,
    optionId: string
  ) =>
    request<{ poll: PollView | null }>(
      `/v1/circles/${circleId}/posts/${postId}/vote`,
      { method: "POST", body: JSON.stringify({ optionId }) },
      token
    ),

  withdrawPollVote: (token: string, circleId: string, postId: string) =>
    request<{ poll: PollView | null }>(
      `/v1/circles/${circleId}/posts/${postId}/vote`,
      { method: "DELETE" },
      token
    ),

  getMediaStatus: (token: string) =>
    request<{ configured: boolean }>("/v1/media/status", {}, token),

  createMediaUpload: (
    token: string,
    body: {
      fileName: string;
      mediaType: "image" | "video" | "document";
      mimeType: string;
      sizeBytes: number;
      purpose?: "post" | "listing";
    }
  ) =>
    request<{
      storageKey: string;
      uploadUrl: string;
      publicUrl?: string;
      expiresInSeconds: number;
    }>(
      "/v1/media/upload-url",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  verifyDocument: (
    token: string,
    body: { storageKey: string; fileName: string; mimeType: string }
  ) =>
    request<{
      status: "scanning" | "clean";
      storageKey: string;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
    }>(
      "/v1/media/documents/verify",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  getDocumentStatus: (token: string, storageKey: string) =>
    request<{
      status: "scanning" | "clean" | "blocked" | "failed";
      storageKey?: string;
      fileName?: string;
      sizeBytes?: number;
      mimeType?: string;
      reason?: string;
    }>(
      `/v1/media/documents/status?storageKey=${encodeURIComponent(storageKey)}`,
      {},
      token
    ),

  getDocumentDownloadUrl: (token: string, mediaId: string) =>
    request<{ downloadUrl: string; expiresInSeconds: number }>(
      `/v1/media/${mediaId}/download`,
      {},
      token
    ),

  getPost: (
    token: string,
    circleId: string,
    postId: string,
    shareId?: string
  ) => {
    const qs = shareId ? `?shareId=${encodeURIComponent(shareId)}` : "";
    return request<{
      post: CirclePost & { readOnly?: boolean; discovery?: boolean };
      replies: PostComment[];
      readOnly?: boolean;
      accessState?: ThreadAccessState;
      capabilities?: ThreadCapabilities;
    }>(`/v1/circles/${circleId}/posts/${postId}${qs}`, {}, token);
  },

  createPostShare: (token: string, circleId: string, postId: string) =>
    request<{ shareId: string; url: string; expiresAt: string }>(
      `/v1/circles/${circleId}/posts/${postId}/shares`,
      { method: "POST" },
      token
    ),

  resolveShare: (token: string | null, shareId: string) =>
    request<{
      available: boolean;
      shareId?: string;
      circleId?: string;
      postId?: string;
      threadId?: string | null;
      access?: string;
      url?: string;
    }>(`/v1/shares/${shareId}`, {}, token ?? undefined),

  addReply: (
    token: string,
    circleId: string,
    postId: string,
    body: string
  ) =>
    request<PostComment>(`/v1/circles/${circleId}/posts/${postId}/replies`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }, token),

  deletePost: (token: string, circleId: string, postId: string) =>
    request<{ ok: boolean }>(
      `/v1/circles/${circleId}/posts/${postId}`,
      { method: "DELETE" },
      token
    ),

  reportPost: (
    token: string,
    circleId: string,
    postId: string,
    reason: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/circles/${circleId}/posts/${postId}/report`,
      { method: "POST", body: JSON.stringify({ reason }) },
      token
    ),

  getConversations: (token: string) =>
    request<ConversationPreview[]>("/v1/conversations", {}, token),

  getMessageSuggestions: (token: string, q?: string) => {
    const search = new URLSearchParams();
    if (q?.trim()) search.set("q", q.trim());
    const query = search.toString();
    return request<MessageableParent[]>(
      `/v1/conversations/suggestions${query ? `?${query}` : ""}`,
      {},
      token
    );
  },

  getConnectionRequests: (token: string) =>
    request<{
      incoming: ParentConnectionRequest[];
      outgoing: ParentConnectionRequest[];
    }>("/v1/conversations/requests", {}, token),

  requestParentConnection: (
    token: string,
    body: { anonymousHandle: string; introduction?: string }
  ) =>
    request<
      | {
          kind: "conversation";
          conversation: { id: string; peer: PeerView };
        }
      | { kind: "request"; request: ParentConnectionRequest }
    >(
      "/v1/conversations/requests",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  respondToConnectionRequest: (
    token: string,
    requestId: string,
    action: "accept" | "decline" | "cancel"
  ) =>
    request<{
      ok: boolean;
      status: "accepted" | "declined" | "cancelled";
      conversationId: string | null;
    }>(
      `/v1/conversations/requests/${requestId}`,
      { method: "PATCH", body: JSON.stringify({ action }) },
      token
    ),

  reportConnectionRequest: (
    token: string,
    requestId: string,
    reason?: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/conversations/requests/${requestId}/report`,
      { method: "POST", body: JSON.stringify({ reason }) },
      token
    ),

  startConversation: (
    token: string,
    body: {
      peerUserId: string;
      circleId?: string;
      postId?: string;
      threadId?: string;
      listingId?: string;
      myRole?: "parent" | "provider";
      peerRole?: "parent" | "provider";
    }
  ) =>
    request<{ id: string; peer: PeerView }>(
      "/v1/conversations",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  getMessages: (token: string, conversationId: string) =>
    request<{
      peer: PeerView;
      messages: DirectMessage[];
    }>(`/v1/conversations/${conversationId}/messages`, {}, token),

  getDisclosure: (token: string, conversationId: string) =>
    request<DisclosureState>(
      `/v1/conversations/${conversationId}/disclosure`,
      {},
      token
    ),

  offerDisclosure: (
    token: string,
    conversationId: string,
    body: { level: number; purpose?: string }
  ) =>
    request<
      DisclosureState & {
        effectiveLevel: number;
        ownOffer: number;
        peerOffer: number;
      }
    >(
      `/v1/conversations/${conversationId}/disclosure`,
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  getContactDetails: (token: string) =>
    request<ContactDetails | null>("/v1/me/contact-details", {}, token),

  updateContactDetails: (
    token: string,
    body: Partial<ContactDetails>
  ) =>
    request<{ ok: boolean }>(
      "/v1/me/contact-details",
      { method: "PUT", body: JSON.stringify(body) },
      token
    ),

  getSaved: (token: string) =>
    request<{ posts: SavedPost[]; activities: unknown[]; listings: unknown[] }>(
      "/v1/me/saved",
      {},
      token
    ),

  saveItem: (token: string, body: { itemType: string; itemId: string }) =>
    request<{ ok: boolean }>(
      "/v1/me/saved",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  unsaveItem: (token: string, itemType: string, itemId: string) =>
    request<{ ok: boolean }>(`/v1/me/saved/${itemType}/${itemId}`, {
      method: "DELETE",
    }, token),

  sendMessage: (token: string, conversationId: string, body: string) =>
    request<DirectMessage>(
      `/v1/conversations/${conversationId}/messages`,
      { method: "POST", body: JSON.stringify({ body }) },
      token
    ),

  reportConversation: (
    token: string,
    conversationId: string,
    reason?: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/conversations/${conversationId}/report`,
      { method: "POST", body: JSON.stringify({ reason }) },
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

  reportUser: (token: string, targetUserId: string, reason?: string) =>
    request<{ ok: boolean }>("/v1/me/reports", {
      method: "POST",
      body: JSON.stringify({ targetUserId, reason }),
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
      category: ActivityCategory;
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
    params?: {
      pin?: string;
      curriculum?: string;
      q?: string;
      providerType?: "teacher" | "trainer" | "institution";
      category?: ActivityCategory;
      verifiedOnly?: boolean;
      sort?: "recent" | "rating" | "fee_low";
    }
  ) => {
    const qs = new URLSearchParams();
    if (params?.pin) qs.set("pin", params.pin);
    if (params?.curriculum) qs.set("curriculum", params.curriculum);
    if (params?.q) qs.set("q", params.q);
    if (params?.providerType) qs.set("providerType", params.providerType);
    if (params?.category) qs.set("category", params.category);
    if (params?.verifiedOnly) qs.set("verifiedOnly", "true");
    if (params?.sort) qs.set("sort", params.sort);
    const q = qs.toString();
    return request<Activity[]>(
      `/v1/activities${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  getProviderReviews: (token: string, providerId: string) =>
    request<{
      provider: {
        id: string;
        orgName: string;
        verified: boolean;
        ratingAvg: number | null;
        ratingCount: number;
        feeMin: number | null;
        feeMax: number | null;
      };
      reviews: ProviderReview[];
    }>(`/v1/providers/${providerId}/reviews`, {}, token),

  submitProviderReview: (
    token: string,
    providerId: string,
    body: { rating: number; reviewBody?: string }
  ) =>
    request<{ ok: boolean }>(`/v1/providers/${providerId}/reviews`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  getActivity: (token: string, activityId: string) =>
    request<Activity>(`/v1/activities/${activityId}`, {}, token),

  registerPushToken: (token: string, pushToken: string) =>
    request<{ ok: boolean }>("/v1/me/push-token", {
      method: "POST",
      body: JSON.stringify({ pushToken }),
    }, token),

  getMeStats: (token: string) =>
    request<MeStats>("/v1/me/stats", {}, token),

  getNotificationPrefs: (token: string) =>
    request<NotificationPrefs>("/v1/me/notification-prefs", {}, token),

  updateNotificationPrefs: (token: string, prefs: NotificationPrefs) =>
    request<NotificationPrefs>("/v1/me/notification-prefs", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    }, token),

  getNotificationMutes: (token: string) =>
    request<{ mutes: NotificationMute[] }>("/v1/me/notification-mutes", {}, token),

  muteNotifications: (
    token: string,
    body: { scope: NotificationMute["scope"]; scopeId: string }
  ) =>
    request<{ ok: boolean }>("/v1/me/notification-mutes", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  unmuteNotifications: (
    token: string,
    scope: NotificationMute["scope"],
    scopeId: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/me/notification-mutes/${scope}/${scopeId}`,
      { method: "DELETE" },
      token
    ),

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

  discoverListings: (
    token: string,
    params?: {
      scope?: "community" | "pin";
      category?: string;
      kind?: string;
      q?: string;
    }
  ) => {
    const qs = new URLSearchParams();
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.category) qs.set("category", params.category);
    if (params?.kind) qs.set("kind", params.kind);
    if (params?.q) qs.set("q", params.q);
    const q = qs.toString();
    return request<Listing[]>(`/v1/listings${q ? `?${q}` : ""}`, {}, token);
  },

  getMyListings: (token: string) =>
    request<Listing[]>("/v1/listings/mine", {}, token),

  getListing: (token: string, listingId: string) =>
    request<Listing>(`/v1/listings/${listingId}`, {}, token),

  createListing: (
    token: string,
    body: {
      kind: string;
      category: string;
      title: string;
      description?: string;
      priceAmount?: number;
      schoolId?: string;
      gradeId?: string;
      media?: Array<{
        storageKey: string;
        mimeType: string;
        width?: number;
        height?: number;
      }>;
    }
  ) =>
    request<Listing>("/v1/listings", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  updateListing: (
    token: string,
    listingId: string,
    body: { status?: string; title?: string; description?: string }
  ) =>
    request<Listing>(`/v1/listings/${listingId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  expressListingInterest: (token: string, listingId: string) =>
    request<{ conversationId: string; peer: PeerView }>(
      `/v1/listings/${listingId}/interest`,
      { method: "POST" },
      token
    ),

  getSchoolProfile: (token: string, schoolId: string) =>
    request<SchoolProfile>(`/v1/schools/${schoolId}/profile`, {}, token),

  getSchoolReviews: (token: string, schoolId: string) =>
    request<{ reviews: SchoolReview[] }>(
      `/v1/schools/${schoolId}/reviews`,
      {},
      token
    ),

  submitSchoolReview: (
    token: string,
    schoolId: string,
    body: { rating: number; reviewBody?: string }
  ) =>
    request<{ ok: boolean }>(`/v1/schools/${schoolId}/reviews`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  getSchoolFees: (token: string, schoolId: string, year?: string) => {
    const qs = year ? `?year=${encodeURIComponent(year)}` : "";
    return request<{
      current: {
        min: number;
        max: number;
        reportedCount: number;
        latestReportedAt: string | null;
        academicYear: string;
      } | null;
      history: Array<Record<string, unknown>>;
    }>(`/v1/schools/${schoolId}/fees${qs}`, {}, token);
  },

  askSchoolQuestion: (token: string, schoolId: string, body: string) =>
    request<{
      id: string;
      createdAt: string;
      circleId: string;
      threadId?: string;
      postId?: string | null;
    }>(
      `/v1/schools/${schoolId}/questions`,
      { method: "POST", body: JSON.stringify({ body }) },
      token
    ),

  getTopicsCatalog: (token: string) =>
    request<{ categories: Record<string, TopicCatalogItem[]> }>(
      "/v1/topics",
      {},
      token
    ),

  getTopicFeed: (
    token: string,
    slug: string,
    params?: { cursor?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set("cursor", params.cursor);
    const q = qs.toString();
    return request<{ posts: CirclePost[]; nextCursor: string | null }>(
      `/v1/topics/${slug}/feed${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  followTopic: (token: string, slug: string) =>
    request<{ ok: boolean }>(`/v1/topics/${slug}/follow`, { method: "POST" }, token),

  unfollowTopic: (token: string, slug: string) =>
    request<{ ok: boolean }>(`/v1/topics/${slug}/follow`, { method: "DELETE" }, token),

  getFollowedTopics: (token: string) =>
    request<TopicCatalogItem[]>("/v1/me/topics", {}, token),

  getUpcomingSchoolEvents: (token: string) =>
    request<SchoolEvent[]>("/v1/me/school-events/upcoming", {}, token),

  getSchoolEvents: (
    token: string,
    schoolId: string,
    params?: { from?: string; to?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return request<SchoolEvent[]>(
      `/v1/schools/${schoolId}/events${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  reportSchoolEvent: (
    token: string,
    schoolId: string,
    body: {
      title: string;
      eventType: string;
      startsAt: string;
      description?: string;
    }
  ) =>
    request<{ id: string }>(`/v1/schools/${schoolId}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  flagSchoolEvent: (
    token: string,
    eventId: string,
    body: { flag: "confirm" | "dispute"; note?: string }
  ) =>
    request<{ ok: boolean }>(`/v1/school-events/${eventId}/flag`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  remindSchoolEvent: (token: string, eventId: string, fireAt: string) =>
    request<Reminder>(`/v1/school-events/${eventId}/remind`, {
      method: "POST",
      body: JSON.stringify({ fireAt }),
    }, token),

  discoverPractitioners: (
    token: string,
    params?: { category?: string; pin?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.pin) qs.set("pin", params.pin);
    const q = qs.toString();
    return request<Practitioner[]>(
      `/v1/practitioners${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  getPractitioner: (token: string, id: string) =>
    request<
      Practitioner & {
        disclaimer: string;
        recommendations: Array<{
          id: string;
          note: string | null;
          waitTimeBand: string | null;
          feeBand: string | null;
          author: { anonymousHandle: string; contextLabel: string };
        }>;
      }
    >(`/v1/practitioners/${id}`, {}, token),

  recommendPractitioner: (
    token: string,
    id: string,
    body: { note?: string; waitTimeBand?: string; feeBand?: string }
  ) =>
    request<{ ok: boolean }>(`/v1/practitioners/${id}/recommend`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  getExpertSessions: (token: string) =>
    request<ExpertSession[]>("/v1/expert-sessions", {}, token),

  getExpertSession: (token: string, id: string) =>
    request<
      ExpertSession & {
        expert: ExpertSession["expert"] & { bio?: string | null };
        questions: Array<{
          id: string;
          body: string;
          upvoteCount: number;
          answerBody: string | null;
          askerHandle: string;
        }>;
      }
    >(`/v1/expert-sessions/${id}`, {}, token),

  askExpertQuestion: (token: string, sessionId: string, body: string) =>
    request<{ id: string }>(`/v1/expert-sessions/${sessionId}/questions`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }, token),

  upvoteExpertQuestion: (token: string, questionId: string) =>
    request<{ ok: boolean }>(
      `/v1/expert-sessions/questions/${questionId}/upvote`,
      { method: "POST" },
      token
    ),

  getPlaydateMatches: (token: string) =>
    request<{
      available: boolean;
      reason?: string;
      count?: number;
      ageBand?: string;
      matches?: PlaydateMatch[];
    }>("/v1/playdates/matches", {}, token),

  optInPlaydate: (
    token: string,
    body: { childId: string; ageBand: string; scope: "community" | "pin" }
  ) =>
    request<{ ok: boolean }>("/v1/playdates/optin", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  connectPlaydate: (token: string, peerUserId: string) =>
    request<{ conversationId: string; peer: { userId: string; anonymousHandle: string } }>(
      "/v1/playdates/connect",
      { method: "POST", body: JSON.stringify({ peerUserId }) },
      token
    ),

  getCarpoolMatches: (token: string) =>
    request<CarpoolOffer[]>("/v1/carpool/matches", {}, token),

  createCarpoolOffer: (
    token: string,
    body: {
      role: string;
      direction: string;
      daysOfWeek: number[];
      departureTime: string;
      seats?: number;
      notes?: string;
    }
  ) =>
    request<{ id: string }>("/v1/carpool/offers", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  createCarpoolArrangement: (
    token: string,
    body: {
      daysOfWeek: number[];
      departureTime: string;
      offerIds?: string[];
    }
  ) =>
    request<{ id: string }>("/v1/carpool/arrangements", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  joinCarpoolArrangement: (
    token: string,
    arrangementId: string,
    role?: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/carpool/arrangements/${arrangementId}/join`,
      { method: "POST", body: JSON.stringify({ role }) },
      token
    ),

  getCarpoolArrangement: (token: string, arrangementId: string) =>
    request<CarpoolArrangement>(
      `/v1/carpool/arrangements/${arrangementId}`,
      {},
      token
    ),

  confirmCarpoolDisclosure: (token: string, arrangementId: string) =>
    request<{ ok: boolean }>(
      `/v1/carpool/arrangements/${arrangementId}/confirm-disclosure`,
      { method: "POST" },
      token
    ),

  activateCarpool: (token: string, arrangementId: string) =>
    request<{ ok: boolean }>(
      `/v1/carpool/arrangements/${arrangementId}/activate`,
      { method: "POST" },
      token
    ),

  leaveCarpool: (
    token: string,
    arrangementId: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/carpool/arrangements/${arrangementId}/leave`,
      { method: "POST" },
      token
    ),

  getChatInbox: (token: string) =>
    request<ChatInbox>("/v1/chat/inbox", {}, token),

  getChatHome: (
    token: string,
    query?: { cursor?: string; limit?: number }
  ) => {
    const search = new URLSearchParams();
    if (query?.cursor) search.set("cursor", query.cursor);
    if (query?.limit != null) search.set("limit", String(query.limit));
    const q = search.toString();
    return request<{ items: ChatHomeItem[]; nextCursor: string | null }>(
      `/v1/chat/home${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  recordChatHomeImpressions: (
    token: string,
    body: { threadIds?: string[]; updateIds?: string[] }
  ) =>
    request<{ ok: boolean }>(
      "/v1/chat/home/impressions",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  getGroupMessages: (
    token: string,
    circleId: string,
    query?: { afterSeq?: number; beforeSeq?: number }
  ) => {
    const search = new URLSearchParams();
    if (query?.afterSeq != null) search.set("afterSeq", String(query.afterSeq));
    if (query?.beforeSeq != null) search.set("beforeSeq", String(query.beforeSeq));
    const q = search.toString();
    return request<{ messages: ChatMessage[]; nextCursor: number | null }>(
      `/v1/circles/${circleId}/messages${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  sendGroupMessage: (
    token: string,
    circleId: string,
    body: { body: string; clientMessageId?: string; replyToMessageId?: string }
  ) =>
    request<ChatMessage>(
      `/v1/circles/${circleId}/messages`,
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  ensureMessageThread: (token: string, circleId: string, messageId: string) =>
    request<{ threadId: string; created: boolean }>(
      `/v1/circles/${circleId}/messages/${messageId}/thread`,
      { method: "POST", body: JSON.stringify({}) },
      token
    ),

  markGroupChatRead: (
    token: string,
    circleId: string,
    body: { lastReadMessageSeq?: number; lastSeenThreadSeq?: number }
  ) =>
    request<{ ok: boolean }>(
      `/v1/circles/${circleId}/chat-read`,
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  getGroupThreads: (token: string, circleId: string, scope?: string) => {
    const search = new URLSearchParams();
    if (scope) search.set("scope", scope);
    const q = search.toString();
    return request<{
      linear: boolean;
      threads: Array<{
        id: string;
        title: string | null;
        body: string | null;
        kind: string;
        replyCount: number;
        lastMessageAt: string;
        following: boolean;
        unread: boolean;
      }>;
    }>(`/v1/circles/${circleId}/threads${q ? `?${q}` : ""}`, {}, token);
  },

  getThread: (token: string, threadId: string) =>
    request<{
      id: string;
      circleId: string;
      circleName: string;
      circleType: string;
      title: string | null;
      body: string | null;
      kind: string;
      status: string;
      replyCount: number;
      lastMessageAt: string;
      lastActivitySeq?: number;
      serviceRepliesAllowed: boolean;
      muted?: boolean;
      access: {
        canReply: boolean;
        canOpenGroup: boolean;
        canMessageAuthor?: boolean;
        grantRole: string | null;
        discovery?: boolean;
      };
    }>(`/v1/threads/${threadId}`, {}, token),

  getThreadMessages: (
    token: string,
    threadId: string,
    query?: { afterSeq?: number; beforeSeq?: number }
  ) => {
    const search = new URLSearchParams();
    if (query?.afterSeq != null) search.set("afterSeq", String(query.afterSeq));
    if (query?.beforeSeq != null) search.set("beforeSeq", String(query.beforeSeq));
    const q = search.toString();
    return request<{ messages: ChatMessage[]; nextCursor: number | null }>(
      `/v1/threads/${threadId}/messages${q ? `?${q}` : ""}`,
      {},
      token
    );
  },

  sendThreadMessage: (
    token: string,
    threadId: string,
    body: { body: string; clientMessageId?: string; asProvider?: boolean }
  ) =>
    request<ChatMessage>(
      `/v1/threads/${threadId}/messages`,
      { method: "POST", body: JSON.stringify(body) },
      token
    ),

  markThreadRead: (token: string, threadId: string, lastReadSeq?: number) =>
    request<{ ok: boolean }>(
      `/v1/threads/${threadId}/read`,
      { method: "POST", body: JSON.stringify({ lastReadSeq }) },
      token
    ),

  muteThread: (token: string, threadId: string) =>
    request<{ ok: boolean; muted: boolean }>(
      `/v1/threads/${threadId}/mute`,
      { method: "POST" },
      token
    ),

  unmuteThread: (token: string, threadId: string) =>
    request<{ ok: boolean; muted: boolean }>(
      `/v1/threads/${threadId}/mute`,
      { method: "DELETE" },
      token
    ),

  editCircleMessage: (
    token: string,
    circleId: string,
    messageId: string,
    body: string
  ) =>
    request<ChatMessage>(
      `/v1/circles/${circleId}/messages/${messageId}`,
      { method: "PATCH", body: JSON.stringify({ body }) },
      token
    ),

  deleteCircleMessage: (
    token: string,
    circleId: string,
    messageId: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/circles/${circleId}/messages/${messageId}`,
      { method: "DELETE" },
      token
    ),

  addMessageReaction: (
    token: string,
    circleId: string,
    messageId: string,
    reaction: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/circles/${circleId}/messages/${messageId}/reactions`,
      { method: "POST", body: JSON.stringify({ reaction }) },
      token
    ),

  removeMessageReaction: (
    token: string,
    circleId: string,
    messageId: string,
    reaction: string
  ) =>
    request<{ ok: boolean }>(
      `/v1/circles/${circleId}/messages/${messageId}/reactions?reaction=${encodeURIComponent(reaction)}`,
      { method: "DELETE" },
      token
    ),

  followThread: (token: string, threadId: string) =>
    request<{ ok: boolean }>(
      `/v1/threads/${threadId}/follow`,
      { method: "POST" },
      token
    ),

  messageThreadAuthor: (token: string, threadId: string) =>
    request<{ conversationId?: string; kind?: string }>(
      `/v1/threads/${threadId}/message-author`,
      { method: "POST" },
      token
    ),

  getProviderChannel: (token: string, providerId: string) =>
    request<{
      providerId: string;
      name: string;
      status: string;
      updates: Array<{
        id: string;
        title: string;
        preview: string | null;
        published_at: string | null;
      }>;
    }>(`/v1/provider-channels/${providerId}`, {}, token),

  followProviderChannel: (token: string, providerId: string) =>
    request<{ ok: boolean }>(
      `/v1/provider-channels/${providerId}/follow`,
      { method: "POST" },
      token
    ),

  getMatchedThreads: (token: string) =>
    request<{
      threads: Array<{
        id: string;
        title: string | null;
        body: string | null;
        circleName: string;
        lastMessageAt: string;
      }>;
    }>("/v1/chat/matched-threads", {}, token),

  openProviderThread: (token: string, threadId: string) =>
    request<{ ok: boolean }>(
      `/v1/threads/${threadId}/provider-open`,
      { method: "POST" },
      token
    ),
};

export function peerDisplayName(peer: PeerView): string {
  if (peer.disclosureLevel >= 2 && peer.firstName) {
    const flat = peer.blockOrFlat ? ` · ${peer.blockOrFlat}` : "";
    return `${peer.firstName}${flat}`;
  }
  return peer.anonymousHandle;
}
