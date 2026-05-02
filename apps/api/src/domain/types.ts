export type StatusGroup = "live" | "finished" | "upcoming" | "unknown";

export type ScoreboardView = "all" | "live" | "finished" | "upcoming";

export interface ProviderCountry {
  code?: string | null;
  name?: string | null;
  logo?: string | null;
}

export interface ProviderTeam {
  id?: number | string | null;
  name?: string | null;
  logo?: string | null;
  topPlayers?: ProviderTopPlayer[] | null;
  shots?: unknown[] | null;
}

export interface ProviderTopPlayerStatistic {
  name?: string | null;
  value?: number | string | null;
}

export interface ProviderTopPlayer {
  position?: string | null;
  name?: string | null;
  statistics?: ProviderTopPlayerStatistic[] | null;
}

export interface ProviderLeague {
  id?: number | string | null;
  name?: string | null;
  logo?: string | null;
  season?: number | string | null;
}

export interface ProviderMatch {
  id: number | string;
  round?: string | null;
  date?: string | null;
  country?: ProviderCountry | null;
  awayTeam?: ProviderTeam | null;
  homeTeam?: ProviderTeam | null;
  league?: ProviderLeague | null;
  events?: ProviderMatchEvent[] | null;
  statistics?: ProviderTeamStatistics[] | null;
  state?: {
    description?: string | null;
    clock?: number | string | null;
    score?: {
      current?: string | null;
      penalties?: string | null;
    } | null;
  } | null;
}

export interface ProviderVenue {
  name?: string | null;
  city?: string | null;
  country?: string | null;
  capacity?: number | string | null;
}

export interface ProviderReferee {
  name?: string | null;
  nationality?: string | null;
}

export interface ProviderForecast {
  status?: string | null;
  temperature?: number | string | null;
}

export interface ProviderMatchEvent {
  team?: ProviderTeam | null;
  time?: string | number | null;
  type?: string | null;
  playerId?: number | string | null;
  player?: string | null;
  assistingPlayerId?: number | string | null;
  assist?: string | null;
  substituted?: string | null;
}

export interface ProviderStatistic {
  displayName?: string | null;
  value?: number | string | null;
}

export interface ProviderTeamStatistics {
  team?: ProviderTeam | null;
  statistics?: ProviderStatistic[] | null;
}

export interface ProviderPrediction {
  type?: string | null;
  modelType?: string | null;
  description?: string | null;
  generatedAt?: string | null;
  probabilities?: {
    home?: string | null;
    draw?: string | null;
    away?: string | null;
  } | null;
}

export interface ProviderMatchPredictions {
  live?: ProviderPrediction[] | null;
  prematch?: ProviderPrediction[] | null;
}

export interface ProviderMatchDetail extends ProviderMatch {
  venue?: ProviderVenue | null;
  referee?: ProviderReferee | null;
  forecast?: ProviderForecast | null;
  events?: ProviderMatchEvent[] | null;
  statistics?: ProviderTeamStatistics[] | null;
  predictions?: ProviderMatchPredictions | null;
}

export interface ProviderStandingRecord {
  wins?: number | null;
  draws?: number | null;
  games?: number | null;
  loses?: number | null;
  scoredGoals?: number | null;
  receivedGoals?: number | null;
}

export interface ProviderStandingRow {
  team?: ProviderTeam | null;
  position?: number | null;
  points?: number | null;
  total?: ProviderStandingRecord | null;
  home?: ProviderStandingRecord | null;
  away?: ProviderStandingRecord | null;
}

export interface ProviderStandingGroup {
  name?: string | null;
  standings?: ProviderStandingRow[] | null;
}

export interface ProviderStandingsResponse {
  league?: ProviderLeague | null;
  groups?: ProviderStandingGroup[] | null;
}

export interface Team {
  id: string;
  name: string;
  logo: string | null;
}

export interface Country {
  code: string;
  name: string;
  logo: string | null;
}

export interface League {
  id: string;
  name: string;
  logo: string | null;
  season: string | null;
}

