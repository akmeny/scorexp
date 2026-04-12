import type {
  ProviderFixtureEventResponse,
  ProviderFixtureStatisticsResponse,
  ProviderFixtureResponse,
} from "../../types/provider.js";
import type {
  MatchEventSummaryItem,
  MatchEventsSummary,
  NormalizedMatchInput,
  MatchStatisticsSummary,
} from "./types.js";

function normalizeTimestamp(fixture: ProviderFixtureResponse["fixture"]): string {
  if (fixture.date) {
    return fixture.date;
  }

  if (fixture.timestamp) {
    return new Date(fixture.timestamp * 1000).toISOString();
  }

  return new Date().toISOString();
}

function scoreOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" ? value : null;
}

export function normalizeFixture(
  fixture: ProviderFixtureResponse,
  eventSummary: MatchEventsSummary | null,
): NormalizedMatchInput {
  return {
    matchId: fixture.fixture.id,
    leagueId: fixture.league.id,
    leagueName: fixture.league.name?.trim() || "Unknown League",
    country: fixture.league.country?.trim() || "Unknown Country",
    countryFlag: fixture.league.flag?.trim() || "",
    startTime: normalizeTimestamp(fixture.fixture),
    statusShort: fixture.fixture.status.short?.trim() || "UNK",
    statusLong: fixture.fixture.status.long?.trim() || "Unknown status",
    minute: fixture.fixture.status.elapsed ?? null,
    homeTeam: {
      id: fixture.teams.home.id,
      name: fixture.teams.home.name?.trim() || "Home Team",
      logo: fixture.teams.home.logo?.trim() || "",
    },
    awayTeam: {
      id: fixture.teams.away.id,
      name: fixture.teams.away.name?.trim() || "Away Team",
      logo: fixture.teams.away.logo?.trim() || "",
    },
    homeScore: scoreOrNull(fixture.goals.home),
    awayScore: scoreOrNull(fixture.goals.away),
    eventsSummary: eventSummary,
  };
}

function normalizeEvent(
  event: ProviderFixtureEventResponse,
): MatchEventSummaryItem {
  return {
    minute: event.time.elapsed ?? null,
    extraMinute: event.time.extra ?? null,
    teamId: event.team?.id ?? null,
    teamName: event.team?.name?.trim() || null,
    playerName: event.player?.name?.trim() || null,
    type: event.type?.trim() || "Event",
    detail: event.detail?.trim() || event.comments?.trim() || "Update",
  };
}

function eventSortValue(event: ProviderFixtureEventResponse): number {
  const minute = event.time.elapsed ?? 0;
  const extra = event.time.extra ?? 0;
  return minute * 100 + extra;
}

export function summarizeEvents(
  events: ProviderFixtureEventResponse[],
): MatchEventsSummary | null {
  if (events.length === 0) {
    return null;
  }

  const recent = [...events]
    .sort((left, right) => eventSortValue(right) - eventSortValue(left))
    .slice(0, 5)
    .map(normalizeEvent);

  return {
    total: events.length,
    goals: events.filter((event) => event.type === "Goal").length,
    cards: events.filter((event) => event.type === "Card").length,
    latest: recent[0] ?? null,
    recent,
  };
}

function normalizeStatisticKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseStatisticValue(
  value: string | number | null | undefined,
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || normalized.toLowerCase() === "null") {
    return null;
  }

  const numeric = Number(normalized.replace("%", "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function getTeamStatisticValue(
  statistics: ProviderFixtureStatisticsResponse | null | undefined,
  possibleKeys: string[],
): number | null {
  if (!statistics?.statistics?.length) {
    return null;
  }

  const lookup = new Map(
    statistics.statistics.map((entry) => [
      normalizeStatisticKey(entry.type ?? ""),
      parseStatisticValue(entry.value),
    ]),
  );

  for (const key of possibleKeys) {
    const value = lookup.get(key);

    if (typeof value === "number") {
      return value;
    }
  }

  return null;
}

function findStatisticsByTeamId(
  statistics: ProviderFixtureStatisticsResponse[],
  teamId: number,
): ProviderFixtureStatisticsResponse | null {
  return (
    statistics.find((entry) => (entry.team?.id ?? null) === teamId) ?? null
  );
}

export function summarizeStatistics(
  statistics: ProviderFixtureStatisticsResponse[],
  homeTeamId: number,
  awayTeamId: number,
): MatchStatisticsSummary | null {
  if (statistics.length === 0) {
    return null;
  }

  const homeStatistics =
    findStatisticsByTeamId(statistics, homeTeamId) ?? statistics[0] ?? null;
  const awayStatistics =
    findStatisticsByTeamId(statistics, awayTeamId) ?? statistics[1] ?? null;

  const summary: MatchStatisticsSummary = {
    possession: {
      home: getTeamStatisticValue(homeStatistics, ["ball-possession"]),
      away: getTeamStatisticValue(awayStatistics, ["ball-possession"]),
      unit: "%",
    },
    shots: {
      home: getTeamStatisticValue(homeStatistics, [
        "total-shots",
        "shots-on-goal",
      ]),
      away: getTeamStatisticValue(awayStatistics, [
        "total-shots",
        "shots-on-goal",
      ]),
      unit: "count",
    },
    corners: {
      home: getTeamStatisticValue(homeStatistics, ["corner-kicks"]),
      away: getTeamStatisticValue(awayStatistics, ["corner-kicks"]),
      unit: "count",
    },
    updatedAt: new Date().toISOString(),
  };

  const hasAnyValue =
    summary.possession.home !== null ||
    summary.possession.away !== null ||
    summary.shots.home !== null ||
    summary.shots.away !== null ||
    summary.corners.home !== null ||
    summary.corners.away !== null;

  return hasAnyValue ? summary : null;
}
