export type StatusGroup = "live" | "finished" | "upcoming" | "unknown";
export type ScoreboardView = "all" | "live" | "finished" | "upcoming";
export type GoalHighlightSide = "home" | "away" | "both";
export type GoalHighlightPhase = "pending" | "confirmed";

export interface MatchGoalHighlight {
  side: GoalHighlightSide;
  phase: GoalHighlightPhase;
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

export interface MatchHighlight {
  id: string;
  type: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  url: string | null;
  embedUrl: string | null;
  source: string | null;
  channel: string | null;
  match: NormalizedMatch | null;
}

export interface HighlightsSnapshot {
  id: string;
  date: string;
  timezone: string;
  generatedAt: string;
  fetchedAt: string;
  expiresAt: string;
  checksum: string;
  highlights: MatchHighlight[];
  pagination: {
    totalCount: number;
    offset: number;
    limit: number;
    nextOffset: number | null;
  };
}

export interface ChatMessage {
  id: string;
  matchId: string;
  authorId: string;
  nickname: string;
  color: string;
  body: string;
  createdAt: string;
}

export interface ChatRoomSnapshot {
  roomId: string;
  generatedAt: string;
  viewerCount?: number;
  messages: ChatMessage[];
}

export type AuthProvider = "google" | "apple" | "facebook" | "x";

export interface AuthStatus {
  configured: boolean;
  providers: AuthProvider[];
}

export interface UserProfile {
  userId: string;
  email: string | null;
  provider: string | null;
  nickname: string;
  notificationsEnabled: boolean;
  notificationPermission: "default" | "granted" | "denied" | null;
  createdAt: string;
  updatedAt: string;
}
