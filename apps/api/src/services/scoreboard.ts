import type { AppEnv } from "../config/env.js";
import {
  createHighlightsChecksum,
  countMatches,
  createSnapshotChecksum,
  filterSnapshot,
  groupMatches,
  normalizeHighlight,
  normalizeMatch,
  normalizeMatchDetail
} from "../domain/normalize.js";
import type {
  HighlightsCacheEntry,
  HighlightsSnapshot,
  MatchDetail,
  MatchDetailCacheEntry,
  NormalizedMatch,
  ProviderLineupsResponse,
  ProviderMatch,
  ProviderMatchEvent,
  ProviderStandingsResponse,
  ProviderTeamStatistics,
  RefreshPolicy,
  ScoreboardSnapshot,
  ScoreboardView,
  SnapshotCacheEntry
} from "../domain/types.js";
import type { HighlightlyClient } from "../provider/highlightly.js";
import type { HotCache } from "../storage/cache.js";
import type { DurableStore } from "../storage/jsonStore.js";
import { addSeconds, isBeforeLocalDate } from "../utils/date.js";

const CARD_ENRICHMENT_LIMIT = 32;
const CARD_ENRICHMENT_CONCURRENCY = 4;
const HIGHLIGHTS_REFRESH_SECONDS = 60;
const SCOREBOARD_LIVE_REFRESH_SECONDS = 10;
const LIVE_DETAIL_CLIENT_REFRESH_SECONDS = 30;
const LIVE_DETAIL_PROVIDER_REFRESH_SECONDS = 120;
const LIVE_EVENTS_REFRESH_SECONDS = 60;
const LIVE_STATISTICS_REFRESH_SECONDS = 300;
const LINEUPS_REFRESH_SECONDS = 600;
const LINEUPS_DATA_TTL_SECONDS = 12 * 60 * 60;
const EMPTY_LIVE_FEED_CUTOFF_MINUTE = 15;
const EMPTY_LIVE_FEED_DISABLE_SECONDS = 8 * 60 * 60;
const UPCOMING_LINEUP_PREFETCH_LIMIT = 80;
const UPCOMING_LINEUP_PREFETCH_CONCURRENCY = 2;
const LIVE_CARD_ENRICHMENT_ENABLED = false;
const STALE_CLIENT_RETRY_SECONDS = 10;
const PROVIDER_FAILURE_BACKOFF_SECONDS = 60;
const PROVIDER_QUOTA_BACKOFF_SECONDS = 3_600;
const STALE_CLIENT_BACKOFF_MAX_SECONDS = 300;

interface ScoreboardQuery {
  date: string;
  timezone: string;
  view: ScoreboardView;
}

interface MatchDetailQuery {
  matchId: string;
  timezone: string;
  force?: boolean;
}

interface HighlightsQuery {
  date: string;
  timezone: string;
  limit: number;
  offset: number;
}

interface CachedSupplement<T> {
  value: T;
  requestCount: number;
}

export class ScoreboardService {
  private readonly inFlight = new Map<string, Promise<SnapshotCacheEntry>>();
  private readonly detailInFlight = new Map<string, Promise<MatchDetailCacheEntry>>();
  private readonly cardEnrichmentInFlight = new Map<string, Promise<void>>();
  private readonly providerBackoffUntil = new Map<string, number>();
  private readonly detailBackoffUntil = new Map<string, number>();

  constructor(
    private readonly appEnv: AppEnv,
    private readonly highlightly: HighlightlyClient,
    private readonly cache: HotCache,
    private readonly store: DurableStore
  ) {}

  async getScoreboard(query: ScoreboardQuery): Promise<ScoreboardSnapshot> {
    const key = snapshotKey(query.date, query.timezone);
    const completedDate = await this.store.getCompletedDate(key);
    const providerBackoffSeconds = this.remainingBackoffSeconds(this.providerBackoffUntil, key);

    if (completedDate) {
      const durableSnapshot = await this.store.getSnapshot(key);
      if (durableSnapshot) {
        return filterSnapshot(lockSnapshot(durableSnapshot.snapshot, this.appEnv), query.view);
      }
    }

    const cached = await this.cache.get<SnapshotCacheEntry>(key);
    if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
      return filterSnapshot(cached.snapshot, query.view);
    }

