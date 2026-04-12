import type { FastifyInstance } from "fastify";
import { withRetry } from "../../lib/retry.js";
import type { ApiSportsClient } from "./apiSportsClient.js";
import { ApiSportsError } from "./apiSportsClient.js";
import { MatchDetailService } from "./matchDetailService.js";
import type { MatchStore } from "./matchStore.js";
import {
  normalizeFixture,
  normalizeRecentForm,
  summarizeStatistics,
} from "./normalizer.js";
import {
  compareMatches,
  type MatchFormEntry,
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

interface MatchFormSnapshot {
  last5: MatchFormEntry[];
  updatedAt: string;
}

interface CachedMatchForm {
  homeForm: MatchFormSnapshot | null;
  awayForm: MatchFormSnapshot | null;
  expiresAt: number;
}

interface CachedTeamForm {
  form: MatchFormSnapshot | null;
  expiresAt: number;
}

interface LeagueFavoriteRule {
  country?: string | RegExp;
  league: RegExp;
}

const defaultFavoriteRules: readonly LeagueFavoriteRule[] = [
  { country: "turkey", league: /^super-lig$/ },
  { country: "turkey", league: /^1-lig$/ },
  { country: "turkey", league: /^(?:ziraat-turkiye-kupasi|turkiye-kupasi|cup)$/ },
  { country: "turkey", league: /^super-cup$/ },
  { country: "europe", league: /uefa-champions-league(?!-women)/ },
  { country: "europe", league: /uefa-europa-league/ },
  { country: "europe", league: /uefa-europa-conference-league|uefa-conference-league/ },
  { country: "europe", league: /uefa-super-cup/ },
  { country: "world", league: /fifa-club-world-cup|club-world-cup/ },
  { country: "world", league: /world-cup(?!-u)/ },
  {
    country: "europe",
    league: /uefa-european-championship|euro-championship|european-championship/,
  },
  { country: "europe", league: /uefa-nations-league|nations-league/ },
  { country: "north-america", league: /concacaf-nations-league/ },
  { country: "south-america", league: /copa-america/ },
  { country: "asia", league: /asian-cup/ },
  { country: "africa", league: /africa-cup-of-nations/ },
  { country: "north-america", league: /concacaf-gold-cup/ },
  { country: "south-america", league: /copa-libertadores|conmebol-libertadores/ },
  { country: "south-america", league: /copa-sudamericana|conmebol-sudamericana/ },
  { country: "north-america", league: /concacaf-champions-cup|concacaf-champions-league/ },
  { country: "asia", league: /afc-champions-league/ },
  { country: "africa", league: /caf-champions-league/ },
  { country: "england", league: /^premier-league$/ },
  { country: "england", league: /^championship$/ },
  { country: "germany", league: /^bundesliga$/ },
  { country: "spain", league: /^la-liga$/ },
  { country: "germany", league: /^2-bundesliga$/ },
  { country: "italy", league: /^serie-a$/ },
  { country: "france", league: /^ligue-1$/ },
  { country: "netherlands", league: /^eredivisie$/ },
  { country: "netherlands", league: /^eerste-divisie$/ },
  { country: "portugal", league: /^primeira-liga$/ },
  { country: "belgium", league: /pro-league|jupiler-pro-league/ },
  { country: "scotland", league: /premiership$/ },
  { country: "switzerland", league: /^super-league$/ },
  { country: "austria", league: /^bundesliga$/ },
  { country: "denmark", league: /^superliga$/ },
  { country: "norway", league: /^eliteserien$/ },
  { country: "sweden", league: /^allsvenskan$/ },
  { country: "sweden", league: /^superettan$/ },
  { country: "czech-republic", league: /^czech-liga$|^first-league$/ },
  { country: "poland", league: /^ekstraklasa$/ },
  { country: "greece", league: /^super-league-1$/ },
  { country: "croatia", league: /^hnl$/ },
  { country: "serbia", league: /^super-liga$/ },
  { country: "ukraine", league: /^premier-league$/ },
  { country: "brazil", league: /^serie-a$/ },
  { country: /united-states|usa/, league: /^major-league-soccer$/ },
  { country: "australia", league: /^a-league$/ },
  { country: "japan", league: /^j1-league$/ },
  { country: "south-korea", league: /^k-league-1$/ },
  { country: "argentina", league: /liga-profesional-argentina|primera-division/ },
  { country: "mexico", league: /^liga-mx$/ },
  { country: "colombia", league: /primera-a/ },
  { country: "china", league: /^super-league$/ },
  { country: "saudi-arabia", league: /^pro-league$/ },
  { country: "azerbaijan", league: /premyer-liqa|premier-league/ },
  { country: "romania", league: /^liga-i$/ },
];

const preMatchStatuses = new Set(["NS", "TBD"]);
const matchFormCacheTtlMs = 6 * 60 * 60 * 1000;
const emptyFormCacheTtlMs = 2 * 60 * 1000;
const errorFormCacheTtlMs = 2 * 60 * 1000;
const partialMatchFormCacheTtlMs = 2 * 60 * 1000;
const inlineTeamFormFetchBudget = 4;
const queuedTeamFormRefreshIntervalMs = 2 * 60 * 1000;
const queuedTeamFormRefreshBudget = 18;

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

function createFormSnapshot(
  entries: Array<{
    result: MatchFormEntry["result"];
    opponentName: string;
    isHome: boolean;
    goalsFor: number | null;
    goalsAgainst: number | null;
  }>,
  updatedAt: string,
): MatchFormSnapshot | null {
  if (entries.length === 0) {
    return null;
  }

  return {
    last5: entries.slice(0, 5),
    updatedAt,
  };
}

function isPreMatchStatus(statusShort: string): boolean {
  return preMatchStatuses.has(statusShort);
}

function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof ApiSportsError) {
    return error.isRetryable;
  }

  return true;
}

function normalizeLeagueValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function matchesCountryRule(
  normalizedCountry: string,
  countryRule: LeagueFavoriteRule["country"],
): boolean {
  if (!countryRule) {
    return true;
  }

  if (typeof countryRule === "string") {
    return normalizedCountry === countryRule;
  }

  return countryRule.test(normalizedCountry);
}

function getDefaultLeagueFavoritePriority(
  match: Pick<NormalizedMatch, "country" | "leagueName">,
): number | null {
  const normalizedCountry = normalizeLeagueValue(match.country);
  const normalizedLeague = normalizeLeagueValue(match.leagueName);

  for (const [index, rule] of defaultFavoriteRules.entries()) {
    if (!matchesCountryRule(normalizedCountry, rule.country)) {
      continue;
    }

    if (rule.league.test(normalizedLeague)) {
      return index;
    }
  }

  return null;
}

function compareMatchesForScoreboardPage(
  left: Pick<NormalizedMatch, "country" | "leagueId" | "leagueName" | "startTime" | "matchId">,
  right: Pick<
    NormalizedMatch,
    "country" | "leagueId" | "leagueName" | "startTime" | "matchId"
  >,
): number {
  const leftPriority = getDefaultLeagueFavoritePriority(left);
  const rightPriority = getDefaultLeagueFavoritePriority(right);
  const leftIsFavorite = leftPriority !== null;
  const rightIsFavorite = rightPriority !== null;

  if (leftIsFavorite !== rightIsFavorite) {
    return leftIsFavorite ? -1 : 1;
  }

  if (leftIsFavorite && rightIsFavorite && leftPriority !== rightPriority) {
    return (leftPriority ?? Number.POSITIVE_INFINITY) -
      (rightPriority ?? Number.POSITIVE_INFINITY);
  }

  const countryDelta = left.country.localeCompare(right.country);
  if (countryDelta !== 0) {
    return countryDelta;
  }

  const leagueDelta = left.leagueName.localeCompare(right.leagueName);
  if (leagueDelta !== 0) {
    return leagueDelta;
  }

  const leagueIdDelta = left.leagueId - right.leagueId;
  if (leagueIdDelta !== 0) {
    return leagueIdDelta;
  }

  const kickoffDelta =
    new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
  if (kickoffDelta !== 0) {
    return kickoffDelta;
  }

  return left.matchId - right.matchId;
}

function getLeaguePageKey(match: Pick<NormalizedMatch, "country" | "leagueId">): string {
  return `${match.country}:${match.leagueId}`;
}

