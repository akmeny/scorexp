import type { FastifyInstance } from "fastify";
import type { ApiSportsClient } from "./apiSportsClient.js";
import type { MatchStore } from "./matchStore.js";
import { normalizeFixture, summarizeStatistics } from "./normalizer.js";
import {
  compareMatches,
  type MatchStatisticsSummary,
  type NormalizedMatch,
} from "./types.js";

interface MatchIdParams {
  id: string;
}

interface MatchesQuery {
  offset?: string;
  limit?: string;
  q?: string;
  liveOnly?: string;
  date?: string;
}

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"]);
const customDateCacheTtlMs = 5 * 60 * 1000;
const customDateCacheMaxEntries = 10;

interface MatchesRouteOptions {
  client: ApiSportsClient;
  scoreboardTimezone: string;
  providerEnabled: boolean;
}

interface CachedDateSnapshot {
  generatedAt: string;
  matches: NormalizedMatch[];
  expiresAt: number;
}

interface CachedMatchStatistics {
  statistics: MatchStatisticsSummary | null;
  expiresAt: number;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  max: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function filterMatches(
  matches: NormalizedMatch[],
  query: string,
  liveOnly: boolean,
): NormalizedMatch[] {
  return matches.filter((match) => {
    if (liveOnly && !liveStatuses.has(match.statusShort)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      match.homeTeam.name.toLowerCase().includes(query) ||
      match.awayTeam.name.toLowerCase().includes(query) ||
      match.leagueName.toLowerCase().includes(query) ||
      match.country.toLowerCase().includes(query)
    );
  });
}

export async function registerMatchesRoutes(
  app: FastifyInstance,
  store: MatchStore,
  options: MatchesRouteOptions,
): Promise<void> {
  const customDateCache = new Map<string, CachedDateSnapshot>();
  const matchStatisticsCache = new Map<number, CachedMatchStatistics>();

  const getStatisticsTtlMs = (match: NormalizedMatch): number =>
    liveStatuses.has(match.statusShort) ? 45_000 : 10 * 60 * 1000;

  const getMatchStatistics = async (
    match: NormalizedMatch,
  ): Promise<MatchStatisticsSummary | null> => {
    const cached = matchStatisticsCache.get(match.matchId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.statistics;
    }

    if (!options.providerEnabled) {
      return null;
    }

    try {
      const result = await options.client.getFixtureStatistics(match.matchId);
      const statistics = summarizeStatistics(
        result.data,
        match.homeTeam.id,
        match.awayTeam.id,
      );

      matchStatisticsCache.set(match.matchId, {
        statistics,
        expiresAt: Date.now() + getStatisticsTtlMs(match),
      });

      return statistics;
    } catch (error) {
      app.log.warn(
        {
          error,
          matchId: match.matchId,
        },
        "Failed to fetch match statistics",
      );

      return cached?.statistics ?? null;
    }
  };

  const getMatchesForDate = async (
    dateKey: string,
  ): Promise<{
    generatedAt: string;
    matches: NormalizedMatch[];
  }> => {
    const todayDateKey = formatDateKey(new Date(), options.scoreboardTimezone);

    if (dateKey === todayDateKey) {
      return {
        generatedAt: new Date().toISOString(),
        matches: store.getAll(),
      };
    }

    const cached = customDateCache.get(dateKey);

    if (cached && cached.expiresAt > Date.now()) {
      return {
        generatedAt: cached.generatedAt,
        matches: cached.matches,
      };
    }

    if (!options.providerEnabled) {
      return {
        generatedAt: new Date().toISOString(),
        matches: [],
      };
    }

    const result = await options.client.getFixturesByDate(
      dateKey,
      options.scoreboardTimezone,
    );
    const generatedAt = new Date().toISOString();
    const matches = result.data
      .map((fixture) => ({
        ...normalizeFixture(fixture, null),
        lastUpdatedAt: generatedAt,
      }))
      .sort(compareMatches);

    customDateCache.set(dateKey, {
      generatedAt,
      matches,
      expiresAt: Date.now() + customDateCacheTtlMs,
    });

    if (customDateCache.size > customDateCacheMaxEntries) {
      const oldestKey = customDateCache.keys().next().value;

      if (oldestKey) {
        customDateCache.delete(oldestKey);
      }
    }

    return {
      generatedAt,
      matches,
    };
  };

  const getSnapshot = async (request: { query: MatchesQuery }) => {
    const offset = parsePositiveInteger(request.query.offset, 0, 100_000);
    const hasExplicitLimit = typeof request.query.limit === "string";
    const limit = hasExplicitLimit
      ? parsePositiveInteger(request.query.limit, 80, 200)
      : null;
    const query = request.query.q?.trim().toLowerCase() ?? "";
    const liveOnly = parseBoolean(request.query.liveOnly);
    const dateKey =
      typeof request.query.date === "string" && request.query.date.trim().length > 0
        ? request.query.date.trim()
        : formatDateKey(new Date(), options.scoreboardTimezone);

    if (!isValidDateKey(dateKey)) {
      const error = new Error("Invalid date format") as Error & {
        statusCode?: number;
      };
      error.statusCode = 400;
      throw error;
    }

    const snapshot = await getMatchesForDate(dateKey);
    const filteredMatches = filterMatches(snapshot.matches, query, liveOnly);
    const pagedMatches =
      limit === null
        ? filteredMatches
        : filteredMatches.slice(offset, offset + limit);
    const nextOffset =
      limit !== null && offset + pagedMatches.length < filteredMatches.length
        ? offset + pagedMatches.length
        : null;

    return {
      matches: pagedMatches,
      generatedAt: snapshot.generatedAt,
      total: filteredMatches.length,
      offset,
      limit: limit ?? filteredMatches.length,
      nextOffset,
      hasMore: nextOffset !== null,
    };
  };

  app.get<{ Querystring: MatchesQuery }>("/api/matches/today", getSnapshot);
  app.get<{ Querystring: MatchesQuery }>("/api/matches/live", getSnapshot);

  app.get<{ Params: MatchIdParams }>("/api/matches/:id", async (request, reply) => {
    const matchId = Number(request.params.id);

    if (!Number.isInteger(matchId) || matchId <= 0) {
      return reply.code(400).send({
        error: "Invalid match id",
      });
    }

    const match = store.getById(matchId);

    if (!match) {
      return reply.code(404).send({
        error: "Match not found",
      });
    }

    const statistics = await getMatchStatistics(match);

    return {
      match,
      statistics,
      freshness: store.getFreshness(matchId),
    };
  });
}
