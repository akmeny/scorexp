import type { FastifyInstance } from "fastify";
import type { ApiSportsClient } from "./apiSportsClient.js";
import { MatchDetailService } from "./matchDetailService.js";
import type { MatchStore } from "./matchStore.js";
import {
  normalizeFixture,
  normalizeRecentForm,
  summarizeStatistics,
} from "./normalizer.js";
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

type MatchFormResult = "W" | "D" | "L" | "U";

interface MatchFormSnapshot {
  last5: MatchFormResult[];
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
const emptyFormCacheTtlMs = 60 * 60 * 1000;
const formFetchConcurrency = 4;

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

function normalizePredictionForm(
  form: string | null | undefined,
): MatchFormResult[] | null {
  if (!form) {
    return null;
  }

  const entries = [...form.trim().toUpperCase()]
    .map((value) => {
      if (value === "W" || value === "D" || value === "L") {
        return value;
      }

      return "U";
    })
    .filter((value) => value !== "U");

  if (entries.length === 0) {
    return null;
  }

  return entries.slice(-5) as MatchFormResult[];
}

function createFormSnapshot(
  last5: MatchFormResult[] | null,
  updatedAt: string,
): MatchFormSnapshot | null {
  if (!last5 || last5.length === 0) {
    return null;
  }

  return {
    last5,
    updatedAt,
  };
}

function isPreMatchStatus(statusShort: string): boolean {
  return preMatchStatuses.has(statusShort);
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

    try {
      const result = await options.client.getRecentFixturesForTeam(teamId, 5);
      const last5 = normalizeRecentForm(result.data, teamId)
        .slice(0, 5)
        .map((entry) => entry.result)
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
        },
        "Failed to fetch recent team form",
      );

      teamFormCache.set(teamId, {
        form: null,
        expiresAt: Date.now() + emptyFormCacheTtlMs,
      });

      return null;
    }
  };

  const getMatchForm = async (
    match: NormalizedMatch,
  ): Promise<{
    homeForm: MatchFormSnapshot | null;
    awayForm: MatchFormSnapshot | null;
  }> => {
    const cached = matchFormCache.get(match.matchId);

    if (cached && cached.expiresAt > Date.now()) {
      return {
        homeForm: cached.homeForm,
        awayForm: cached.awayForm,
      };
    }

    if (!options.providerEnabled || !isPreMatchStatus(match.statusShort)) {
      return {
        homeForm: null,
        awayForm: null,
      };
    }

    let homeForm: MatchFormSnapshot | null = null;
    let awayForm: MatchFormSnapshot | null = null;

    try {
      const predictionResult = await options.client.getPredictions(match.matchId);
      const prediction = predictionResult.data[0];
      const updatedAt = new Date().toISOString();

      homeForm = createFormSnapshot(
        normalizePredictionForm(prediction?.teams?.home?.last_5?.form),
        updatedAt,
      );
      awayForm = createFormSnapshot(
        normalizePredictionForm(prediction?.teams?.away?.last_5?.form),
        updatedAt,
      );
    } catch (error) {
      app.log.warn(
        {
          error,
          matchId: match.matchId,
        },
        "Failed to fetch pre-match prediction form",
      );
    }

    if (!homeForm) {
      homeForm = await getTeamRecentForm(match.homeTeam.id);
    }

    if (!awayForm) {
      awayForm = await getTeamRecentForm(match.awayTeam.id);
    }

    matchFormCache.set(match.matchId, {
      homeForm,
      awayForm,
      expiresAt:
        Date.now() +
        (homeForm || awayForm ? matchFormCacheTtlMs : emptyFormCacheTtlMs),
    });

    return {
      homeForm,
      awayForm,
    };
  };

  const mapWithConcurrency = async <T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>,
  ): Promise<R[]> => {
    const results = new Array<R>(items.length);
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        results[currentIndex] = await mapper(items[currentIndex] as T);
      }
    };

    await Promise.all(
      Array.from(
        {
          length: Math.min(concurrency, items.length),
        },
        () => worker(),
      ),
    );

    return results;
  };

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
    const indexedMatches = matches.map((match, index) => ({
      match,
      index,
    }));
    const nextMatches = [...matches];
    const candidates = indexedMatches.filter(({ match }) =>
      isPreMatchStatus(match.statusShort),
    );

    const enriched = await mapWithConcurrency(
      candidates,
      formFetchConcurrency,
      async ({ match, index }) => ({
        index,
        forms: await getMatchForm(match),
      }),
    );

    for (const entry of enriched) {
      const match = matches[entry.index];

      if (!match) {
        continue;
      }

      nextMatches[entry.index] = {
        ...match,
        homeForm: entry.forms.homeForm,
        awayForm: entry.forms.awayForm,
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
