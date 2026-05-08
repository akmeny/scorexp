import type { AuthStatus, ChatMessage, ChatRoomSnapshot, HighlightsSnapshot, MatchDetail, ScoreboardSnapshot, ScoreboardView, UserProfile } from "../types";

const fallbackProductionApi = "https://scorexp-api.onrender.com";
const fallbackLocalApi = "http://localhost:4000";
const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiBase = resolveApiBase(configuredBase);

export function getApiBaseUrl() {
  return apiBase;
}

export interface FetchScoreboardOptions {
  date: string;
  timezone: string;
  view: ScoreboardView;
  etag?: string | null;
  signal?: AbortSignal;
}

export interface FetchScoreboardResult {
  snapshot: ScoreboardSnapshot | null;
  etag: string | null;
  notModified: boolean;
}

export interface FetchMatchDetailOptions {
  matchId: string;
  timezone: string;
  etag?: string | null;
  signal?: AbortSignal;
}

export interface FetchMatchDetailResult {
  detail: MatchDetail | null;
  etag: string | null;
  notModified: boolean;
}

export interface FetchHighlightsOptions {
  date: string;
  timezone: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface FetchChatMessagesOptions {
  matchId: string;
  signal?: AbortSignal;
}

export interface SendChatMessageOptions {
  matchId: string;
  authorId: string;
  nickname: string;
  color: string;
  body: string;
  accessToken?: string | null;
  signal?: AbortSignal;
}

export interface UpdateUserProfileOptions {
  accessToken: string;
  nickname?: string;
  notificationsEnabled?: boolean;
  notificationPermission?: UserProfile["notificationPermission"];
  signal?: AbortSignal;
}

export interface NotificationPublicKeyResponse {
  enabled: boolean;
  publicKey: string | null;
}

export interface SerializedPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export async function fetchAuthStatus(signal?: AbortSignal): Promise<AuthStatus> {
  const response = await fetch(new URL("/api/v1/auth/status", apiBase), {
    signal,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Auth status request failed (${response.status})`);
  }

  return (await response.json()) as AuthStatus;
}

export async function fetchScoreboard(options: FetchScoreboardOptions): Promise<FetchScoreboardResult> {
  const url = new URL("/api/v1/football/scoreboard", apiBase);
  url.searchParams.set("date", options.date);
  url.searchParams.set("timezone", options.timezone);
  url.searchParams.set("view", options.view);

  const response = await fetch(url, {
    signal: options.signal,
    headers: options.etag ? { "If-None-Match": options.etag } : undefined
  });

  if (response.status === 304) {
    return {
      snapshot: null,
      etag: options.etag ?? null,
      notModified: true
    };
  }

  if (!response.ok) {
    throw new Error(`Scoreboard request failed (${response.status})`);
  }

  return {
    snapshot: (await response.json()) as ScoreboardSnapshot,
    etag: response.headers.get("ETag"),
    notModified: false
  };
}

export async function fetchMatchDetail(options: FetchMatchDetailOptions): Promise<FetchMatchDetailResult> {
  const url = new URL(`/api/v1/football/matches/${encodeURIComponent(options.matchId)}/detail`, apiBase);
  url.searchParams.set("timezone", options.timezone);

  const response = await fetch(url, {
    signal: options.signal,
    headers: options.etag ? { "If-None-Match": options.etag } : undefined
  });

  if (response.status === 304) {
    return {
      detail: null,
      etag: options.etag ?? null,
      notModified: true
    };
  }

  if (!response.ok) {
    throw new Error(`Match detail request failed (${response.status})`);
  }

  return {
    detail: (await response.json()) as MatchDetail,
    etag: response.headers.get("ETag"),
    notModified: false
  };
}

export async function fetchHighlights(options: FetchHighlightsOptions): Promise<HighlightsSnapshot> {
  const url = new URL("/api/v1/football/highlights", apiBase);
  url.searchParams.set("date", options.date);
  url.searchParams.set("timezone", options.timezone);
  url.searchParams.set("limit", String(options.limit ?? 20));
  url.searchParams.set("offset", String(options.offset ?? 0));

  const response = await fetch(url, { signal: options.signal, cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Highlights request failed (${response.status})`);
  }