    const durable = await this.store.getSnapshot(key);
    if (durable && new Date(durable.expiresAt).getTime() > Date.now()) {
      await this.cache.set(key, durable, ttlFromEntry(durable));
      return filterSnapshot(durable.snapshot, query.view);
    }

    const staleFallback = cached ?? durable;
    if (staleFallback) {
      if (!providerBackoffSeconds) {
        this.queueRefresh(key, query.date, query.timezone);
      }
      return filterSnapshot(markSnapshotRefreshing(staleFallback.snapshot, providerBackoffSeconds ?? STALE_CLIENT_RETRY_SECONDS), query.view);
    }

    const fresh = await this.refresh(key, query.date, query.timezone);
    return filterSnapshot(fresh.snapshot, query.view);
  }

  async getMatchDetail(query: MatchDetailQuery): Promise<MatchDetail> {
    const key = matchDetailKey(query.matchId, query.timezone);
    const cached = await this.cache.get<MatchDetailCacheEntry>(key);
    const detailBackoffSeconds = this.remainingBackoffSeconds(this.detailBackoffUntil, key);

    if (cached?.detail.match.status.group === "finished") {
      return lockDetail(cached.detail, this.appEnv);
    }

    if (cached && (detailBackoffSeconds || new Date(cached.expiresAt).getTime() > Date.now())) {
      return cached.detail;
    }

    const fresh = await this.refreshMatchDetail(key, query.matchId, query.timezone);
    return fresh.detail;
  }

  async getHighlights(query: HighlightsQuery): Promise<HighlightsSnapshot> {
    const key = highlightsKey(query.date, query.timezone, query.limit, query.offset);
    const cached = await this.cache.get<HighlightsCacheEntry>(key);

    if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
      return cached.snapshot;
    }

    const fetchedAt = new Date().toISOString();
    const response = await this.highlightly.getHighlights(query);
    const highlights = response.highlights.map((highlight) => normalizeHighlight(highlight, query.timezone, fetchedAt));
    const now = new Date();
    const expiresAt = addSeconds(now, HIGHLIGHTS_REFRESH_SECONDS).toISOString();
    const nextOffset =
      response.pagination.offset + response.pagination.limit < response.pagination.totalCount
        ? response.pagination.offset + response.pagination.limit
        : null;

    const withoutChecksum = {
      id: `${query.date}:${query.timezone}:${query.offset}:${query.limit}`,
      date: query.date,
      timezone: query.timezone,
      generatedAt: now.toISOString(),
      fetchedAt,
      expiresAt,
      highlights,
      pagination: {
        totalCount: response.pagination.totalCount,
        offset: response.pagination.offset,
        limit: response.pagination.limit,
        nextOffset
      }
    };
    const snapshot: HighlightsSnapshot = {
      ...withoutChecksum,
      checksum: createHighlightsChecksum(highlights)
    };
    const entry: HighlightsCacheEntry = {
      snapshot,
      fetchedAt,
      expiresAt,
      providerRequestCount: response.requestCount
    };

    await this.cache.set(key, entry, ttlFromEntry(entry));
    return snapshot;
  }

  async warmScoreboard(date: string, timezone: string): Promise<ScoreboardSnapshot> {
    return this.getScoreboard({ date, timezone, view: "all" });
  }

  private async refresh(key: string, date: string, timezone: string): Promise<SnapshotCacheEntry> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    if (this.remainingBackoffSeconds(this.providerBackoffUntil, key)) {
      throw new Error(`Provider refresh is in backoff for ${key}`);
    }

    const promise = this.fetchAndBuild(key, date, timezone)
      .then((entry) => {
        this.providerBackoffUntil.delete(key);
        return entry;
      })
      .catch((error) => {
        this.registerBackoff(this.providerBackoffUntil, key, error);
        throw error;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  private async refreshMatchDetail(key: string, matchId: string, timezone: string): Promise<MatchDetailCacheEntry> {
    const existing = this.detailInFlight.get(key);
    if (existing) return existing;
    if (this.remainingBackoffSeconds(this.detailBackoffUntil, key)) {
      throw new Error(`Provider detail refresh is in backoff for ${key}`);
    }

    const promise = this.fetchAndBuildMatchDetail(key, matchId, timezone)
      .then((entry) => {
        this.detailBackoffUntil.delete(key);
        return entry;
      })
      .catch((error) => {
        this.registerBackoff(this.detailBackoffUntil, key, error);
        throw error;
      })
      .finally(() => {
        this.detailInFlight.delete(key);
      });

    this.detailInFlight.set(key, promise);
    return promise;
  }

  private queueRefresh(key: string, date: string, timezone: string): void {
    if (this.remainingBackoffSeconds(this.providerBackoffUntil, key)) return;
    void this.refresh(key, date, timezone).catch(() => undefined);
  }

  private async fetchAndBuild(key: string, date: string, timezone: string): Promise<SnapshotCacheEntry> {
    const fetchedAt = new Date().toISOString();
    const response = await this.highlightly.getMatchesByDate(date, timezone);
    const normalized = response.matches.map((match) => normalizeMatch(match, timezone, fetchedAt));
    const incoming = normalized;
    const persistedFinished = await this.store.getFinishedMatches(key);
    const merged = mergePersistedFinished(incoming, persistedFinished);
    const newlyFinished = merged.filter((match) => match.status.group === "finished");

    await this.store.saveFinishedMatches(key, newlyFinished);

    const snapshot = this.buildSnapshot(date, timezone, merged, fetchedAt);
    const entry: SnapshotCacheEntry = {
      snapshot,
      fetchedAt,
      expiresAt: snapshot.expiresAt,
      providerRequestCount: response.requestCount
    };

    await this.cache.set(key, entry, ttlFromEntry(entry));
    await this.store.saveSnapshot(key, entry);
    this.queueLiveCardEnrichment(key, timezone, entry);
    this.queueUpcomingLineupPrefetch(merged);

    const isPast = isBeforeLocalDate(date, timezone);
    const canLockDate = isPast && merged.every((match) => match.status.group === "finished");
    if (canLockDate) {
      await this.store.markDateCompleted(key, merged.length, fetchedAt);
    }

    return entry;
  }

  private queueLiveCardEnrichment(key: string, timezone: string, baseEntry: SnapshotCacheEntry): void {
    if (!LIVE_CARD_ENRICHMENT_ENABLED) return;
    if (!baseEntry.snapshot.leagues.some((league) => league.counts.live > 0)) return;
    if (this.cardEnrichmentInFlight.has(key)) return;

    const promise = this.enrichAndPersistLiveMatchCards(key, timezone, baseEntry).finally(() => {
      this.cardEnrichmentInFlight.delete(key);
    });

    this.cardEnrichmentInFlight.set(key, promise);
    void promise.catch(() => undefined);
  }

  private queueUpcomingLineupPrefetch(matches: NormalizedMatch[]): void {
    const now = Date.now();
    const candidates = matches
      .filter((match) => this.upcomingLineupBucket(match, now))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, UPCOMING_LINEUP_PREFETCH_LIMIT);

    if (candidates.length === 0) return;

    void mapWithConcurrency(candidates, UPCOMING_LINEUP_PREFETCH_CONCURRENCY, async (match) => {
      await this.prefetchUpcomingLineups(match, now);
    }).catch(() => undefined);
  }

  private async prefetchUpcomingLineups(match: NormalizedMatch, now: number): Promise<void> {
    const bucket = this.upcomingLineupBucket(match, now);
    if (!bucket) return;

    const attemptKey = lineupAttemptKey(match.providerId, bucket);
    const attempted = await this.cache.get<{ attemptedAt: string }>(attemptKey);
    if (attempted) return;

    await this.cache.set(attemptKey, { attemptedAt: new Date().toISOString() }, LINEUPS_DATA_TTL_SECONDS);
    await this.getLineupsForMatch(match);
  }

  private async enrichAndPersistLiveMatchCards(
    key: string,
    timezone: string,
    baseEntry: SnapshotCacheEntry
  ): Promise<void> {
    const matches = baseEntry.snapshot.leagues.flatMap((league) => league.matches);
    const cardEnrichment = await this.enrichLiveMatchCards(matches, timezone, baseEntry.fetchedAt);

    if (cardEnrichment.requestCount === 0) return;

    const current = await this.cache.get<SnapshotCacheEntry>(key);
    if (!current || current.fetchedAt !== baseEntry.fetchedAt) return;

    const snapshot = this.buildSnapshot(baseEntry.snapshot.date, timezone, cardEnrichment.matches, baseEntry.fetchedAt);
    const entry: SnapshotCacheEntry = {
      snapshot,
      fetchedAt: baseEntry.fetchedAt,
      expiresAt: snapshot.expiresAt,
      providerRequestCount: baseEntry.providerRequestCount + cardEnrichment.requestCount
    };

    await this.cache.set(key, entry, ttlFromEntry(entry));
    await this.store.saveSnapshot(key, entry);
  }

  private async enrichLiveMatchCards(matches: NormalizedMatch[], timezone: string, fetchedAt: string) {
    const candidates = matches
      .filter((match) => match.status.group === "live")
      .sort((a, b) => Number(b.isTopTier) - Number(a.isTopTier) || a.timestamp - b.timestamp)
      .slice(0, CARD_ENRICHMENT_LIMIT);

    if (candidates.length === 0) {
      return { matches, requestCount: 0 };
    }

    const results = await mapWithConcurrency(candidates, CARD_ENRICHMENT_CONCURRENCY, async (match) => {
      try {
        const detail = await this.highlightly.getMatchById(match.providerId);
        if (!detail.match) {
          return { id: match.id, redCards: match.redCards, requestCount: detail.requestCount };
        }

        return {
          id: match.id,
          redCards: normalizeMatch(detail.match, timezone, fetchedAt).redCards,
          requestCount: detail.requestCount
        };
      } catch {
        return { id: match.id, redCards: match.redCards, requestCount: 0 };
      }
    });

    const byId = new Map(results.map((result) => [result.id, result]));
    return {
      matches: matches.map((match) => {
        const enriched = byId.get(match.id);
        return enriched ? { ...match, redCards: enriched.redCards } : match;
      }),
      requestCount: results.reduce((total, result) => total + result.requestCount, 0)
    };
  }

  private async fetchAndBuildMatchDetail(key: string, matchId: string, timezone: string): Promise<MatchDetailCacheEntry> {
    const fetchedAt = new Date().toISOString();
    const response = await this.highlightly.getMatchById(matchId);

    if (!response.match) {
      throw new Error(`Match detail not found (${matchId})`);
    }

    const normalizedMatch = normalizeMatch(response.match, timezone, fetchedAt);
    const statusGroup = normalizedMatch.status.group;
    const refreshPolicy = this.pickDetailRefreshPolicy(statusGroup, new Date());
    const context = await this.getMatchContext(response.match, normalizedMatch, timezone);
    const hydratedMatch = {
      ...response.match,
      events: preferNonEmptyList(context.events, response.match.events),
      statistics: preferNonEmptyStatistics(context.statistics, response.match.statistics)
    };
    const detail = normalizeMatchDetail(
      hydratedMatch,
      timezone,
      fetchedAt,
      refreshPolicy.nextProviderRefreshAt,
      refreshPolicy,
      context
    );
    const entry: MatchDetailCacheEntry = {
      detail,
      fetchedAt,
      expiresAt: detail.expiresAt,
      providerRequestCount: response.requestCount + context.requestCount
    };

    await this.cache.set(key, entry, ttlFromEntry(entry));
    return entry;
  }

  private async getMatchContext(match: ProviderMatch, normalizedMatch: NormalizedMatch, timezone: string) {
    const homeTeamId = teamId(match.homeTeam?.id);
    const awayTeamId = teamId(match.awayTeam?.id);
    const leagueId = teamId(match.league?.id);
    const season = match.league?.season !== undefined && match.league.season !== null ? String(match.league.season) : null;

    const [headToHead, homeForm, awayForm, standings, events, statistics, lineups] = await Promise.all([
      homeTeamId && awayTeamId
        ? this.getCachedSupplement<ProviderMatch[]>(
            `football:h2h:${[homeTeamId, awayTeamId].sort().join(":")}`,
            86_400,
            () => this.highlightly.getHeadToHead(homeTeamId, awayTeamId),
            []
          )
        : Promise.resolve(cachedSupplement<ProviderMatch[]>([])),
      homeTeamId
        ? this.getCachedSupplement<ProviderMatch[]>(`football:form:${homeTeamId}`, 21_600, () =>
            this.highlightly.getLastFiveGames(homeTeamId),
            []
          )
        : Promise.resolve(cachedSupplement<ProviderMatch[]>([])),
      awayTeamId
        ? this.getCachedSupplement<ProviderMatch[]>(`football:form:${awayTeamId}`, 21_600, () =>
            this.highlightly.getLastFiveGames(awayTeamId),
            []
          )
        : Promise.resolve(cachedSupplement<ProviderMatch[]>([])),
      leagueId && season
        ? this.getCachedSupplement<ProviderStandingsResponse | null>(
            `football:standings:${leagueId}:${season}:${timezone}`,
            900,
            () => this.highlightly.getStandings(leagueId, season),
            null
          )
        : Promise.resolve(cachedSupplement(null)),
      this.getEventsForMatch(normalizedMatch),
      this.getStatisticsForMatch(normalizedMatch),
      this.shouldFetchLineups(normalizedMatch) ? this.getLineupsForMatch(normalizedMatch) : Promise.resolve(cachedSupplement(null))
    ]);

    return {
      headToHead: headToHead.value,
      homeForm: homeForm.value,
      awayForm: awayForm.value,
      standings: standings.value,
      events: events.value,
      statistics: statistics.value,
      lineups: lineups.value,
      requestCount:
        headToHead.requestCount +
        homeForm.requestCount +
        awayForm.requestCount +
        standings.requestCount +
        events.requestCount +
        statistics.requestCount +
        lineups.requestCount
    };
  }

  private async getCachedSupplement<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    fallback: T
  ): Promise<CachedSupplement<T>> {
    const cached = await this.cache.get<{ value: T }>(key);
    if (cached) return { value: cached.value, requestCount: 0 };

    try {
      const fresh = await fetcher();
      await this.cache.set(key, { value: fresh }, ttlSeconds);
      return { value: fresh, requestCount: 1 };
    } catch {
      return { value: fallback, requestCount: 0 };
    }
  }

  private async getEventsForMatch(match: NormalizedMatch): Promise<CachedSupplement<ProviderMatchEvent[] | null>> {
    if (match.status.group !== "live") return cachedSupplement(null);
    if (await this.isDisabled(emptyFeedDisabledKey("events", match.providerId))) return cachedSupplement([]);

    const key = liveFeedKey("events", match.providerId);
    const cached = await this.cache.get<{ value: ProviderMatchEvent[] }>(key);
    if (cached) return cachedSupplement(cached.value);

    try {
      const result = await this.highlightly.getEvents(match.providerId);
      const events = result.events;
      await this.cache.set(key, { value: events }, LIVE_EVENTS_REFRESH_SECONDS);

      if (events.length === 0 && shouldDisableEmptyLiveFeed(match)) {
        await this.disableEmptyFeed("events", match.providerId);
      }

      return { value: events, requestCount: result.requestCount };
    } catch {
      return cachedSupplement(null);
    }
  }

  private async getStatisticsForMatch(match: NormalizedMatch): Promise<CachedSupplement<ProviderTeamStatistics[] | null>> {
    if (match.status.group !== "live") return cachedSupplement(null);
    if (await this.isDisabled(emptyFeedDisabledKey("statistics", match.providerId))) return cachedSupplement([]);

    const key = liveFeedKey("statistics", match.providerId);
    const cached = await this.cache.get<{ value: ProviderTeamStatistics[] }>(key);
    if (cached) return cachedSupplement(cached.value);

    try {
      const result = await this.highlightly.getStatistics(match.providerId);
      const statistics = result.statistics;
      await this.cache.set(key, { value: statistics }, LIVE_STATISTICS_REFRESH_SECONDS);

      if (!hasTeamStatistics(statistics) && shouldDisableEmptyLiveFeed(match)) {
        await this.disableEmptyFeed("statistics", match.providerId);
      }

      return { value: statistics, requestCount: result.requestCount };
    } catch {
      return cachedSupplement(null);
    }
  }

  private async getLineupsForMatch(match: NormalizedMatch): Promise<CachedSupplement<ProviderLineupsResponse | null>> {
    const disabledKey = lineupDisabledKey(match.providerId);
    if (await this.isDisabled(disabledKey)) return cachedSupplement(null);

    const key = lineupsKey(match.providerId);
    const cached = await this.cache.get<{ value: ProviderLineupsResponse | null }>(key);
    if (cached) return cachedSupplement(cached.value);

    try {
      const result = await this.highlightly.getLineups(match.providerId);
      const lineups = hasLineupData(result.lineups) ? result.lineups : null;
      await this.cache.set(key, { value: lineups }, lineups ? LINEUPS_DATA_TTL_SECONDS : LINEUPS_REFRESH_SECONDS);

      if (!lineups && match.status.group === "live" && shouldDisableEmptyLiveFeed(match)) {
        await this.cache.set(disabledKey, { disabledAt: new Date().toISOString() }, EMPTY_LIVE_FEED_DISABLE_SECONDS);
      }

      return { value: lineups, requestCount: result.requestCount };
    } catch {
      return cachedSupplement(null);
    }
  }

  private shouldFetchLineups(match: NormalizedMatch): boolean {
    if (match.status.group === "live") return true;
    return Boolean(this.upcomingLineupBucket(match, Date.now()));
  }

  private upcomingLineupBucket(match: NormalizedMatch, now: number): "30m" | "15m" | null {
    if (match.status.group !== "upcoming") return null;

    const minutesUntilKickoff = (match.timestamp - now) / 60_000;
    if (minutesUntilKickoff <= 30 && minutesUntilKickoff > 15) return "30m";
    if (minutesUntilKickoff <= 15 && minutesUntilKickoff >= -2) return "15m";
    return null;
  }

  private async isDisabled(key: string) {
    return Boolean(await this.cache.get<{ disabledAt: string }>(key));
  }

  private async disableEmptyFeed(kind: "events" | "statistics", matchId: string) {
    await this.cache.set(emptyFeedDisabledKey(kind, matchId), { disabledAt: new Date().toISOString() }, EMPTY_LIVE_FEED_DISABLE_SECONDS);
  }

  private buildSnapshot(date: string, timezone: string, matches: NormalizedMatch[], fetchedAt: string): ScoreboardSnapshot {
    const now = new Date();
    const leagues = groupMatches(matches);
    const counts = countMatches(leagues);
    const refreshPolicy = this.pickRefreshPolicy(matches, date, timezone, now);
    const expiresAt = refreshPolicy.nextProviderRefreshAt;

    const withoutChecksum = {
      id: `${date}:${timezone}`,
      date,
      timezone,
      generatedAt: now.toISOString(),
      sourceUpdatedAt: fetchedAt,
      expiresAt,
      view: "all" as const,
      refreshPolicy,
      counts,
      leagues
    };

    return {
      ...withoutChecksum,
      checksum: createSnapshotChecksum(withoutChecksum)
    };
  }

  private pickRefreshPolicy(matches: NormalizedMatch[], date: string, timezone: string, now: Date): RefreshPolicy {
    const hasLiveMatch = matches.some((match) => match.status.group === "live");
    const isPast = isBeforeLocalDate(date, timezone, now);
    const reason = hasLiveMatch ? "live" : isPast ? "finished" : "upcoming";
    const liveRefreshSeconds = Math.min(this.appEnv.liveRefreshSeconds, SCOREBOARD_LIVE_REFRESH_SECONDS);
    const providerRefreshSeconds =
      reason === "live"
        ? liveRefreshSeconds
        : reason === "finished"
          ? this.appEnv.finishedRefreshSeconds
          : this.appEnv.upcomingRefreshSeconds;

    return {
      reason,
      providerRefreshSeconds,
      clientRefreshSeconds: reason === "live" ? liveRefreshSeconds : this.appEnv.clientRefreshSeconds,
      nextProviderRefreshAt: addSeconds(now, providerRefreshSeconds).toISOString()
    };
  }

  private pickDetailRefreshPolicy(statusGroup: NormalizedMatch["status"]["group"], now: Date): RefreshPolicy {
    const reason = statusGroup === "live" ? "live" : statusGroup === "finished" ? "finished" : "upcoming";
    const providerRefreshSeconds =
      reason === "live"
        ? LIVE_DETAIL_PROVIDER_REFRESH_SECONDS
        : reason === "finished"
          ? this.appEnv.finishedRefreshSeconds
          : this.appEnv.upcomingRefreshSeconds;

    return {
      reason,
      providerRefreshSeconds,
      clientRefreshSeconds: reason === "live" ? LIVE_DETAIL_CLIENT_REFRESH_SECONDS : providerRefreshSeconds,
      nextProviderRefreshAt: addSeconds(now, providerRefreshSeconds).toISOString()
    };
  }

  private remainingBackoffSeconds(backoffs: Map<string, number>, key: string) {
    const until = backoffs.get(key);
    if (!until) return null;
    const remainingMs = until - Date.now();
    if (remainingMs <= 0) {
      backoffs.delete(key);
      return null;
    }

    return Math.ceil(remainingMs / 1000);
  }

  private registerBackoff(backoffs: Map<string, number>, key: string, error: unknown) {
    const seconds = isProviderQuotaError(error) ? PROVIDER_QUOTA_BACKOFF_SECONDS : PROVIDER_FAILURE_BACKOFF_SECONDS;
    backoffs.set(key, Date.now() + seconds * 1000);
  }
}

