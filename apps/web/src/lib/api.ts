import type { HighlightsSnapshot, MatchDetail, ScoreboardSnapshot, ScoreboardView } from "../types";

const fallbackProductionApi = "https://scorexp-api.onrender.com";
const fallbackLocalApi = "http://localhost:4000";
const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiBase = resolveApiBase(configuredBase);

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

  const response = await fetch(url, { signal: options.signal });

  if (!response.ok) {
    throw new Error(`Highlights request failed (${response.status})`);
  }

  return (await response.json()) as HighlightsSnapshot;
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
