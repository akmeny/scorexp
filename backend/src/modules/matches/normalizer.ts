import type {
  ProviderFixtureEventResponse,
  ProviderFixtureLineupResponse,
  ProviderFixturePlayerStatisticResponse,
  ProviderFixtureStatisticsResponse,
  ProviderFixtureResponse,
  ProviderPredictionResponse,
  ProviderStandingsResponse,
  ProviderTeamStatisticsResponse,
} from "../../types/provider.js";
import type {
  MatchEventSummaryItem,
  MatchEventsSummary,
  MatchFixtureDetails,
  MatchHeadToHeadItem,
  MatchLineupPlayer,
  MatchLineupTeam,
  MatchPlayerPerformance,
  MatchPlayerTeamSection,
  MatchPredictionSummary,
  MatchRecentFormItem,
  MatchStandingsGroup,
  MatchStandingsRow,
  MatchStandingsSummary,
  MatchStatisticRow,
  MatchStatisticsSummary,
  MatchTeamSeasonStats,
  MatchTimelineEvent,
  MatchTournamentSummary,
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

function safeString(value: string | null | undefined, fallback = ""): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function nullableString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function numericOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function stringifyStatisticValue(
  value: string | number | null | undefined,
): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized && normalized.toLowerCase() !== "null" ? normalized : null;
}

function normalizeStatisticKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function eventSortValue(
  event: Pick<ProviderFixtureEventResponse, "time">,
): number {
  const minute = event.time.elapsed ?? 0;
  const extra = event.time.extra ?? 0;
  return minute * 100 + extra;
}

function normalizeEvent(
  event: ProviderFixtureEventResponse,
): MatchEventSummaryItem {
  return {
    minute: event.time.elapsed ?? null,
    extraMinute: event.time.extra ?? null,
    teamId: event.team?.id ?? null,
    teamName: nullableString(event.team?.name),
    playerName: nullableString(event.player?.name),
    type: safeString(event.type, "Olay"),
    detail: safeString(event.detail ?? event.comments, "Güncelleme"),
  };
}

function isRedCardEvent(event: ProviderFixtureEventResponse): boolean {
  if (event.type?.toLowerCase() !== "card") {
    return false;
  }

  const detail = `${event.detail ?? ""} ${event.comments ?? ""}`.toLowerCase();

  return detail.includes("red") || detail.includes("second yellow");
}

export function normalizeTimelineEvent(
  event: ProviderFixtureEventResponse,
): MatchTimelineEvent {
  return {
    minute: event.time.elapsed ?? null,
    extraMinute: event.time.extra ?? null,
    teamId: event.team?.id ?? null,
    teamName: nullableString(event.team?.name),
    playerName: nullableString(event.player?.name),
    assistName: null,
    type: safeString(event.type, "Olay"),
    detail: safeString(event.detail ?? event.comments, "Güncelleme"),
    comments: nullableString(event.comments),
  };
}

