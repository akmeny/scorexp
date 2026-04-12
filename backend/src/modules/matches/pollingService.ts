import type { FastifyBaseLogger } from "fastify";
import type { ProviderFixtureResponse } from "../../types/provider.js";
import { withRetry } from "../../lib/retry.js";
import type { SocketHub } from "../socket/socketServer.js";
import {
  ApiSportsClient,
  ApiSportsError,
  type RateLimitInfo,
} from "./apiSportsClient.js";
import { reconcileMatches } from "./diff.js";
import type { MatchStore } from "./matchStore.js";
import { normalizeFixture, summarizeEvents } from "./normalizer.js";
import type {
  MatchEventsSummary,
  MatchFreshness,
  NormalizedMatch,
  NormalizedMatchInput,
} from "./types.js";

interface EventCacheEntry {
  summary: MatchEventsSummary | null;
  fetchedAt: number;
  fingerprint: string;
}

interface LiveMatchesPollingServiceOptions {
  client: ApiSportsClient;
  store: MatchStore;
  socketHub: SocketHub;
  logger: FastifyBaseLogger;
  baseIntervalMs: number;
  maxIntervalMs: number;
  eventSummaryTtlMs: number;
  maxEventRefreshesPerTick: number;
  scoreboardTimezone: string;
  enabled: boolean;
}

interface PollingMetrics {
  livePollCount: number;
  todayFixturePollCount: number;
  liveResponseDedupCount: number;
  todayFixtureResponseDedupCount: number;
  totalChangedMatches: number;
  lastChangedMatches: number;
  trackedRecentMatches: number;
  todayFixtureCount: number;
}

const liveLikeStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof ApiSportsError) {
    return error.isRetryable;
  }

  return true;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof ApiSportsError) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      rateLimit: error.rateLimit,
      retryAfterMs: error.retryAfterMs,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

function isTransitionWindow(match: Pick<NormalizedMatchInput, "statusShort" | "minute">): boolean {
  if (match.statusShort === "HT") {
    return true;
  }

  if (match.statusShort === "1H" && (match.minute ?? 0) >= 43) {
    return true;
  }

  if (match.statusShort === "2H" && (match.minute ?? 0) >= 88) {
    return true;
  }

  if (match.statusShort === "ET" && (match.minute ?? 0) >= 118) {
    return true;
  }

  return false;
}

function isLiveLikeStatus(statusShort: string): boolean {
  return liveLikeStatuses.has(statusShort);
}

