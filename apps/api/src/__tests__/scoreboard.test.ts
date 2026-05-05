import { describe, expect, it } from "vitest";
import type { AppEnv } from "../config/env.js";
import type { ProviderMatch, ScoreboardSnapshot, SnapshotCacheEntry } from "../domain/types.js";
import type { HighlightlyClient, HighlightlyFetchResult, HighlightlyMatchDetailResult } from "../provider/highlightly.js";
import { ScoreboardService } from "../services/scoreboard.js";
import type { HotCache } from "../storage/cache.js";
import type { DurableStore } from "../storage/jsonStore.js";

const appEnv = {
  liveRefreshSeconds: 100,
  upcomingRefreshSeconds: 900,
  finishedRefreshSeconds: 86_400,
  clientRefreshSeconds: 100
} as AppEnv;

describe("scoreboard service loading strategy", () => {
  it("returns a stale snapshot immediately while a background refresh starts", async () => {
    const staleEntry = snapshotEntry({
      fetchedAt: new Date(Date.now() - 300_000).toISOString(),
      expiresAt: new Date(Date.now() - 120_000).toISOString(),
      matches: [providerMatch({ id: 1, state: "Not started" })]
    });
    const cache = new MemoryCache();
    const store = new MemoryStore(staleEntry);
    const deferredMatches = deferred<HighlightlyFetchResult>();
    const highlightly = {
      getMatchesByDate: () => deferredMatches.promise
    } as unknown as HighlightlyClient;
    const service = new ScoreboardService(appEnv, highlightly, cache, store);

    const snapshot = await service.getScoreboard({
      date: staleEntry.snapshot.date,
      timezone: staleEntry.snapshot.timezone,
      view: "all"
    });

    expect(snapshot.checksum).toBe(staleEntry.snapshot.checksum);
    expect(snapshot.refreshPolicy.clientRefreshSeconds).toBe(10);

    deferredMatches.resolve({
      matches: [providerMatch({ id: 2, state: "Not started" })],
      requestCount: 1,
      rateLimit: { limit: null, remaining: null }
    });
  });

  it("does not wait for live card enrichment before returning the match list", async () => {
    const cache = new MemoryCache();
    const store = new MemoryStore();
    const deferredDetail = deferred<HighlightlyMatchDetailResult>();
    const highlightly = {
      getMatchesByDate: async () => ({
        matches: [providerMatch({ id: 10, state: "First half" })],
        requestCount: 1,
        rateLimit: { limit: null, remaining: null }
      }),
      getMatchById: () => deferredDetail.promise
    } as unknown as HighlightlyClient;
    const service = new ScoreboardService(appEnv, highlightly, cache, store);

    const snapshot = await service.getScoreboard({
      date: "2026-05-05",
      timezone: "Europe/Istanbul",
      view: "all"
    });

    expect(snapshot.counts.live).toBe(1);
    expect(snapshot.counts.all).toBe(1);

    deferredDetail.resolve({
      match: null,
      requestCount: 1,
      rateLimit: { limit: null, remaining: null }
    });
  });
});

class MemoryCache implements HotCache {
  values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async close(): Promise<void> {
    this.values.clear();
  }
}

class MemoryStore implements DurableStore {
  snapshots = new Map<string, SnapshotCacheEntry>();

  constructor(initialSnapshot?: SnapshotCacheEntry) {
    if (initialSnapshot) {
      this.snapshots.set(`football:v4:${initialSnapshot.snapshot.date}:${initialSnapshot.snapshot.timezone}`, initialSnapshot);
    }
  }

  async getSnapshot(key: string): Promise<SnapshotCacheEntry | null> {
    return this.snapshots.get(key) ?? null;
  }

  async saveSnapshot(key: string, snapshot: SnapshotCacheEntry): Promise<void> {
    this.snapshots.set(key, snapshot);
  }

  async getFinishedMatches() {
    return [];
  }

  async saveFinishedMatches() {
    return undefined;
  }

  async getCompletedDate() {
    return null;
  }

  async markDateCompleted() {
    return undefined;
  }
}

function snapshotEntry(options: { fetchedAt: string; expiresAt: string; matches: ProviderMatch[] }): SnapshotCacheEntry {
  const snapshot: ScoreboardSnapshot = {
    id: "2026-05-05:Europe/Istanbul",
    date: "2026-05-05",
    timezone: "Europe/Istanbul",
    generatedAt: options.fetchedAt,
    sourceUpdatedAt: options.fetchedAt,
    expiresAt: options.expiresAt,
    checksum: "stale-checksum",
    view: "all",
    refreshPolicy: {
      reason: "upcoming",
      providerRefreshSeconds: 900,
      clientRefreshSeconds: 100,
      nextProviderRefreshAt: options.expiresAt
    },
    counts: { all: options.matches.length, live: 0, finished: 0, upcoming: options.matches.length, unknown: 0 },
    leagues: [
      {
        key: "TR:1",
        country: { code: "TR", name: "Turkey", logo: null },
        league: { id: "1", name: "Super Lig", logo: null, season: "2026" },
        isTopTier: true,
        counts: { live: 0, finished: 0, upcoming: options.matches.length, unknown: 0 },
        matches: options.matches.map((match) => ({
          id: String(match.id),
          providerId: String(match.id),
          round: null,
          date: match.date ?? options.fetchedAt,
          localTime: "20:00",
          timestamp: Date.parse(match.date ?? options.fetchedAt),
          country: { code: "TR", name: "Turkey", logo: null },
          league: { id: "1", name: "Super Lig", logo: null, season: "2026" },
          homeTeam: { id: "1", name: "Home", logo: null },
          awayTeam: { id: "2", name: "Away", logo: null },
          status: { description: "Not started", group: "upcoming", minute: null },
          score: { home: null, away: null, penaltiesHome: null, penaltiesAway: null, raw: null, penaltiesRaw: null },
          redCards: { home: 0, away: 0 },
          isTopTier: true,
          lastUpdatedAt: options.fetchedAt,
          source: "highlightly"
        }))
      }
    ]
  };

  return {
    snapshot,
    fetchedAt: options.fetchedAt,
    expiresAt: options.expiresAt,
    providerRequestCount: 1
  };
}

function providerMatch(options: { id: number; state: string }): ProviderMatch {
  return {
    id: options.id,
    date: "2026-05-05T17:00:00.000Z",
    country: { code: "TR", name: "Turkey", logo: null },
    league: { id: 1, name: "Super Lig", season: 2026, logo: null },
    homeTeam: { id: 1, name: "Home", logo: null },
    awayTeam: { id: 2, name: "Away", logo: null },
    state: {
      description: options.state,
      clock: options.state === "First half" ? 12 : null,
      score: { current: options.state === "First half" ? "0 - 0" : null, penalties: null }
    }
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}