function findStatisticsByTeamId(
  statistics: ProviderFixtureStatisticsResponse[],
  teamId: number,
): ProviderFixtureStatisticsResponse | null {
  return (
    statistics.find((entry) => (entry.team?.id ?? null) === teamId) ?? null
  );
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

function toStatisticLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeLineupPlayerList(
  entries: ProviderFixtureLineupResponse["startXI"] | ProviderFixtureLineupResponse["substitutes"],
): MatchLineupPlayer[] {
  return (entries ?? [])
    .map((entry) => {
      if (!entry?.player) {
        return null;
      }

      return {
        id: entry.player.id ?? null,
        name: safeString(entry.player.name, "Oyuncu"),
        number: entry.player.number ?? null,
        position: nullableString(entry.player.pos),
        grid: nullableString(entry.player.grid),
      };
    })
    .filter((entry): entry is MatchLineupPlayer => entry !== null);
}

export function normalizeFixture(
  fixture: ProviderFixtureResponse,
  eventSummary: MatchEventsSummary | null,
): NormalizedMatchInput {
  return {
    matchId: fixture.fixture.id,
    leagueId: fixture.league.id,
    leagueName: fixture.league.name?.trim() || "Bilinmeyen Lig",
    country: fixture.league.country?.trim() || "Bilinmeyen Ülke",
    countryFlag: fixture.league.flag?.trim() || "",
    startTime: normalizeTimestamp(fixture.fixture),
    statusShort: fixture.fixture.status.short?.trim() || "UNK",
    statusLong: fixture.fixture.status.long?.trim() || "Durum bilinmiyor",
    minute: fixture.fixture.status.elapsed ?? null,
    homeTeam: {
      id: fixture.teams.home.id,
      name: fixture.teams.home.name?.trim() || "Ev Sahibi",
      logo: fixture.teams.home.logo?.trim() || "",
    },
    awayTeam: {
      id: fixture.teams.away.id,
      name: fixture.teams.away.name?.trim() || "Deplasman",
      logo: fixture.teams.away.logo?.trim() || "",
    },
    homeScore: scoreOrNull(fixture.goals.home),
    awayScore: scoreOrNull(fixture.goals.away),
    homeRedCards: eventSummary?.homeRedCards ?? 0,
    awayRedCards: eventSummary?.awayRedCards ?? 0,
    liveRetainUntil: null,
    eventsSummary: eventSummary,
  };
}

export function summarizeEvents(
  events: ProviderFixtureEventResponse[],
  teams?: {
    homeTeamId: number;
    awayTeamId: number;
  },
): MatchEventsSummary | null {
  if (events.length === 0) {
    return null;
  }

  const recent = [...events]
    .sort((left, right) => eventSortValue(right) - eventSortValue(left))
    .slice(0, 5)
    .map(normalizeEvent);
  const redCardEvents = events.filter(isRedCardEvent);

  return {
    total: events.length,
    goals: events.filter((event) => event.type === "Goal").length,
    cards: events.filter((event) => event.type === "Card").length,
    homeRedCards: teams
      ? redCardEvents.filter((event) => event.team?.id === teams.homeTeamId).length
      : 0,
    awayRedCards: teams
      ? redCardEvents.filter((event) => event.team?.id === teams.awayTeamId).length
      : 0,
    latest: recent[0] ?? null,
    recent,
  };
}

export function normalizeDetailedStatistics(
  statistics: ProviderFixtureStatisticsResponse[],
  homeTeamId: number,
  awayTeamId: number,
): MatchStatisticRow[] {
  if (statistics.length === 0) {
    return [];
  }

  const homeStatistics =
    findStatisticsByTeamId(statistics, homeTeamId) ?? statistics[0] ?? null;
  const awayStatistics =
    findStatisticsByTeamId(statistics, awayTeamId) ?? statistics[1] ?? null;

  const rows = new Map<
    string,
    {
      label: string;
      home: string | null;
      away: string | null;
    }
  >();

  for (const entry of homeStatistics?.statistics ?? []) {
    const key = normalizeStatisticKey(entry.type ?? "");

    if (!key) {
      continue;
    }

    rows.set(key, {
      label: safeString(entry.type, toStatisticLabel(key)),
      home: stringifyStatisticValue(entry.value),
      away: rows.get(key)?.away ?? null,
    });
  }

  for (const entry of awayStatistics?.statistics ?? []) {
    const key = normalizeStatisticKey(entry.type ?? "");

    if (!key) {
      continue;
    }

    rows.set(key, {
      label: rows.get(key)?.label ?? safeString(entry.type, toStatisticLabel(key)),
      home: rows.get(key)?.home ?? null,
      away: stringifyStatisticValue(entry.value),
    });
  }

  return [...rows.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      home: value.home,
      away: value.away,
    }))
    .filter((row) => row.home !== null || row.away !== null);
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