function snapshotKey(date: string, timezone: string) {
  return `football:v4:${date}:${timezone}`;
}

function matchDetailKey(matchId: string, timezone: string) {
  return `football:match-detail:v7:${matchId}:${timezone}`;
}

function highlightsKey(date: string, timezone: string, limit: number, offset: number) {
  return `football:highlights:v1:${date}:${timezone}:${limit}:${offset}`;
}

function liveFeedKey(kind: "events" | "statistics", matchId: string) {
  return `football:${kind}:v1:${matchId}`;
}

function emptyFeedDisabledKey(kind: "events" | "statistics", matchId: string) {
  return `football:${kind}:disabled:v1:${matchId}`;
}

function lineupsKey(matchId: string) {
  return `football:lineups:v2:${matchId}`;
}

function lineupAttemptKey(matchId: string, bucket: "30m" | "15m") {
  return `football:lineups:attempt:v1:${matchId}:${bucket}`;
}

function lineupDisabledKey(matchId: string) {
  return `football:lineups:disabled:v1:${matchId}`;
}

function cachedSupplement<T>(value: T): CachedSupplement<T> {
  return { value, requestCount: 0 };
}

function shouldDisableEmptyLiveFeed(match: NormalizedMatch) {
  return match.status.group === "live" && typeof match.status.minute === "number" && match.status.minute >= EMPTY_LIVE_FEED_CUTOFF_MINUTE;
}

