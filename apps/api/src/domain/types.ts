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
