import type {
  MatchDetailResponse,
  MatchesSnapshotResponse,
  MatchesSnapshotViewModel,
} from "@/lib/types";

const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.scorexp.com"
    : "http://localhost:4000";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
  DEFAULT_API_BASE_URL;

export class BackendRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      next: {
        revalidate: 0,
      },
    });
  } catch (error) {
    throw new BackendRequestError(
      error instanceof Error ? error.message : "Backend is unreachable",
      null,
    );
  }

  if (!response.ok) {
    throw new BackendRequestError(
      `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function isLikelyBackendWakeup(error: unknown): boolean {
  if (!(error instanceof BackendRequestError)) {
    return false;
  }

  return (
    error.status === null ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504
  );
}

export function describeBackendError(error: unknown): string {
  if (isLikelyBackendWakeup(error)) {
    return "The backend is waking up. Live data will appear automatically once Render starts the service.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Backend is unavailable right now.";
}

export async function fetchLiveMatchesSnapshot(): Promise<MatchesSnapshotResponse> {
  return fetchJson<MatchesSnapshotResponse>("/api/matches/live");
}

export async function fetchLiveMatchesSnapshotSafe(): Promise<MatchesSnapshotViewModel> {
  try {
    const snapshot = await fetchLiveMatchesSnapshot();
    return {
      ...snapshot,
      error: null,
    };
  } catch (error) {
    return {
      matches: [],
      generatedAt: new Date().toISOString(),
      total: 0,
      error: describeBackendError(error),
    };
  }
}

export async function fetchMatchById(
  matchId: number,
): Promise<MatchDetailResponse | null> {
  try {
    return await fetchJson<MatchDetailResponse>(`/api/matches/${matchId}`);
  } catch {
    return null;
  }
}