function hasTeamStatistics(statistics: ProviderTeamStatistics[] | null | undefined) {
  return Array.isArray(statistics) && statistics.some((group) => Array.isArray(group.statistics) && group.statistics.length > 0);
}

function preferNonEmptyList<T>(primary: T[] | null | undefined, fallback: T[] | null | undefined) {
  if (Array.isArray(primary) && primary.length > 0) return primary;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  return primary ?? fallback;
}

function preferNonEmptyStatistics(
  primary: ProviderTeamStatistics[] | null | undefined,
  fallback: ProviderTeamStatistics[] | null | undefined
) {
  if (hasTeamStatistics(primary)) return primary;
  if (hasTeamStatistics(fallback)) return fallback;
  return primary ?? fallback;
}

function hasLineupData(lineups: ProviderLineupsResponse | null | undefined) {
  return Boolean(
    lineups &&
      (hasLineupTeamData(lineups.homeTeam) || hasLineupTeamData(lineups.awayTeam))
  );
}

function hasLineupTeamData(team: ProviderLineupsResponse["homeTeam"]) {
  return Boolean(
    team &&
      (hasMeaningfulLineupFormation(team.formation) ||
        (Array.isArray(team.initialLineup) && team.initialLineup.some((row) => Array.isArray(row) && row.length > 0)) ||
        (Array.isArray(team.substitutes) && team.substitutes.length > 0))
  );
}

