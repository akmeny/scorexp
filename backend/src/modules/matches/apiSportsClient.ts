import type {
  ProviderApiEnvelope,
  ProviderFixtureEventResponse,
  ProviderFixtureLineupResponse,
  ProviderFixturePlayerStatisticResponse,
  ProviderFixtureStatisticsResponse,
  ProviderFixtureResponse,
  ProviderLeagueResponse,
  ProviderPredictionResponse,
  ProviderStandingsResponse,
  ProviderTeamStatisticsResponse,
} from "../../types/provider.js";

export interface RateLimitInfo {
  requestsLimit: number | null;
  requestsRemaining: number | null;
  retryAfterMs: number | null;
}

export interface ApiSportsRequestResult<T> {
  data: T[];
  rateLimit: RateLimitInfo;
}

export interface ApiSportsClientMetrics {
  requestCount: number;
  successfulRequestCount: number;
  failedRequestCount: number;
  liveRequests: number;
  todayFixtureRequests: number;
  fixtureByIdRequests: number;
  eventRequests: number;
  statisticsRequests: number;
  lineupRequests: number;
  playerRequests: number;
  h2hRequests: number;
  standingsRequests: number;
  teamStatisticsRequests: number;
  predictionRequests: number;
  leagueRequests: number;
  lastRequestAt: string | null;
}

interface ApiSportsClientOptions {
  apiKey: string;
  baseUrl: string;
  requestTimeoutMs: number;
}

type RequestKind =
  | "live"
  | "today"
  | "fixture"
  | "events"
  | "statistics"
  | "lineups"
  | "players"
  | "h2h"
  | "standings"
  | "teamStatistics"
  | "predictions"
  | "leagues";

export class ApiSportsError extends Error {
  readonly status: number;

  readonly rateLimit: RateLimitInfo;

  readonly retryAfterMs: number | null;

  constructor(
    message: string,
    status: number,
    rateLimit: RateLimitInfo,
    retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "ApiSportsError";
    this.status = status;
    this.rateLimit = rateLimit;
    this.retryAfterMs = retryAfterMs;
  }

  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

function parseNumericHeader(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRetryAfter(headerValue: string | null): number | null {
  const seconds = parseNumericHeader(headerValue);
  return seconds === null ? null : seconds * 1000;
}

function extractRateLimit(headers: Headers): RateLimitInfo {
  return {
    requestsLimit: parseNumericHeader(
      headers.get("x-ratelimit-requests-limit"),
    ),
    requestsRemaining: parseNumericHeader(
      headers.get("x-ratelimit-requests-remaining"),
    ),
    retryAfterMs: parseRetryAfter(headers.get("retry-after")),
  };
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== "object") {
    return `API-Sports request failed with status ${status}`;
  }

  const envelope = payload as ProviderApiEnvelope<unknown>;
  const errors = envelope.errors;

  if (Array.isArray(errors) && errors.length > 0) {
    return String(errors[0]);
  }

  if (errors && typeof errors === "object") {
    const firstValue = Object.values(errors)[0];
    if (firstValue) {
      return String(firstValue);
    }
  }

  return `API-Sports request failed with status ${status}`;
}

export class ApiSportsClient {
  private readonly metrics: ApiSportsClientMetrics = {
    requestCount: 0,
    successfulRequestCount: 0,
    failedRequestCount: 0,
    liveRequests: 0,
    todayFixtureRequests: 0,
    fixtureByIdRequests: 0,
    eventRequests: 0,
    statisticsRequests: 0,
    lineupRequests: 0,
    playerRequests: 0,
    h2hRequests: 0,
    standingsRequests: 0,
    teamStatisticsRequests: 0,
    predictionRequests: 0,
    leagueRequests: 0,
    lastRequestAt: null,
  };

  constructor(private readonly options: ApiSportsClientOptions) {}

  async getLiveFixtures(): Promise<ApiSportsRequestResult<ProviderFixtureResponse>> {
    return this.request<ProviderFixtureResponse>("live", "fixtures", {
      live: "all",
    });
  }

  async getFixturesByDate(
    date: string,
    timezone: string,
  ): Promise<ApiSportsRequestResult<ProviderFixtureResponse>> {
    return this.request<ProviderFixtureResponse>("today", "fixtures", {
      date,
      timezone,
    });
  }

  async getFixtureEvents(
    fixtureId: number,
  ): Promise<ApiSportsRequestResult<ProviderFixtureEventResponse>> {
    return this.request<ProviderFixtureEventResponse>("events", "fixtures/events", {
      fixture: fixtureId,
    });
  }

  async getFixtureById(
    fixtureId: number,
  ): Promise<ApiSportsRequestResult<ProviderFixtureResponse>> {
    return this.request<ProviderFixtureResponse>("fixture", "fixtures", {
      id: fixtureId,
    });
  }