export function normalizeFixtureDetails(
  fixture: ProviderFixtureResponse,
): MatchFixtureDetails {
  return {
    referee: nullableString(fixture.fixture.referee),
    venueName: nullableString(fixture.fixture.venue?.name),
    venueCity: nullableString(fixture.fixture.venue?.city),
    timezone: nullableString(fixture.fixture.timezone),
    season: fixture.league.season ?? null,
    round: nullableString(fixture.league.round),
    leagueLogo: nullableString(fixture.league.logo),
    leagueType: null,
    homeWinner: fixture.teams.home.winner ?? null,
    awayWinner: fixture.teams.away.winner ?? null,
    score: {
      halftime: {
        home: scoreOrNull(fixture.score?.halftime?.home),
        away: scoreOrNull(fixture.score?.halftime?.away),
      },
      fulltime: {
        home: scoreOrNull(fixture.score?.fulltime?.home),
        away: scoreOrNull(fixture.score?.fulltime?.away),
      },
      extratime: {
        home: scoreOrNull(fixture.score?.extratime?.home),
        away: scoreOrNull(fixture.score?.extratime?.away),
      },
      penalty: {
        home: scoreOrNull(fixture.score?.penalty?.home),
        away: scoreOrNull(fixture.score?.penalty?.away),
      },
    },
  };
}

export function normalizeLineups(
  lineups: ProviderFixtureLineupResponse[],
): MatchLineupTeam[] {
  return lineups
    .map((lineup) => ({
      teamId: lineup.team?.id ?? null,
      teamName: safeString(lineup.team?.name, "Takım"),
      teamLogo: safeString(lineup.team?.logo),
      formation: nullableString(lineup.formation),
      coachName: nullableString(lineup.coach?.name),
      coachPhoto: nullableString(lineup.coach?.photo),
      startXI: normalizeLineupPlayerList(lineup.startXI),
      substitutes: normalizeLineupPlayerList(lineup.substitutes),
    }))
    .filter((lineup) => lineup.startXI.length > 0 || lineup.substitutes.length > 0);
}

export function normalizePlayerSections(
  sections: ProviderFixturePlayerStatisticResponse[],
): MatchPlayerTeamSection[] {
  return sections
    .map((section) => ({
      teamId: section.team?.id ?? null,
      teamName: safeString(section.team?.name, "Takım"),
      teamLogo: safeString(section.team?.logo),
      updatedAt: nullableString(section.team?.update),
      players: (section.players ?? [])
        .map((entry) => {
          const statistics = entry.statistics?.[0];

          if (!entry.player || !statistics) {
            return null;
          }

          const player: MatchPlayerPerformance = {
            playerId: entry.player.id ?? null,
            name: safeString(entry.player.name, "Oyuncu"),
            photo: nullableString(entry.player.photo),
            number: statistics.games?.number ?? null,
            position: nullableString(statistics.games?.position),
            grid: null,
            minutes: statistics.games?.minutes ?? null,
            rating: nullableString(statistics.games?.rating),
            captain: Boolean(statistics.games?.captain),
            substitute: Boolean(statistics.games?.substitute),
            goals: statistics.goals?.total ?? null,
            assists: statistics.goals?.assists ?? null,
            shotsTotal: statistics.shots?.total ?? null,
            shotsOn: statistics.shots?.on ?? null,
            passesTotal: statistics.passes?.total ?? null,
            passesKey: statistics.passes?.key ?? null,
            passesAccuracy: nullableString(statistics.passes?.accuracy),
            tackles: statistics.tackles?.total ?? null,
            duelsWon: statistics.duels?.won ?? null,
            dribblesSuccess: statistics.dribbles?.success ?? null,
            foulsDrawn: statistics.fouls?.drawn ?? null,
            foulsCommitted: statistics.fouls?.committed ?? null,
            yellowCards: statistics.cards?.yellow ?? null,
            redCards: statistics.cards?.red ?? null,
            penaltyScored: statistics.penalty?.scored ?? null,
            penaltyMissed: statistics.penalty?.missed ?? null,
          };

          return player;
        })
        .filter((player): player is MatchPlayerPerformance => player !== null)
        .sort((left, right) => {
          const rightMinutes = right.minutes ?? -1;
          const leftMinutes = left.minutes ?? -1;

          if (rightMinutes !== leftMinutes) {
            return rightMinutes - leftMinutes;
          }

          return left.name.localeCompare(right.name);
        }),
    }))
    .filter((section) => section.players.length > 0);
}