function hasMeaningfulLineupFormation(value: string | number | null | undefined) {
  if (value === null || value === undefined) return false;
  const formation = String(value).trim();
  return Boolean(formation && !/^(unknown|n\/a|na|none|null|-|—)$/i.test(formation));
}

function teamId(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value);
  return /^\d+$/.test(normalized) ? normalized : null;
}

function mergePersistedFinished(incoming: NormalizedMatch[], persistedFinished: NormalizedMatch[]) {
  const persistedById = new Map(persistedFinished.map((match) => [match.id, match]));
  const merged = new Map<string, NormalizedMatch>();

  for (const match of incoming) {
    if (match.status.group === "finished" && persistedById.has(match.id)) {
      merged.set(match.id, persistedById.get(match.id)!);
    } else {
      merged.set(match.id, match);
    }
  }

  for (const match of persistedFinished) {
    if (!merged.has(match.id)) {
      merged.set(match.id, match);
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function ttlFromEntry(entry: { expiresAt: string }) {
  const ttlMs = new Date(entry.expiresAt).getTime() - Date.now();
  return Math.max(30, Math.ceil(ttlMs / 1000));
}

function lockSnapshot(snapshot: ScoreboardSnapshot, appEnv: AppEnv): ScoreboardSnapshot {
  return {
    ...snapshot,
    refreshPolicy: {
      reason: "locked",
      providerRefreshSeconds: appEnv.finishedRefreshSeconds,
      clientRefreshSeconds: appEnv.clientRefreshSeconds,
      nextProviderRefreshAt: snapshot.expiresAt
    }
  };
}

function lockDetail(detail: MatchDetail, appEnv: AppEnv): MatchDetail {
  return {
    ...detail,
    refreshPolicy: {
      reason: "locked",
      providerRefreshSeconds: appEnv.finishedRefreshSeconds,
      clientRefreshSeconds: appEnv.clientRefreshSeconds,
      nextProviderRefreshAt: detail.expiresAt
    }
  };
}

function markSnapshotRefreshing(snapshot: ScoreboardSnapshot, retrySeconds = STALE_CLIENT_RETRY_SECONDS): ScoreboardSnapshot {
  const clientRetrySeconds = Math.max(10, Math.min(retrySeconds, STALE_CLIENT_BACKOFF_MAX_SECONDS));
  const retryAt = addSeconds(new Date(), clientRetrySeconds).toISOString();

  return {
    ...snapshot,
    expiresAt: retryAt,
    refreshPolicy: {
      ...snapshot.refreshPolicy,
      clientRefreshSeconds: Math.min(snapshot.refreshPolicy.clientRefreshSeconds, clientRetrySeconds),
      nextProviderRefreshAt: retryAt
    }
  };
}

function isProviderQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message.toLocaleLowerCase("en-US") : String(error).toLocaleLowerCase("en-US");
  return (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("requests remaining") ||
    message.includes("limit of requests")
  );
}