export interface MatchScore {
  home: number | null;
  away: number | null;
  penaltiesHome: number | null;
  penaltiesAway: number | null;
  raw: string | null;
  penaltiesRaw: string | null;
}

export interface NormalizedMatch {
  id: string;
  providerId: string;
  round: string | null;
  date: string;
  localTime: string;
  timestamp: number;
  country: Country;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  status: {
    description: string;
    group: StatusGroup;
    minute: number | null;
  };
  score: MatchScore;
  redCards: {
    home: number;
    away: number;
  };
  isTopTier: boolean;
  lastUpdatedAt: string;
  source: "highlightly";
}

export interface LeagueGroup {
  key: string;
  country: Country;
  league: League;
  isTopTier: boolean;
  counts: Record<StatusGroup, number>;
  matches: NormalizedMatch[];
}

export interface RefreshPolicy {
  reason: "live" | "upcoming" | "finished" | "locked";
  providerRefreshSeconds: number;
  clientRefreshSeconds: number;
  nextProviderRefreshAt: string;
}

export interface ScoreboardSnapshot {
  id: string;
  date: string;
  timezone: string;
  generatedAt: string;
  sourceUpdatedAt: string;
  expiresAt: string;
  checksum: string;
  view: ScoreboardView;
  refreshPolicy: RefreshPolicy;
  counts: Record<StatusGroup | "all", number>;
  leagues: LeagueGroup[];
}

export interface SnapshotCacheEntry {
  snapshot: ScoreboardSnapshot;
  fetchedAt: string;
  expiresAt: string;
  providerRequestCount: number;
}

export interface MatchDetailEvent {
  team: Team;
  time: string | null;
  type: string;
  player: string | null;
  assist: string | null;
  substituted: string | null;
}

export interface MatchDetailStatistic {
  displayName: string;
  value: number | string | null;
}

export interface MatchDetailTeamStatistics {
  team: Team;
  statistics: MatchDetailStatistic[];
}

export interface MatchDetailPrediction {
  type: string | null;
  modelType: string | null;
  description: string | null;
  generatedAt: string | null;
  probabilities: {
    home: string | null;
    draw: string | null;
    away: string | null;
  };
}

export interface MatchDetailTopPlayer {
  name: string;
  position: string | null;
  statistics: {
    name: string;
    value: number | string | null;
  }[];
}

export interface MatchDetailStandingRecord {
  wins: number;
  draws: number;
  games: number;
  loses: number;
  scoredGoals: number;
  receivedGoals: number;
}

export interface MatchDetailStandingRow {
  team: Team;
  position: number | null;
  points: number | null;
  total: MatchDetailStandingRecord;
  home: MatchDetailStandingRecord;
  away: MatchDetailStandingRecord;
}

export interface MatchDetailStandingGroup {
  name: string;
  rows: MatchDetailStandingRow[];
}

export interface MatchDetailStandings {
  league: League;
  groups: MatchDetailStandingGroup[];
}

export interface MatchDetail {
  id: string;
  checksum: string;
  source: "highlightly";
  fetchedAt: string;
  expiresAt: string;
  refreshPolicy: RefreshPolicy;
  match: NormalizedMatch;
  venue: {
    name: string | null;
    city: string | null;
    country: string | null;
    capacity: number | null;
  };
  referee: {
    name: string | null;
    nationality: string | null;
  };
  forecast: {
    status: string | null;
    temperature: number | null;
  };
  events: MatchDetailEvent[];
  statistics: MatchDetailTeamStatistics[];
  headToHead: NormalizedMatch[];
  form: {
    home: NormalizedMatch[];
    away: NormalizedMatch[];
  };
  standings: MatchDetailStandings | null;
  topPlayers: {
    home: MatchDetailTopPlayer[];
    away: MatchDetailTopPlayer[];
  };
  predictions: {
    latestLive: MatchDetailPrediction | null;
    latestPrematch: MatchDetailPrediction | null;
  };
}

export interface MatchDetailCacheEntry {
  detail: MatchDetail;
  fetchedAt: string;
  expiresAt: string;
  providerRequestCount: number;
}
