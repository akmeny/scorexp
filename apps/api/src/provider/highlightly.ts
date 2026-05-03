import type { AppEnv } from "../config/env.js";
import type { ProviderHighlight, ProviderMatch, ProviderMatchDetail, ProviderStandingsResponse } from "../domain/types.js";

export interface HighlightlyFetchResult {
  matches: ProviderMatch[];
  requestCount: number;
  rateLimit: {
    limit: string | null;
    remaining: string | null;
  };
}

export interface HighlightlyMatchDetailResult {
  match: ProviderMatchDetail | null;
  requestCount: number;
  rateLimit: {
    limit: string | null;
    remaining: string | null;
  };
}

export interface HighlightlyHighlightsResult {
  highlights: ProviderHighlight[];
  pagination: {
    totalCount: number;
    offset: number;
    limit: number;
  };
  requestCount: number;
  rateLimit: {
    limit: string | null;
    remaining: string | null;
  };
}

interface MatchesResponse {
  data?: ProviderMatch[];
  pagination?: {
    totalCount?: number;
    offset?: number;
    limit?: number;
  };
}

interface HighlightsResponse {
  data?: ProviderHighlight[];
  pagination?: {
    totalCount?: number;
    offset?: number;
    limit?: number;
  };
}

type MatchDetailResponse = ProviderMatchDetail[] | { data?: ProviderMatchDetail[] };
type MatchListResponse = ProviderMatch[] | { data?: ProviderMatch[] };

export class HighlightlyClient {
  constructor(private readonly appEnv: AppEnv) {}

  async getMatchesByDate(date: string, timezone: string): Promise<HighlightlyFetchResult> {
    const limit = 100;
    let offset = 0;
    let totalCount = Number.POSITIVE_INFINITY;
    let requestCount = 0;
    let rateLimit = { limit: null as string | null, remaining: null as string | null };
    const matches: ProviderMatch[] = [];

    while (offset < totalCount) {
      const url = new URL(`${this.appEnv.highlightlyApiBaseUrl}/matches`);
      url.searchParams.set("date", date);
      url.searchParams.set("timezone", timezone);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));

      const response = await fetch(url, {
        headers: {
          "x-rapidapi-key": this.appEnv.highlightlyApiKey
        },
        signal: AbortSignal.timeout(30_000)
      });

      requestCount += 1;
      rateLimit = {
        limit: response.headers.get("x-ratelimit-requests-limit"),
        remaining: response.headers.get("x-ratelimit-requests-remaining")
      };

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Highlightly /matches failed (${response.status}): ${body.slice(0, 400)}`);
      }

      const payload = (await response.json()) as MatchesResponse;
      const page = payload.data ?? [];
      matches.push(...page);

      totalCount = payload.pagination?.totalCount ?? matches.length;
      offset += page.length;

      if (page.length === 0 || page.length < limit) break;
    }

    return { matches, requestCount, rateLimit };
  }

  async getMatchById(id: string): Promise<HighlightlyMatchDetailResult> {
    const url = new URL(`${this.appEnv.highlightlyApiBaseUrl}/matches/${encodeURIComponent(id)}`);
    const response = await fetch(url, {
      headers: {
        "x-rapidapi-key": this.appEnv.highlightlyApiKey
      },
      signal: AbortSignal.timeout(30_000)
    });

    const rateLimit = {
      limit: response.headers.get("x-ratelimit-requests-limit"),
      remaining: response.headers.get("x-ratelimit-requests-remaining")
    };

    if (response.status === 404) {
      return { match: null, requestCount: 1, rateLimit };
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Highlightly /matches/${id} failed (${response.status}): ${body.slice(0, 400)}`);
    }

    const payload = (await response.json()) as MatchDetailResponse;
    const matches = Array.isArray(payload) ? payload : payload.data ?? [];

    return { match: matches[0] ?? null, requestCount: 1, rateLimit };
  }

  async getHighlights(options: {
    date: string;
    timezone: string;
    limit: number;
    offset: number;
  }): Promise<HighlightlyHighlightsResult> {
    const url = new URL(`${this.appEnv.highlightlyApiBaseUrl}/highlights`);
    url.searchParams.set("date", options.date);
    url.searchParams.set("timezone", options.timezone);
    url.searchParams.set("limit", String(options.limit));
    url.searchParams.set("offset", String(options.offset));

    const response = await fetch(url, {
      headers: {
        "x-rapidapi-key": this.appEnv.highlightlyApiKey
      },
      signal: AbortSignal.timeout(30_000)
    });

    const rateLimit = {
      limit: response.headers.get("x-ratelimit-requests-limit"),
      remaining: response.headers.get("x-ratelimit-requests-remaining")
    };

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Highlightly /highlights failed (${response.status}): ${body.slice(0, 400)}`);
    }

    const payload = (await response.json()) as HighlightsResponse;
    const highlights = payload.data ?? [];
    const pagination = {
      totalCount: payload.pagination?.totalCount ?? highlights.length,
      offset: payload.pagination?.offset ?? options.offset,
      limit: payload.pagination?.limit ?? options.limit
    };

    return { highlights, pagination, requestCount: 1, rateLimit };
  }

  async getHeadToHead(teamIdOne: string, teamIdTwo: string): Promise<ProviderMatch[]> {
    const payload = await this.getJson<MatchListResponse | null>("/head-2-head", {
      teamIdOne,
      teamIdTwo
    });

    if (!payload) return [];
    return Array.isArray(payload) ? payload : payload.data ?? [];
  }

  async getLastFiveGames(teamId: string): Promise<ProviderMatch[]> {
    const payload = await this.getJson<MatchListResponse | null>("/last-five-games", { teamId });
    if (!payload) return [];
    return Array.isArray(payload) ? payload : payload.data ?? [];
  }

  async getStandings(leagueId: string, season: string): Promise<ProviderStandingsResponse | null> {
    return this.getJson<ProviderStandingsResponse | null>("/standings", { leagueId, season });
  }

  private async getJson<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.appEnv.highlightlyApiBaseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        "x-rapidapi-key": this.appEnv.highlightlyApiKey
      },
      signal: AbortSignal.timeout(30_000)
    });

    if (response.status === 404) {
      return null as T;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Highlightly ${path} failed (${response.status}): ${body.slice(0, 400)}`);
    }

    return (await response.json()) as T;
  }
}
