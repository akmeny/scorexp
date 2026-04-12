import type {
  ProviderFixtureEventResponse,
  ProviderFixtureResponse,
} from "../../types/provider.js";
import type {
  MatchEventSummaryItem,
  MatchEventsSummary,
  NormalizedMatchInput,
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