function paginateMatchesByLeague(
  matches: NormalizedMatch[],
  offset: number,
  limit: number | null,
): {
  pagedMatches: NormalizedMatch[];
  nextOffset: number | null;
} {
  if (limit === null) {
    return {
      pagedMatches: matches,
      nextOffset: null,
    };
  }

  if (offset >= matches.length) {
    return {
      pagedMatches: [],
      nextOffset: null,
    };
  }

  let end = Math.min(offset + limit, matches.length);

  if (end < matches.length && end > offset) {
    const boundaryMatch = matches[end - 1];
    if (!boundaryMatch) {
      return {
        pagedMatches: matches.slice(offset, end),
        nextOffset: end < matches.length ? end : null,
      };
    }

    const boundaryGroupKey = getLeaguePageKey(boundaryMatch);

    while (end < matches.length) {
      const currentMatch = matches[end];

      if (!currentMatch || getLeaguePageKey(currentMatch) !== boundaryGroupKey) {
        break;
      }

      end += 1;
    }
  }

  return {
    pagedMatches: matches.slice(offset, end),
    nextOffset: end < matches.length ? end : null,
  };
}

export async function registerMatchesRoutes(
  app: FastifyInstance,
  store: MatchStore,
  options: MatchesRouteOptions,
): Promise<void> {
  const customDateCache = new Map<string, CachedDateSnapshot>();
  const matchStatisticsCache = new Map<number, CachedMatchStatistics>();
  const matchFormCache = new Map<number, CachedMatchForm>();
  const teamFormCache = new Map<number, CachedTeamForm>();
  const teamFormInFlight = new Map<number, Promise<MatchFormSnapshot | null>>();
  const queuedTeamFormIds = new Set<number>();
  const queuedTeamFormOrder: number[] = [];
  let queuedTeamRefreshInFlight = false;
  const matchDetailService = new MatchDetailService(
    options.client,
    app.log.child({
      module: "match-detail",
    }),
    options.providerEnabled,
  );

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

  const getTeamRecentForm = async (
    teamId: number,
  ): Promise<MatchFormSnapshot | null> => {
    const cached = teamFormCache.get(teamId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.form;
    }

    if (!options.providerEnabled) {
      return null;
    }

    const inFlight = teamFormInFlight.get(teamId);

    if (inFlight) {
      return inFlight;
    }

    const loadForm = async (): Promise<MatchFormSnapshot | null> => {
      try {
        const result = await withRetry(
          () => options.client.getRecentFixturesForTeam(teamId, 10),
          {
            retries: 1,
            minDelayMs: 500,
            factor: 2,
            shouldRetry: isRetryableProviderError,
            onRetry: async (error, attempt, nextDelayMs) => {
              app.log.warn(
                {
                  error,
                  teamId,
                  attempt,
                  nextDelayMs,
                },
                "Retrying recent team form fetch",
              );
            },
          },
        );
        const last5 = normalizeRecentForm(result.data, teamId)
          .filter((entry) => entry.result !== "U")
          .slice(0, 5)
          .map((entry) => ({
            result: entry.result,
            opponentName: entry.opponentName,
            isHome: entry.isHome,
            goalsFor: entry.goalsFor,
            goalsAgainst: entry.goalsAgainst,
          }))
          .reverse();
        const form = createFormSnapshot(last5, new Date().toISOString());

        teamFormCache.set(teamId, {
          form,
          expiresAt: Date.now() + (form ? matchFormCacheTtlMs : emptyFormCacheTtlMs),
        });

        return form;
      } catch (error) {
        app.log.warn(
          {
            error,
            teamId,
            staleCacheAvailable: Boolean(cached?.form),
          },
          "Failed to fetch recent team form",
        );

        if (cached?.form) {
          teamFormCache.set(teamId, {
            form: cached.form,
            expiresAt: Date.now() + errorFormCacheTtlMs,
          });

          return cached.form;
        }

        teamFormCache.set(teamId, {
          form: null,
          expiresAt: Date.now() + errorFormCacheTtlMs,
        });

        return null;
      } finally {
        teamFormInFlight.delete(teamId);
      }
    };

    const request = loadForm();
    teamFormInFlight.set(teamId, request);

    try {
      return await request;
    } finally {
      teamFormInFlight.delete(teamId);
    }
  };

  const enqueueMissingTeamForm = (teamId: number): void => {
    if (queuedTeamFormIds.has(teamId) || teamFormInFlight.has(teamId)) {
      return;
    }

    queuedTeamFormIds.add(teamId);
    queuedTeamFormOrder.push(teamId);
  };

  const getCachedTeamForm = (teamId: number): MatchFormSnapshot | null => {
    const cached = teamFormCache.get(teamId);

    if (!cached || cached.expiresAt <= Date.now()) {
      return null;
    }

    return cached.form;
  };

  const refreshQueuedTeamForms = async (): Promise<void> => {
    if (
      queuedTeamRefreshInFlight ||
      !options.providerEnabled ||
      queuedTeamFormOrder.length === 0
    ) {
      return;
    }

    queuedTeamRefreshInFlight = true;

    try {
      let processed = 0;

      while (
        processed < queuedTeamFormRefreshBudget &&
        queuedTeamFormOrder.length > 0
      ) {
        const teamId = queuedTeamFormOrder.shift();

        if (typeof teamId !== "number") {
          continue;
        }

        queuedTeamFormIds.delete(teamId);

        const cached = getCachedTeamForm(teamId);

        if (cached) {
          continue;
        }

        await getTeamRecentForm(teamId);
        processed += 1;
      }

      if (processed > 0) {
        app.log.info(
          {
            processed,
            queuedRemaining: queuedTeamFormOrder.length,
          },
          "Refreshed queued missing team forms",
        );
      }
    } finally {
      queuedTeamRefreshInFlight = false;
    }
  };

  const queuedTeamRefreshTimer = setInterval(() => {
    void refreshQueuedTeamForms();
  }, queuedTeamFormRefreshIntervalMs);

  app.addHook("onClose", async () => {
    clearInterval(queuedTeamRefreshTimer);
  });

  const enrichMatchesWithForm = async (
    matches: NormalizedMatch[],
  ): Promise<
    Array<
      NormalizedMatch & {
        homeForm?: MatchFormSnapshot | null;
        awayForm?: MatchFormSnapshot | null;
      }
    >
  > => {
    const nextMatches = [...matches];
    const visibleTeamForms = new Map<number, MatchFormSnapshot | null>();
    let remainingInlineBudget = inlineTeamFormFetchBudget;

    const getVisibleTeamForm = async (
      teamId: number,
    ): Promise<MatchFormSnapshot | null> => {
      if (visibleTeamForms.has(teamId)) {
        return visibleTeamForms.get(teamId) ?? null;
      }

      const cached = getCachedTeamForm(teamId);

      if (cached) {
        visibleTeamForms.set(teamId, cached);
        return cached;
      }

      enqueueMissingTeamForm(teamId);

      if (remainingInlineBudget <= 0) {
        visibleTeamForms.set(teamId, null);
        return null;
      }

      remainingInlineBudget -= 1;
      const form = await getTeamRecentForm(teamId);
      visibleTeamForms.set(teamId, form);

      if (!form) {
        enqueueMissingTeamForm(teamId);
      }

      return form;
    };

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];

      if (!match || !isPreMatchStatus(match.statusShort)) {
        continue;
      }

      const cachedMatch = matchFormCache.get(match.matchId);

      if (cachedMatch && cachedMatch.expiresAt > Date.now()) {
        nextMatches[index] = {
          ...match,
          homeForm: cachedMatch.homeForm,
          awayForm: cachedMatch.awayForm,
        };
        continue;
      }

      const homeForm = await getVisibleTeamForm(match.homeTeam.id);
      const awayForm = await getVisibleTeamForm(match.awayTeam.id);
      const hasCompleteForm = Boolean(homeForm) && Boolean(awayForm);
      const hasPartialForm = Boolean(homeForm) !== Boolean(awayForm);

      matchFormCache.set(match.matchId, {
        homeForm,
        awayForm,
        expiresAt:
          Date.now() +
          (hasCompleteForm
            ? matchFormCacheTtlMs
            : hasPartialForm
              ? partialMatchFormCacheTtlMs
              : emptyFormCacheTtlMs),
      });

      nextMatches[index] = {
        ...match,
        homeForm,
        awayForm,
      };
    }

    return nextMatches;
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
    const filteredMatches = filterMatches(snapshot.matches, query, liveOnly).sort(
      compareMatchesForScoreboardPage,
    );
    const { pagedMatches, nextOffset } = paginateMatchesByLeague(
      filteredMatches,
      offset,
      limit,
    );
    const enrichedMatches = await enrichMatchesWithForm(pagedMatches);

    return {
      matches: enrichedMatches,
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

  app.get<{ Params: MatchIdParams }>(
    "/api/matches/:id/detail",
    async (request, reply) => {
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

      const detail = await matchDetailService.getDetail(match);

      return {
        match,
        detail,
        freshness: store.getFreshness(matchId),
      };
    },
  );
}