  return (await response.json()) as HighlightsSnapshot;
}

export async function fetchChatMessages(options: FetchChatMessagesOptions): Promise<ChatRoomSnapshot> {
  const url = new URL(`/api/v1/chat/rooms/${encodeURIComponent(options.matchId)}/messages`, apiBase);

  const response = await fetch(url, {
    signal: options.signal,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Chat messages request failed (${response.status})`);
  }

  return (await response.json()) as ChatRoomSnapshot;
}

export async function sendChatMessage(options: SendChatMessageOptions): Promise<ChatMessage> {
  const url = new URL(`/api/v1/chat/rooms/${encodeURIComponent(options.matchId)}/messages`, apiBase);

  const response = await fetch(url, {
    method: "POST",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
    },
    body: JSON.stringify({
      authorId: options.authorId,
      nickname: options.nickname,
      color: options.color,
      body: options.body
    })
  });

  if (!response.ok) {
    throw new Error(`Send chat message failed (${response.status})`);
  }

  const payload = (await response.json()) as { message: ChatMessage };
  return payload.message;
}

export function chatEventsUrl(matchId: string) {
  return new URL(`/api/v1/chat/rooms/${encodeURIComponent(matchId)}/events`, apiBase).toString();
}

export async function fetchUserProfile(accessToken: string, signal?: AbortSignal): Promise<UserProfile> {
  const response = await fetch(new URL("/api/v1/me", apiBase), {
    signal,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`User profile request failed (${response.status})`);
  }

  const payload = (await response.json()) as { profile: UserProfile };
  return payload.profile;
}

export async function updateUserProfile(options: UpdateUserProfileOptions): Promise<UserProfile> {
  const response = await fetch(new URL("/api/v1/me", apiBase), {
    method: "PATCH",
    signal: options.signal,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      nickname: options.nickname,
      notificationsEnabled: options.notificationsEnabled,
      notificationPermission: options.notificationPermission
    })
  });

  if (!response.ok) {
    throw new Error(`Update user profile failed (${response.status})`);
  }

  const payload = (await response.json()) as { profile: UserProfile };
  return payload.profile;
}

export async function fetchNotificationPublicKey(signal?: AbortSignal): Promise<NotificationPublicKeyResponse> {
  const response = await fetch(new URL("/api/v1/notifications/vapid-public-key", apiBase), {
    signal,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Notification public key request failed (${response.status})`);
  }

  return (await response.json()) as NotificationPublicKeyResponse;
}

export async function registerPushSubscription(options: {
  accessToken?: string | null;
  deviceId?: string | null;
  subscription: SerializedPushSubscription;
  signal?: AbortSignal;
}): Promise<void> {
  const response = await fetch(new URL("/api/v1/notifications/subscription", apiBase), {
    method: "PUT",
    signal: options.signal,
    cache: "no-store",
    headers: notificationIdentityHeaders(options.accessToken, options.deviceId),
    body: JSON.stringify(options.subscription)
  });

  if (!response.ok) {
    throw new Error(`Register push subscription failed (${response.status})`);
  }
}

export async function unregisterPushSubscription(options: {
  accessToken?: string | null;
  deviceId?: string | null;
  endpoint: string;
  signal?: AbortSignal;
}): Promise<void> {
  const response = await fetch(new URL("/api/v1/notifications/subscription", apiBase), {
    method: "DELETE",
    signal: options.signal,
    cache: "no-store",
    headers: notificationIdentityHeaders(options.accessToken, options.deviceId),
    body: JSON.stringify({ endpoint: options.endpoint })
  });

  if (!response.ok) {
    throw new Error(`Unregister push subscription failed (${response.status})`);
  }
}

export async function syncFavoriteNotifications(options: {
  accessToken?: string | null;
  deviceId?: string | null;
  favoriteIds: string[];
  signal?: AbortSignal;
}): Promise<void> {
  const response = await fetch(new URL("/api/v1/notifications/favorites", apiBase), {
    method: "PUT",
    signal: options.signal,
    cache: "no-store",
    headers: notificationIdentityHeaders(options.accessToken, options.deviceId),
    body: JSON.stringify({ favoriteIds: options.favoriteIds })
  });

  if (!response.ok) {
    throw new Error(`Sync favorite notifications failed (${response.status})`);
  }
}

function notificationIdentityHeaders(accessToken?: string | null, deviceId?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (deviceId) {
    headers["X-ScoreXP-Device-Id"] = deviceId;
  }

  return headers;
}

function resolveApiBase(value: string | undefined) {
  const configured = value?.trim();

  if (configured && (!isLocalOnlyUrl(configured) || isBrowserOnLocalhost())) {
    return configured;
  }

  if (isBrowserOnLocalhost()) {
    return fallbackLocalApi;
  }

  return fallbackProductionApi;
}

function isBrowserOnLocalhost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function isLocalOnlyUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}
