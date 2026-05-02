export type StatusGroup = "live" | "finished" | "upcoming" | "unknown";
export type ScoreboardView = "all" | "live" | "finished" | "upcoming";

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

export interface ScoreboardSnapshot {
  id: string;
  date: string;
  timezone: string;
  generatedAt: string;
  sourceUpdatedAt: string;
  expiresAt: string;
  checksum: string;
  view: ScoreboardView;
  refreshPolicy: {
    reason: "live" | "upcoming" | "finished" | "locked";
    providerRefreshSeconds: number;
    clientRefreshSeconds: number;
    nextProviderRefreshAt: string;
  };
  counts: Record<StatusGroup | "all", number>;
  leagues: LeagueGroup[];
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

export interface MatchDetail {
  id: string;
  checksum: string;
  source: "highlightly";
  fetchedAt: string;
  expiresAt: string;
  refreshPolicy: {
    reason: "live" | "upcoming" | "finished" | "locked";
    providerRefreshSeconds: number;
    clientRefreshSeconds: number;
    nextProviderRefreshAt: string;
  };
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
  predictions: {
    latestLive: MatchDetailPrediction | null;
    latestPrematch: MatchDetailPrediction | null;
  };
}