export function normalizeHeadToHead(
  fixtures: ProviderFixtureResponse[],
): MatchHeadToHeadItem[] {
  return fixtures
    .map((fixture) => ({
      matchId: fixture.fixture.id,
      date: normalizeTimestamp(fixture.fixture),
      leagueName: safeString(fixture.league.name, "Lig"),
      country: safeString(fixture.league.country, "Ülke"),
      round: nullableString(fixture.league.round),
      homeTeamName: safeString(fixture.teams.home.name, "Ev Sahibi"),
      awayTeamName: safeString(fixture.teams.away.name, "Deplasman"),
      homeScore: scoreOrNull(fixture.goals.home),
      awayScore: scoreOrNull(fixture.goals.away),
      statusShort: safeString(fixture.fixture.status.short, "UNK"),
      statusLong: safeString(fixture.fixture.status.long, "Durum bilinmiyor"),
    }))
    .sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime(),
    );
}

export function normalizeRecentForm(
  fixtures: ProviderFixtureResponse[],
  teamId: number,
): MatchRecentFormItem[] {
  return fixtures
    .map((fixture) => {
      const isHome = fixture.teams.home.id === teamId;
      const goalsFor = scoreOrNull(isHome ? fixture.goals.home : fixture.goals.away);
      const goalsAgainst = scoreOrNull(
        isHome ? fixture.goals.away : fixture.goals.home,
      );
      const result: MatchRecentFormItem["result"] =
        goalsFor === null || goalsAgainst === null
          ? "U"
          : goalsFor > goalsAgainst
            ? "W"
            : goalsFor < goalsAgainst
              ? "L"
              : "D";

      return {
        matchId: fixture.fixture.id,
        date: normalizeTimestamp(fixture.fixture),
        leagueName: safeString(fixture.league.name, "Lig"),
        isHome,
        opponentName: safeString(
          isHome ? fixture.teams.away.name : fixture.teams.home.name,
          "Rakip",
        ),
        goalsFor,
        goalsAgainst,
        result,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime(),
    );
}

export function summarizeTeamSeasonStats(
  payload: ProviderTeamStatisticsResponse | null,
): MatchTeamSeasonStats | null {
  if (!payload) {
    return null;
  }

  return {
    form: nullableString(payload.form),
    played: payload.fixtures?.played?.total ?? null,
    wins: payload.fixtures?.wins?.total ?? null,
    draws: payload.fixtures?.draws?.total ?? null,
    losses: payload.fixtures?.loses?.total ?? null,
    goalsFor: payload.goals?.for?.total?.total ?? null,
    goalsAgainst: payload.goals?.against?.total?.total ?? null,
    cleanSheets: payload.clean_sheet?.total ?? null,
    failedToScore: payload.failed_to_score?.total ?? null,
    biggestWin:
      nullableString(payload.biggest?.wins?.home) ??
      nullableString(payload.biggest?.wins?.away),
    biggestLoss:
      nullableString(payload.biggest?.loses?.home) ??
      nullableString(payload.biggest?.loses?.away),
    streakWins: payload.biggest?.streak?.wins ?? null,
    streakDraws: payload.biggest?.streak?.draws ?? null,
    streakLosses: payload.biggest?.streak?.loses ?? null,
  };
}

export function normalizeStandings(
  payload: ProviderStandingsResponse | null,
  homeTeamId: number,
  awayTeamId: number,
): MatchStandingsSummary | null {
  const groupsSource = payload?.league?.standings ?? [];

  if (groupsSource.length === 0) {
    return null;
  }

  const relevantGroups = groupsSource.filter((group) =>
    group.some((row) => {
      const teamId = row.team?.id ?? null;
      return teamId === homeTeamId || teamId === awayTeamId;
    }),
  );

  const groupsToUse = relevantGroups.length > 0 ? relevantGroups : groupsSource;

  const groups: MatchStandingsGroup[] = groupsToUse.map((group, index) => {
    const groupName =
      nullableString(group[0]?.group) ??
      (groupsToUse.length > 1 ? `Grup ${index + 1}` : "Genel Tablo");

    const rows: MatchStandingsRow[] = group.map((row) => ({
      rank: row.rank ?? null,
      teamId: row.team?.id ?? null,
      teamName: safeString(row.team?.name, "Takım"),
      teamLogo: safeString(row.team?.logo),
      points: row.points ?? null,
      goalsDiff: row.goalsDiff ?? null,
      form: nullableString(row.form),
      status: nullableString(row.status),
      description: nullableString(row.description),
      group: nullableString(row.group),
      played: row.all?.played ?? null,
      wins: row.all?.win ?? null,
      draws: row.all?.draw ?? null,
      losses: row.all?.lose ?? null,
      goalsFor: row.all?.goals?.for ?? null,
      goalsAgainst: row.all?.goals?.against ?? null,
      isCurrentMatchTeam:
        (row.team?.id ?? null) === homeTeamId || (row.team?.id ?? null) === awayTeamId,
    }));

    return {
      name: groupName,
      rows,
    };
  });

  const homeTeamDescription =
    groups.flatMap((group) => group.rows).find((row) => row.teamId === homeTeamId)
      ?.description ?? null;
  const awayTeamDescription =
    groups.flatMap((group) => group.rows).find((row) => row.teamId === awayTeamId)
      ?.description ?? null;

  return {
    leagueId: payload?.league?.id ?? null,
    leagueName: nullableString(payload?.league?.name) ?? null,
    country: nullableString(payload?.league?.country) ?? null,
    season: payload?.league?.season ?? null,
    groups,
    homeTeamDescription,
    awayTeamDescription,
  };
}

export function normalizePrediction(
  payload: ProviderPredictionResponse | null,
): MatchPredictionSummary | null {
  if (!payload?.predictions) {
    return null;
  }

  const comparisonEntries = Object.entries(payload.comparison ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return {
    advice: nullableString(payload.predictions.advice),
    underOver: nullableString(payload.predictions.under_over),
    winnerTeamId: payload.predictions.winner?.id ?? null,
    winnerName: nullableString(payload.predictions.winner?.name),
    winnerComment: nullableString(payload.predictions.winner?.comment),
    winOrDraw: payload.predictions.win_or_draw ?? null,
    goalsHome: nullableString(payload.predictions.goals?.home),
    goalsAway: nullableString(payload.predictions.goals?.away),
    percentHome: nullableString(payload.predictions.percent?.home),
    percentDraw: nullableString(payload.predictions.percent?.draw),
    percentAway: nullableString(payload.predictions.percent?.away),
    comparison: Object.fromEntries(comparisonEntries),
    homeLast5Form: nullableString(payload.teams?.home?.last_5?.form),
    awayLast5Form: nullableString(payload.teams?.away?.last_5?.form),
    homeLeagueForm: nullableString(payload.teams?.home?.league?.form),
    awayLeagueForm: nullableString(payload.teams?.away?.league?.form),
  };
}

export function buildTournamentSummary(
  fixture: MatchFixtureDetails | null,
  standings: MatchStandingsSummary | null,
): MatchTournamentSummary | null {
  if (!fixture) {
    return null;
  }

  return {
    leagueType: fixture.leagueType,
    season: fixture.season,
    round: fixture.round,
    venueName: fixture.venueName,
    venueCity: fixture.venueCity,
    referee: fixture.referee,
    timezone: fixture.timezone,
    score: fixture.score,
    homeWinner: fixture.homeWinner,
    awayWinner: fixture.awayWinner,
    homeStandingDescription: standings?.homeTeamDescription ?? null,
    awayStandingDescription: standings?.awayTeamDescription ?? null,
  };
}
