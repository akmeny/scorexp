import type { AppEnv } from "../config/env.js";
import {
  countMatches,
  createSnapshotChecksum,
  filterSnapshot,
  groupMatches,
  normalizeMatch,
  normalizeMatchDetail
} from "../domain/normalize.js";
import type {
  MatchDetail,
  MatchDetailCacheEntry,
  NormalizedMatch,
  ProviderMatch,
  ProviderStandingsResponse,
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
const LIVE_REFRESH_SECONDS = 100;

interface ScoreboardQuery {
  date: string;
  timezone: string;
  view: ScoreboardView;
}

interface MatchDetailQuery {
  matchId: string;
  timezone: string;
}

export class ScoreboardService {
  private readonly inFlight = new Map<string, Promise<SnapshotCacheEntry>>();
  private readonly detailInFlight = new Map<string, Promise<MatchDetailCacheEntry>>();

  constructor(
    private readonly appEnv: AppEnv,
    private readonly highlightly: HighlightlyClient,
    private readonly cache: HotCache,
    private readonly store: DurableStore
  ) {}

  async getScoreboard(query: ScoreboardQuery): Promise<ScoreboardSnapshot> {
    const key = snapshotKey(query.date, query.timezone);
    const completedDate = await this.store.getCompletedDate(key);

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

    try {
      const fresh = await this.refresh(key, query.date, query.timezone);
      return filterSnapshot(fresh.snapshot, query.view);
    } catch (error) {
      const staleFallback = cached ?? durable;
      if (staleFallback) {
        return filterSnapshot(staleFallback.snapshot, query.view);
      }

      throw error;
    }
  }

  async getMatchDetail(query: MatchDetailQuery): Promise<MatchDetail> {
    const key = matchDetailKey(query.matchId, query.timezone);
    const cached = await this.cache.get<MatchDetailCacheEntry>(key);

    if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
      return cached.detail;
    }

    const fresh = await this.refreshMatchDetail(key, query.matchId, query.timezone);
    return fresh.detail;
  }

  async warmScoreboard(date: string, timezone: string): Promise<void> {
    await this.getScoreboard({ date, timezone, view: "all" });
  }

  private async refresh(key: string, date: string, timezone: string): Promise<SnapshotCacheEntry> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = this.fetchAndBuild(key, date, timezone).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  private async refreshMatchDetail(key: string, matchId: string, timezone: string): Promise<MatchDetailCacheEntry> {
    const existing = this.detailInFlight.get(key);
    if (existing) return existing;

    const promise = this.fetchAndBuildMatchDetail(key, matchId, timezone).finally(() => {
      this.detailInFlight.delete(key);
    });

    this.detailInFlight.set(key, promise);
    return promise;
  }

  private async fetchAndBuild(key: string, date: string, timezone: string): Promise<SnapshotCacheEntry> {
    const fetchedAt = new Date().toISOString();
    const response = await this.highlightly.getMatchesByDate(date, timezone);
    const normalized = response.matches.map((match) => normalizeMatch(match, timezone, fetchedAt));
    const cardEnrichment = await this.enrichLiveMatchCards(normalized, timezone, fetchedAt);
    const incoming = cardEnrichment.matches;
    const persistedFinished = await this.store.getFinishedMatches(key);
    const merged = mergePersistedFinished(incoming, persistedFinished);
    const newlyFinished = merged.filter((match) => match.status.group === "finished");

    await this.store.saveFinishedMatches(key, newlyFinished);

    const snapshot = this.buildSnapshot(date, timezone, merged, fetchedAt);
    const entry: SnapshotCacheEntry = {
      snapshot,
      fetchedAt,
      expiresAt: snapshot.expiresAt,
      providerRequestCount: response.requestCount + cardEnrichment.requestCount
    };

    await this.cache.set(key, entry, ttlFromEntry(entry));
    await this.store.saveSnapshot(key, entry);

    const isPast = isBeforeLocalDate(date, timezone);
    const canLockDate = isPast && merged.every((match) => match.status.group === "finished");
    if (canLockDate) {
      await this.store.markDateCompleted(key, merged.length, fetchedAt);
    }

    return entry;
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

    const statusGroup = normalizeMatch(response.match, timezone, fetchedAt).status.group;
    const refreshPolicy = this.pickDetailRefreshPolicy(statusGroup, new Date());
    const context = await this.getMatchContext(response.match, timezone);
    const detail = normalizeMatchDetail(
      response.match,
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
      providerRequestCount: response.requestCount
    };

    await this.cache.set(key, entry, ttlFromEntry(entry));
    return entry;
  }

  private async getMatchContext(match: ProviderMatch, timezone: string) {
    const homeTeamId = teamId(match.homeTeam?.id);
    const awayTeamId = teamId(match.awayTeam?.id);
    const leagueId = teamId(match.league?.id);
    const season = match.league?.season !== undefined && match.league.season !== null ? String(match.league.season) : null;

    const [headToHead, homeForm, awayForm, standings] = await Promise.all([
      homeTeamId && awayTeamId
        ? this.getCachedSupplement<ProviderMatch[]>(
            `football:h2h:${[homeTeamId, awayTeamId].sort().join(":")}`,
            86_400,
            () => this.highlightly.getHeadToHead(homeTeamId, awayTeamId),
            []
          )
        : Promise.resolve([]),
      homeTeamId
        ? this.getCachedSupplement<ProviderMatch[]>(`football:form:${homeTeamId}`, 21_600, () =>
            this.highlightly.getLastFiveGames(homeTeamId),
            []
          )
        : Promise.resolve([]),
      awayTeamId
        ? this.getCachedSupplement<ProviderMatch[]>(`football:form:${awayTeamId}`, 21_600, () =>
            this.highlightly.getLastFiveGames(awayTeamId),
            []
          )
        : Promise.resolve([]),
      leagueId && season
        ? this.getCachedSupplement<ProviderStandingsResponse | null>(
            `football:standings:${leagueId}:${season}:${timezone}`,
            900,
            () => this.highlightly.getStandings(leagueId, season),
            null
          )
        : Promise.resolve(null)
    ]);

    return {
      headToHead,
      homeForm,
      awayForm,
      standings
    };
  }

  private async getCachedSupplement<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    const cached = await this.cache.get<{ value: T }>(key);
    if (cached) return cached.value;

    try {
      const fresh = await fetcher();
      await this.cache.set(key, { value: fresh }, ttlSeconds);
      return fresh;
    } catch {
      return fallback;
    }
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
    const providerRefreshSeconds =
      reason === "live"
        ? LIVE_REFRESH_SECONDS
        : reason === "finished"
          ? this.appEnv.finishedRefreshSeconds
          : this.appEnv.upcomingRefreshSeconds;

    return {
      reason,
      providerRefreshSeconds,
      clientRefreshSeconds: reason === "live" ? LIVE_REFRESH_SECONDS : this.appEnv.clientRefreshSeconds,
      nextProviderRefreshAt: addSeconds(now, providerRefreshSeconds).toISOString()
    };
  }

  private pickDetailRefreshPolicy(statusGroup: NormalizedMatch["status"]["group"], now: Date): RefreshPolicy {
    const reason = statusGroup === "live" ? "live" : statusGroup === "finished" ? "finished" : "upcoming";
    const providerRefreshSeconds =
      reason === "live"
        ? LIVE_REFRESH_SECONDS
        : reason === "finished"
          ? this.appEnv.finishedRefreshSeconds
          : this.appEnv.upcomingRefreshSeconds;

    return {
      reason,
      providerRefreshSeconds,
      clientRefreshSeconds: providerRefreshSeconds,
      nextProviderRefreshAt: addSeconds(now, providerRefreshSeconds).toISOString()
    };
  }
}

function snapshotKey(date: string, timezone: string) {
  return `football:v4:${date}:${timezone}`;
}

function matchDetailKey(matchId: string, timezone: string) {
  return `football:match-detail:v5:${matchId}:${timezone}`;
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
