import type { ScoreboardSnapshot, ScoreboardView } from "../types";

const fallbackProductionApi = "https://scorexp-api.onrender.com";
const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiBase = (configuredBase && configuredBase.trim()) || fallbackProductionApi;

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