function formatDateKey(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const lookup = new Map(parts.map((part) => [part.type, part.value]));
    const year = lookup.get("year");
    const month = lookup.get("month");
    const day = lookup.get("day");

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall back to UTC below if the configured timezone is invalid.
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fixtureFingerprint(fixture: ProviderFixtureResponse): string {
  return JSON.stringify([
    fixture.fixture.id,
    fixture.fixture.date ?? fixture.fixture.timestamp ?? null,
    fixture.fixture.status.short ?? null,
    fixture.fixture.status.long ?? null,
    fixture.fixture.status.elapsed ?? null,
    fixture.fixture.status.extra ?? null,
    fixture.league.id,
    fixture.league.name ?? null,
    fixture.league.country ?? null,
    fixture.league.flag ?? null,
    fixture.teams.home.id,
    fixture.teams.home.name ?? null,
    fixture.teams.home.logo ?? null,
    fixture.teams.away.id,
    fixture.teams.away.name ?? null,
    fixture.teams.away.logo ?? null,
    fixture.goals.home ?? null,
    fixture.goals.away ?? null,
  ]);
}

function fixturesResponseHash(fixtures: ProviderFixtureResponse[]): string {
  return fixtures
    .map((fixture) => `${fixture.fixture.id}:${fixtureFingerprint(fixture)}`)
    .sort()
    .join("|");
}

function eventsFingerprint(summary: MatchEventsSummary | null): string {
  return JSON.stringify(summary ?? null);
}

export class LiveMatchesPollingService {
  private timer: NodeJS.Timeout | null = null;

  private running = false;

  private inFlight = false;

  private currentDelayMs: number;

  private consecutiveFailures = 0;

  private lastAttemptAt: string | null = null;

  private lastSuccessAt: string | null = null;

  private lastError: string | null = null;

  private latestRateLimit: RateLimitInfo | null = null;

  private readonly eventsCache = new Map<number, EventCacheEntry>();

  private readonly freshness = new Map<number, MatchFreshness>();

  private readonly liveFingerprints = new Map<number, string>();

  private readonly todayFixtureFingerprints = new Map<number, string>();

  private readonly recentSeenAt = new Map<number, number>();

  private readonly todayFixturesById = new Map<number, ProviderFixtureResponse>();

  private readonly metrics: PollingMetrics = {
    livePollCount: 0,
    todayFixturePollCount: 0,
    liveResponseDedupCount: 0,
    todayFixtureResponseDedupCount: 0,
    totalChangedMatches: 0,
    lastChangedMatches: 0,
    trackedRecentMatches: 0,
    todayFixtureCount: 0,
  };

  private lastLiveResponseHash: string | null = null;

  private lastTodayFixturesResponseHash: string | null = null;

  private lastTodayFixturesPollAtMs = 0;

  private todayDateKey: string | null = null;

  constructor(private readonly options: LiveMatchesPollingServiceOptions) {
    this.currentDelayMs = options.baseIntervalMs;
  }

  start(): void {
    if (!this.options.enabled) {
      this.options.logger.warn(
        "APISPORTS_KEY is missing. Live polling is disabled until the key is configured.",
      );
      return;
    }

    if (this.running) {
      return;
    }

    this.running = true;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getStatus(): {
    enabled: boolean;
    running: boolean;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    currentDelayMs: number;
    consecutiveFailures: number;
    rateLimit: RateLimitInfo | null;
    lastLiveResponseHash: string | null;
    lastTodayFixturesResponseHash: string | null;
    metrics: PollingMetrics;
    provider: ReturnType<ApiSportsClient["getMetrics"]>;
    freshnessSample: MatchFreshness[];
  } {
    this.metrics.trackedRecentMatches = this.recentSeenAt.size;
    this.metrics.todayFixtureCount = this.todayFixturesById.size;

    return {
      enabled: this.options.enabled,
      running: this.running,
      lastAttemptAt: this.lastAttemptAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      currentDelayMs: this.currentDelayMs,
      consecutiveFailures: this.consecutiveFailures,
      rateLimit: this.latestRateLimit,
      lastLiveResponseHash: this.lastLiveResponseHash,
      lastTodayFixturesResponseHash: this.lastTodayFixturesResponseHash,
      metrics: {
        ...this.metrics,
      },
      provider: this.options.client.getMetrics(),
      freshnessSample: this.options.store.getFreshnessSnapshot(),
    };
  }

  private schedule(delayMs: number): void {
    if (!this.running) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.poll();
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.running || this.inFlight) {
      return;
    }

    this.inFlight = true;
    this.lastAttemptAt = new Date().toISOString();
    this.options.store.setLastAttemptAt(this.lastAttemptAt);

    try {
      const liveResult = await withRetry(() => this.options.client.getLiveFixtures(), {
        retries: 2,
        minDelayMs: 750,
        factor: 2,
        shouldRetry: isRetryableProviderError,
        onRetry: async (error, attempt, nextDelayMs) => {
          this.options.logger.warn(
            {
              error: serializeError(error),
              attempt,
              nextDelayMs,
            },
            "Retrying live fixtures poll",
          );
        },
      });

      this.metrics.livePollCount += 1;
      this.latestRateLimit = liveResult.rateLimit;

      const pollTimestamp = new Date().toISOString();
      const nowMs = Date.now();
      const dateKey = formatDateKey(
        new Date(nowMs),
        this.options.scoreboardTimezone,
      );
      const liveResponseHash = fixturesResponseHash(liveResult.data);

      this.ensureTodayDate(dateKey);

      if (liveResponseHash === this.lastLiveResponseHash) {
        this.metrics.liveResponseDedupCount += 1;
      }

      this.lastLiveResponseHash = liveResponseHash;

      const previousMatches = this.options.store.getMap();
      const liveFixturesById = new Map<number, ProviderFixtureResponse>();

      for (const fixture of liveResult.data) {
        const matchId = fixture.fixture.id;
        const fingerprint = fixtureFingerprint(fixture);

        liveFixturesById.set(matchId, fixture);
        this.recentSeenAt.set(matchId, nowMs);
        this.noteFreshness(matchId, "live", pollTimestamp, fingerprint);
      }

      const todayContext = {
        used: false,
      };

      try {
        const result = await this.maybeFetchTodayFixtures(
          dateKey,
          liveResult.data,
          nowMs,
          pollTimestamp,
        );
        todayContext.used = result.used;
      } catch (error) {
        this.options.logger.warn(
          {
            error: serializeError(error),
            dateKey,
            cachedTodayFixtures: this.todayFixturesById.size,
          },
          "Today fixtures refresh failed; continuing with cached fixtures and live overlay",
        );
      }

      const effectiveFixtures = new Map(this.todayFixturesById);

      for (const [matchId, fixture] of liveFixturesById) {
        effectiveFixtures.set(matchId, fixture);
      }

      const currentInputs = [...effectiveFixtures.values()].map((fixture) =>
        normalizeFixture(
          fixture,
          this.eventsCache.get(fixture.fixture.id)?.summary ?? null,
        ),
      );

      const eventRefreshCandidates = this.pickEventRefreshCandidates(
        currentInputs,
        previousMatches,
      );

      await this.refreshEvents(
        eventRefreshCandidates,
        pollTimestamp,
        effectiveFixtures,
      );

      const latestInputs = [...effectiveFixtures.values()].map((fixture) =>
        normalizeFixture(
          fixture,
          this.eventsCache.get(fixture.fixture.id)?.summary ?? null,
        ),
      );

      const generatedAt = new Date().toISOString();
      const reconcileResult = reconcileMatches(
        previousMatches,
        latestInputs,
        generatedAt,
      );

      const nextFreshness = new Map<number, MatchFreshness>();

      for (const matchId of reconcileResult.nextMatches.keys()) {
        const freshness = this.freshness.get(matchId);

        if (freshness) {
          nextFreshness.set(matchId, freshness);
        }
      }

      this.options.store.replace(reconcileResult.nextMatches, nextFreshness);
      this.options.store.setLastSuccessfulPollAt(generatedAt);
      this.options.store.setLastError(null);

      this.lastSuccessAt = generatedAt;
      this.lastError = null;
      this.consecutiveFailures = 0;

      this.cleanupCaches(reconcileResult.nextMatches, nowMs);

      const changedMatches =
        reconcileResult.diff.added.length +
        reconcileResult.diff.updated.length +
        reconcileResult.diff.removed.length;

      this.metrics.lastChangedMatches = changedMatches;
      this.metrics.totalChangedMatches += changedMatches;

      if (reconcileResult.hasChanges) {
        this.options.socketHub.queueDiff(reconcileResult.diff);
      }

      const liveInputsForCadence = liveResult.data.map((fixture) =>
        normalizeFixture(fixture, null),
      );

      this.currentDelayMs = this.getSuccessDelay(
        liveInputsForCadence,
        liveResult.rateLimit,
      );

      this.options.logger.info(
        {
          liveMatches: liveResult.data.length,
          todayFixtures: this.todayFixturesById.size,
          effectiveMatches: latestInputs.length,
          dateKey,
          timezone: this.options.scoreboardTimezone,
          added: reconcileResult.diff.added.length,
          updated: reconcileResult.diff.updated.length,
          removed: reconcileResult.diff.removed.length,
          todayRefreshUsed: todayContext.used,
          eventRefreshes: eventRefreshCandidates.length,
          nextPollInMs: this.currentDelayMs,
          rateLimit: liveResult.rateLimit,
        },
        "Scoreboard poll completed",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown polling failure";

      this.consecutiveFailures += 1;
      this.lastError = message;
      this.options.store.setLastError(message);
      this.currentDelayMs = this.getFailureDelay(error);

      this.options.logger.error(
        {
          error: serializeError(error),
          nextPollInMs: this.currentDelayMs,
          consecutiveFailures: this.consecutiveFailures,
        },
        "Scoreboard poll failed",
      );
    } finally {
      this.inFlight = false;

      if (this.running) {
        this.schedule(this.currentDelayMs);
      }
    }
  }

  private async maybeFetchTodayFixtures(
    dateKey: string,
    liveFixtures: ProviderFixtureResponse[],
    nowMs: number,
    pollTimestamp: string,
  ): Promise<{
    used: boolean;
  }> {
    if (!this.shouldRunTodayFixturesPoll(nowMs, liveFixtures)) {
      return {
        used: false,
      };
    }

    const todayResult = await withRetry(
      () =>
        this.options.client.getFixturesByDate(
          dateKey,
          this.options.scoreboardTimezone,
        ),
      {
        retries: 1,
        minDelayMs: 750,
        factor: 2,
        shouldRetry: isRetryableProviderError,
        onRetry: async (error, attempt, nextDelayMs) => {
          this.options.logger.warn(
            {
              error: serializeError(error),
              attempt,
              nextDelayMs,
              dateKey,
            },
            "Retrying today fixtures refresh",
          );
        },
      },
    );

    this.metrics.todayFixturePollCount += 1;
    this.lastTodayFixturesPollAtMs = nowMs;
    this.latestRateLimit = todayResult.rateLimit;

    const todayResponseHash = fixturesResponseHash(todayResult.data);

    if (todayResponseHash === this.lastTodayFixturesResponseHash) {
      this.metrics.todayFixtureResponseDedupCount += 1;
    }

    this.lastTodayFixturesResponseHash = todayResponseHash;
    this.todayFixturesById.clear();

    for (const fixture of todayResult.data) {
      const matchId = fixture.fixture.id;
      const fingerprint = fixtureFingerprint(fixture);

      this.todayFixturesById.set(matchId, fixture);
      this.recentSeenAt.set(matchId, nowMs);
      this.noteFreshness(matchId, "today", pollTimestamp, fingerprint);
    }

    this.metrics.todayFixtureCount = this.todayFixturesById.size;

    return {
      used: true,
    };
  }

  private pickEventRefreshCandidates(
    currentMatches: NormalizedMatchInput[],
    previousMatches: Map<number, NormalizedMatch>,
  ): number[] {
    const budget = this.getEventRefreshBudget();

    if (budget === 0) {
      return [];
    }

    const now = Date.now();

    return currentMatches
      .map((match) => {
        const previous = previousMatches.get(match.matchId);
        const cache = this.eventsCache.get(match.matchId);
        const isStale =
          !cache || now - cache.fetchedAt >= this.options.eventSummaryTtlMs;

        if (!isStale) {
          return null;
        }

        if (!isLiveLikeStatus(match.statusShort)) {
          return null;
        }

        const scoreChanged =
          !previous ||
          previous.homeScore !== match.homeScore ||
          previous.awayScore !== match.awayScore;
        const statusChanged =
          !previous || previous.statusShort !== match.statusShort;
        const minuteChanged = !previous || previous.minute !== match.minute;
        const transitionBoost = isTransitionWindow(match) ? 1 : 0;
        const priority =
          (scoreChanged ? 3 : statusChanged ? 2 : minuteChanged ? 1 : 0) +
          transitionBoost;

        if (!cache) {
          return {
            matchId: match.matchId,
            priority: Math.max(priority, 2),
          };
        }

        if (priority === 0) {
          return null;
        }

        return {
          matchId: match.matchId,
          priority,
        };
      })
      .filter(
        (entry): entry is { matchId: number; priority: number } => entry !== null,
      )
      .sort(
        (left, right) =>
          right.priority - left.priority || left.matchId - right.matchId,
      )
      .slice(0, budget)
      .map((entry) => entry.matchId);
  }

  private async refreshEvents(
    matchIds: number[],
    pollTimestamp: string,
    fixturesById: Map<number, ProviderFixtureResponse>,
  ): Promise<void> {
    for (const matchId of matchIds) {
      try {
        const result = await withRetry(
          () => this.options.client.getFixtureEvents(matchId),
          {
            retries: 1,
            minDelayMs: 500,
            factor: 2,
            shouldRetry: isRetryableProviderError,
            onRetry: async (error, attempt, nextDelayMs) => {
              this.options.logger.warn(
                {
                  error: serializeError(error),
                  matchId,
                  attempt,
                  nextDelayMs,
                },
                "Retrying fixture events fetch",
              );
            },
          },
        );

        this.latestRateLimit = result.rateLimit;

        const fixture = fixturesById.get(matchId);
        const summary = summarizeEvents(
          result.data,
          fixture
            ? {
                homeTeamId: fixture.teams.home.id,
                awayTeamId: fixture.teams.away.id,
              }
            : undefined,
        );
        const fingerprint = eventsFingerprint(summary);
        const previous = this.eventsCache.get(matchId);

        if (!previous || previous.fingerprint !== fingerprint) {
          this.noteEventFreshness(matchId, pollTimestamp);
        }

        this.eventsCache.set(matchId, {
          summary,
          fetchedAt: Date.now(),
          fingerprint,
        });
      } catch (error) {
        this.options.logger.warn(
          {
            error: serializeError(error),
            matchId,
          },
          "Unable to refresh event summary for live match",
        );
      }
    }
  }

  private noteFreshness(
    matchId: number,
    source: "live" | "today",
    seenAt: string,
    fingerprint: string,
  ): void {
    const previous = this.freshness.get(matchId);
    const fingerprints =
      source === "live" ? this.liveFingerprints : this.todayFixtureFingerprints;
    const unchanged = fingerprints.get(matchId) === fingerprint;

    fingerprints.set(matchId, fingerprint);

    const providerSource =
      previous && previous.lastSeenAt === seenAt && previous.providerSource !== source
        ? "live+today"
        : source;

    this.freshness.set(matchId, {
      matchId,
      lastSeenAt: seenAt,
      lastLiveSeenAt: source === "live" ? seenAt : previous?.lastLiveSeenAt ?? null,
      lastTodaySeenAt:
        source === "today" ? seenAt : previous?.lastTodaySeenAt ?? null,
      lastEventsRefreshAt: previous?.lastEventsRefreshAt ?? null,
      lastProviderChangeAt: unchanged
        ? previous?.lastProviderChangeAt ?? seenAt
        : seenAt,
      providerSource,
      liveUnchangedStreak:
        source === "live"
          ? unchanged
            ? (previous?.liveUnchangedStreak ?? 0) + 1
            : 0
          : previous?.liveUnchangedStreak ?? 0,
      todayUnchangedStreak:
        source === "today"
          ? unchanged
            ? (previous?.todayUnchangedStreak ?? 0) + 1
            : 0
          : previous?.todayUnchangedStreak ?? 0,
    });
  }

  private noteEventFreshness(matchId: number, seenAt: string): void {
    const previous = this.freshness.get(matchId);

    if (!previous) {
      return;
    }

    this.freshness.set(matchId, {
      ...previous,
      lastEventsRefreshAt: seenAt,
      lastProviderChangeAt: seenAt,
    });
  }

  private cleanupCaches(liveMatches: Map<number, NormalizedMatch>, nowMs: number): void {
    for (const matchId of this.eventsCache.keys()) {
      if (!liveMatches.has(matchId)) {
        this.eventsCache.delete(matchId);
      }
    }

    for (const matchId of this.freshness.keys()) {
      if (!liveMatches.has(matchId)) {
        this.freshness.delete(matchId);
      }
    }

    const recentTtlMs = 3 * 60 * 60 * 1000;

    for (const [matchId, seenAt] of this.recentSeenAt) {
      if (liveMatches.has(matchId)) {
        continue;
      }

      if (nowMs - seenAt > recentTtlMs) {
        this.recentSeenAt.delete(matchId);
        this.liveFingerprints.delete(matchId);
        this.todayFixtureFingerprints.delete(matchId);
      }
    }
  }

  private ensureTodayDate(dateKey: string): void {
    if (this.todayDateKey === dateKey) {
      return;
    }

    this.todayDateKey = dateKey;
    this.todayFixturesById.clear();
    this.lastTodayFixturesResponseHash = null;
    this.lastTodayFixturesPollAtMs = 0;
    this.metrics.todayFixtureCount = 0;
  }

  private shouldRunTodayFixturesPoll(
    nowMs: number,
    liveFixtures: ProviderFixtureResponse[],
  ): boolean {
    const requestsRemaining = this.latestRateLimit?.requestsRemaining;

    if (
      this.todayFixturesById.size > 0 &&
      nowMs - this.lastTodayFixturesPollAtMs <
        this.getTodayFixturesIntervalMs(liveFixtures)
    ) {
      return false;
    }

    if (
      requestsRemaining !== null &&
      requestsRemaining !== undefined &&
      requestsRemaining <= 25 &&
      !liveFixtures.some((fixture) =>
        isTransitionWindow({
          statusShort: fixture.fixture.status.short?.trim() || "UNK",
          minute: fixture.fixture.status.elapsed ?? null,
        }),
      )
    ) {
      return false;
    }

    return true;
  }

  private getEventRefreshBudget(): number {
    const requestsRemaining = this.latestRateLimit?.requestsRemaining;

    if (
      requestsRemaining !== null &&
      requestsRemaining !== undefined &&
      requestsRemaining <= 25
    ) {
      return 0;
    }

    if (
      requestsRemaining !== null &&
      requestsRemaining !== undefined &&
      requestsRemaining <= 100
    ) {
      return Math.min(this.options.maxEventRefreshesPerTick, 1);
    }

    return this.options.maxEventRefreshesPerTick;
  }

  private getTodayFixturesIntervalMs(
    liveFixtures: ProviderFixtureResponse[],
  ): number {
    const base = this.options.baseIntervalMs;
    const hasTransition = liveFixtures.some((fixture) =>
      isTransitionWindow({
        statusShort: fixture.fixture.status.short?.trim() || "UNK",
        minute: fixture.fixture.status.elapsed ?? null,
      }),
    );

    if (liveFixtures.length === 0) {
      return Math.min(this.options.maxIntervalMs * 6, Math.max(base * 12, 300_000));
    }

    if (hasTransition) {
      return Math.min(this.options.maxIntervalMs * 3, Math.max(base * 6, 90_000));
    }

    return Math.min(this.options.maxIntervalMs * 3, Math.max(base * 8, 120_000));
  }

  private getSuccessDelay(
    liveMatches: NormalizedMatchInput[],
    rateLimit: RateLimitInfo,
  ): number {
    const base = this.options.baseIntervalMs;

    if (rateLimit.retryAfterMs) {
      return clamp(rateLimit.retryAfterMs, base, this.options.maxIntervalMs);
    }

    if (
      rateLimit.requestsRemaining !== null &&
      rateLimit.requestsRemaining <= 25
    ) {
      return Math.min(this.options.maxIntervalMs, Math.max(base * 4, 45_000));
    }

    if (
      rateLimit.requestsRemaining !== null &&
      rateLimit.requestsRemaining <= 100
    ) {
      return Math.min(this.options.maxIntervalMs, Math.max(base * 2, 25_000));
    }

    if (liveMatches.length === 0) {
      return Math.min(this.options.maxIntervalMs, Math.max(base * 3, 45_000));
    }

    if (liveMatches.some(isTransitionWindow)) {
      return clamp(Math.round(base * 0.9), 10_000, 20_000);
    }

    return clamp(Math.round(base * 0.6), 7_500, base);
  }

  private getFailureDelay(error: unknown): number {
    const base = this.options.baseIntervalMs;

    if (error instanceof ApiSportsError && error.retryAfterMs) {
      return clamp(error.retryAfterMs, base, this.options.maxIntervalMs);
    }

    if (error instanceof ApiSportsError && error.status === 429) {
      return Math.min(this.options.maxIntervalMs, Math.max(base * 4, 45_000));
    }

    return Math.min(
      this.options.maxIntervalMs,
      base * 2 ** Math.min(this.consecutiveFailures, 3),
    );
  }
}