  async getFixtureStatistics(
    fixtureId: number,
  ): Promise<ApiSportsRequestResult<ProviderFixtureStatisticsResponse>> {
    return this.request<ProviderFixtureStatisticsResponse>(
      "statistics",
      "fixtures/statistics",
      {
        fixture: fixtureId,
      },
    );
  }

  async getFixtureLineups(
    fixtureId: number,
  ): Promise<ApiSportsRequestResult<ProviderFixtureLineupResponse>> {
    return this.request<ProviderFixtureLineupResponse>("lineups", "fixtures/lineups", {
      fixture: fixtureId,
    });
  }

  async getFixturePlayers(
    fixtureId: number,
  ): Promise<ApiSportsRequestResult<ProviderFixturePlayerStatisticResponse>> {
    return this.request<ProviderFixturePlayerStatisticResponse>("players", "fixtures/players", {
      fixture: fixtureId,
    });
  }

  async getFixturesHeadToHead(
    homeTeamId: number,
    awayTeamId: number,
    last = 10,
  ): Promise<ApiSportsRequestResult<ProviderFixtureResponse>> {
    return this.request<ProviderFixtureResponse>("h2h", "fixtures/headtohead", {
      h2h: `${homeTeamId}-${awayTeamId}`,
      last,
    });
  }

  async getStandings(
    leagueId: number,
    season: number,
  ): Promise<ApiSportsRequestResult<ProviderStandingsResponse>> {
    return this.request<ProviderStandingsResponse>("standings", "standings", {
      league: leagueId,
      season,
    });
  }

  async getTeamStatistics(
    leagueId: number,
    season: number,
    teamId: number,
  ): Promise<ApiSportsRequestResult<ProviderTeamStatisticsResponse>> {
    return this.request<ProviderTeamStatisticsResponse>(
      "teamStatistics",
      "teams/statistics",
      {
        league: leagueId,
        season,
        team: teamId,
      },
    );
  }

  async getPredictions(
    fixtureId: number,
  ): Promise<ApiSportsRequestResult<ProviderPredictionResponse>> {
    return this.request<ProviderPredictionResponse>("predictions", "predictions", {
      fixture: fixtureId,
    });
  }

  async getLeague(
    leagueId: number,
    season: number,
  ): Promise<ApiSportsRequestResult<ProviderLeagueResponse>> {
    return this.request<ProviderLeagueResponse>("leagues", "leagues", {
      id: leagueId,
      season,
    });
  }

  async getRecentFixturesForTeam(
    teamId: number,
    last: number,
  ): Promise<ApiSportsRequestResult<ProviderFixtureResponse>> {
    return this.request<ProviderFixtureResponse>("fixture", "fixtures", {
      team: teamId,
      last,
    });
  }

  getMetrics(): ApiSportsClientMetrics {
    return {
      ...this.metrics,
    };
  }

  private async request<T>(
    kind: RequestKind,
    path: string,
    query: Record<string, string | number>,
  ): Promise<ApiSportsRequestResult<T>> {
    this.metrics.requestCount += 1;
    this.metrics.lastRequestAt = new Date().toISOString();

    if (kind === "live") {
      this.metrics.liveRequests += 1;
    } else if (kind === "today") {
      this.metrics.todayFixtureRequests += 1;
    } else if (kind === "fixture") {
      this.metrics.fixtureByIdRequests += 1;
    } else if (kind === "events") {
      this.metrics.eventRequests += 1;
    } else if (kind === "statistics") {
      this.metrics.statisticsRequests += 1;
    } else if (kind === "lineups") {
      this.metrics.lineupRequests += 1;
    } else if (kind === "players") {
      this.metrics.playerRequests += 1;
    } else if (kind === "h2h") {
      this.metrics.h2hRequests += 1;
    } else if (kind === "standings") {
      this.metrics.standingsRequests += 1;
    } else if (kind === "teamStatistics") {
      this.metrics.teamStatisticsRequests += 1;
    } else if (kind === "predictions") {
      this.metrics.predictionRequests += 1;
    } else {
      this.metrics.leagueRequests += 1;
    }

    const url = new URL(path, `${this.options.baseUrl}/`);

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-apisports-key": this.options.apiKey,
        },
        signal: AbortSignal.timeout(this.options.requestTimeoutMs),
      });
    } catch (error) {
      this.metrics.failedRequestCount += 1;
      throw error;
    }

    const rateLimit = extractRateLimit(response.headers);
    const text = await response.text();

    let payload: ProviderApiEnvelope<T> | null = null;

    if (text) {
      try {
        payload = JSON.parse(text) as ProviderApiEnvelope<T>;
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      this.metrics.failedRequestCount += 1;
      throw new ApiSportsError(
        extractErrorMessage(payload, response.status),
        response.status,
        rateLimit,
        rateLimit.retryAfterMs,
      );
    }

    this.metrics.successfulRequestCount += 1;

    return {
      data: payload?.response ?? [],
      rateLimit,
    };
  }
}
