export interface TeamSummary {
  id: number;
  name: string;
  logo: string;
}

export interface MatchEventSummaryItem {
  minute: number | null;
  extraMinute: number | null;
  teamId: number | null;
  teamName: string | null;
  playerName: string | null;
  type: string;
  detail: string;
}

export interface MatchEventsSummary {
  total: number;
  goals: number;
  cards: number;
  latest: MatchEventSummaryItem | null;
  recent: MatchEventSummaryItem[];
}

export interface MatchStatisticPair {
  home: number | null;
  away: number | null;
  unit: "%" | "count";
}

export interface MatchStatisticsSummary {
  possession: MatchStatisticPair;
  shots: MatchStatisticPair;
  corners: MatchStatisticPair;
  updatedAt: string;
}

export interface MatchStatisticRow {
  key: string;
  label: string;
  home: string | null;
  away: string | null;
}

export type MatchFormResult = "W" | "D" | "L" | "U";

export interface MatchFormEntry {
  result: MatchFormResult;
  opponentName: string;
  isHome: boolean;
  goalsFor: number | null;
  goalsAgainst: number | null;
}

export interface MatchFormSnapshot {
  last5: MatchFormEntry[];
  updatedAt: string;
}

export interface MatchFixtureDetails {
  referee: string | null;
  venueName: string | null;
  venueCity: string | null;
  timezone: string | null;
  season: number | null;
  round: string | null;
  leagueLogo: string | null;
  leagueType: string | null;
  homeWinner: boolean | null;
  awayWinner: boolean | null;
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface MatchTimelineEvent {
  minute: number | null;
  extraMinute: number | null;
  teamId: number | null;
  teamName: string | null;
  playerName: string | null;
  assistName: string | null;
  type: string;
  detail: string;
  comments: string | null;
}

export interface MatchLineupPlayer {
  id: number | null;
  name: string;
  number: number | null;
  position: string | null;
  grid: string | null;
}

export interface MatchLineupTeam {
  teamId: number | null;
  teamName: string;
  teamLogo: string;
  formation: string | null;
  coachName: string | null;
  coachPhoto: string | null;
  startXI: MatchLineupPlayer[];
  substitutes: MatchLineupPlayer[];
}

export interface MatchPlayerPerformance {
  playerId: number | null;
  name: string;
  photo: string | null;
  number: number | null;
  position: string | null;
  grid: string | null;
  minutes: number | null;
  rating: string | null;
  captain: boolean;
  substitute: boolean;
  goals: number | null;
  assists: number | null;
  shotsTotal: number | null;
  shotsOn: number | null;
  passesTotal: number | null;
  passesKey: number | null;
  passesAccuracy: string | null;
  tackles: number | null;
  duelsWon: number | null;
  dribblesSuccess: number | null;
  foulsDrawn: number | null;
  foulsCommitted: number | null;
  yellowCards: number | null;
  redCards: number | null;
  penaltyScored: number | null;
  penaltyMissed: number | null;
}

export interface MatchPlayerTeamSection {
  teamId: number | null;
  teamName: string;
  teamLogo: string;
  updatedAt: string | null;
  players: MatchPlayerPerformance[];
}

export interface MatchHeadToHeadItem {
  matchId: number;
  date: string;
  leagueName: string;
  country: string;
  round: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  statusShort: string;
  statusLong: string;
}

export interface MatchRecentFormItem {
  matchId: number;
  date: string;
  leagueName: string;
  isHome: boolean;
  opponentName: string;
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: "W" | "D" | "L" | "U";
}

export interface MatchTeamSeasonStats {
  form: string | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  cleanSheets: number | null;
  failedToScore: number | null;
  biggestWin: string | null;
  biggestLoss: string | null;
  streakWins: number | null;
  streakDraws: number | null;
  streakLosses: number | null;
}

export interface MatchFormTeamSummary {
  teamId: number;
  teamName: string;
  teamLogo: string;
  last5: MatchRecentFormItem[];
  last10: MatchRecentFormItem[];
  seasonStats: MatchTeamSeasonStats | null;
}

export interface MatchFormSummary {
  home: MatchFormTeamSummary;
  away: MatchFormTeamSummary;
}

export interface MatchStandingsRow {
  rank: number | null;
  teamId: number | null;
  teamName: string;
  teamLogo: string;
  points: number | null;
  goalsDiff: number | null;
  form: string | null;
  status: string | null;
  description: string | null;
  group: string | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  isCurrentMatchTeam: boolean;
}

export interface MatchStandingsGroup {
  name: string;
  rows: MatchStandingsRow[];
}

export interface MatchStandingsSummary {
  leagueId: number | null;
  leagueName: string | null;
  country: string | null;
  season: number | null;
  groups: MatchStandingsGroup[];
  homeTeamDescription: string | null;
  awayTeamDescription: string | null;
}

export interface MatchPredictionSummary {
  advice: string | null;
  underOver: string | null;
  winnerTeamId: number | null;
  winnerName: string | null;
  winnerComment: string | null;
  winOrDraw: boolean | null;
  goalsHome: string | null;
  goalsAway: string | null;
  percentHome: string | null;
  percentDraw: string | null;
  percentAway: string | null;
  comparison: Record<string, string | null>;
  homeLast5Form: string | null;
  awayLast5Form: string | null;
  homeLeagueForm: string | null;
  awayLeagueForm: string | null;
}

export interface MatchTournamentSummary {
  leagueType: string | null;
  season: number | null;
  round: string | null;
  venueName: string | null;
  venueCity: string | null;
  referee: string | null;
  timezone: string | null;
  score: MatchFixtureDetails["score"];
  homeWinner: boolean | null;
  awayWinner: boolean | null;
  homeStandingDescription: string | null;
  awayStandingDescription: string | null;
}

export type MatchDetailTabKey =
  | "summary"
  | "statistics"
  | "events"
  | "lineups"
  | "players"
  | "h2h"
  | "form"
  | "standings"
  | "tournament"
  | "predictions";

export interface MatchFullDetail {
  fixture: MatchFixtureDetails | null;
  statistics: MatchStatisticRow[];
  events: MatchTimelineEvent[];
  lineups: MatchLineupTeam[];
  players: MatchPlayerTeamSection[];
  headToHead: MatchHeadToHeadItem[];
  form: MatchFormSummary | null;
  standings: MatchStandingsSummary | null;
  predictions: MatchPredictionSummary | null;
  tournament: MatchTournamentSummary | null;
  availableTabs: MatchDetailTabKey[];
  generatedAt: string;
}

export interface MatchDetailResponsePayload {
  match: NormalizedMatch;
  detail: MatchFullDetail;
  freshness: MatchFreshness | null;
}

export interface NormalizedMatchInput {
  matchId: number;
  leagueId: number;
  leagueName: string;
  country: string;
  countryFlag: string;
  startTime: string;
  statusShort: string;
  statusLong: string;
  minute: number | null;
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
  homeScore: number | null;
  awayScore: number | null;
  eventsSummary: MatchEventsSummary | null;
  homeForm?: MatchFormSnapshot | null;
  awayForm?: MatchFormSnapshot | null;
}

export interface NormalizedMatch extends NormalizedMatchInput {
  lastUpdatedAt: string;
}

export interface MatchFreshness {
  matchId: number;
  lastSeenAt: string;
  lastLiveSeenAt: string | null;
  lastTodaySeenAt: string | null;
  lastEventsRefreshAt: string | null;
  lastProviderChangeAt: string;
  providerSource: "live" | "today" | "live+today";
  liveUnchangedStreak: number;
  todayUnchangedStreak: number;
}

export type MatchPatchChanges = Partial<Omit<NormalizedMatch, "matchId">>;

export interface MatchPatch {
  matchId: number;
  changes: MatchPatchChanges;
}

export interface RemovedMatch {
  matchId: number;
  statusShort: string;
  statusLong: string;
  reason: "finished" | "no-longer-live";
}

export interface MatchDiff {
  added: NormalizedMatch[];
  updated: MatchPatch[];
  removed: RemovedMatch[];
}

const statusPriority: Record<string, number> = {
  "1H": 0,
  HT: 1,
  "2H": 2,
  ET: 3,
  BT: 4,
  P: 5,
  SUSP: 6,
  INT: 7,
};

export function compareMatches(
  left: Pick<
    NormalizedMatchInput,
    "country" | "leagueName" | "startTime" | "matchId" | "minute" | "statusShort"
  >,
  right: Pick<
    NormalizedMatchInput,
    "country" | "leagueName" | "startTime" | "matchId" | "minute" | "statusShort"
  >,
): number {
  const leftStatus = statusPriority[left.statusShort] ?? 99;
  const rightStatus = statusPriority[right.statusShort] ?? 99;

  if (leftStatus !== rightStatus) {
    return leftStatus - rightStatus;
  }

  const minuteDelta = (right.minute ?? -1) - (left.minute ?? -1);
  if (minuteDelta !== 0) {
    return minuteDelta;
  }

  const countryDelta = left.country.localeCompare(right.country);
  if (countryDelta !== 0) {
    return countryDelta;
  }

  const leagueDelta = left.leagueName.localeCompare(right.leagueName);
  if (leagueDelta !== 0) {
    return leagueDelta;
  }

  const startDelta =
    new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
  if (startDelta !== 0) {
    return startDelta;
  }

  return left.matchId - right.matchId;
}
