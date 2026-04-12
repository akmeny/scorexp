import type {
  ProviderApiEnvelope,
  ProviderFixtureEventResponse,
  ProviderFixtureResponse,
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
  fallbackFixtureRequests: number;
  eventRequests: number;
  lastRequestAt: string | null;
}

interface ApiSportsClientOptions {
  apiKey: string;
  baseUrl: string;
  requestTimeoutMs: number;
}

type RequestKind = "live" | "fallback" | "events";

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
    fallbackFixtureRequests: 0,
    eventRequests: 0,
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
  ): Promise<ApiSportsRequestResult<ProviderFixtureResponse>> {
    return this.request<ProviderFixtureResponse>("fallback", "fixtures", {
      date,
    });
  }

  async getFixtureEvents(
    fixtureId: number,
  ): Promise<ApiSportsRequestResult<ProviderFixtureEventResponse>> {
    return this.request<ProviderFixtureEventResponse>("events", "fixtures/events", {
      fixture: fixtureId,
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
    } else if (kind === "fallback") {
      this.metrics.fallbackFixtureRequests += 1;
    } else {
      this.metrics.eventRequests += 1;
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
