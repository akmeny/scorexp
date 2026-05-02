import type { AppEnv } from "../config/env.js";
import type { ProviderMatch, ProviderMatchDetail } from "../domain/types.js";

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

interface MatchesResponse {
  data?: ProviderMatch[];
  pagination?: {
    totalCount?: number;
    offset?: number;
    limit?: number;
  };
}

type MatchDetailResponse = ProviderMatchDetail[] | { data?: ProviderMatchDetail[] };

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
}
