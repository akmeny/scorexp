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

export interface LiveMatch {
  matchId: number;
  leagueId: number;
  leagueName: string;
  country: string;
  startTime: string;
  statusShort: string;
  statusLong: string;
  minute: number | null;
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
  homeScore: number | null;
  awayScore: number | null;
  eventsSummary: MatchEventsSummary | null;
  lastUpdatedAt: string;
}

export type MatchPatchChanges = Partial<Omit<LiveMatch, "matchId">>;

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

export interface MatchesSnapshotResponse {
  matches: LiveMatch[];
  generatedAt: string;
  total: number;
}

export interface MatchesSnapshotViewModel extends MatchesSnapshotResponse {
  error: string | null;
}

export interface MatchesPageResponse extends MatchesSnapshotResponse {
  offset: number;
  limit: number;
  nextOffset: number | null;
  hasMore: boolean;
}

export interface MatchesDiffResponse {
  added: LiveMatch[];
  updated: MatchPatch[];
  removed: RemovedMatch[];
  generatedAt: string;
  total: number;
}

export type MatchUpdateEvent =
  | {
      type: "added";
      matchId: number;
      match: LiveMatch;
      generatedAt: string;
    }
  | {
      type: "updated";
      matchId: number;
      changes: MatchPatchChanges;
      generatedAt: string;
    }
  | {
      type: "removed";
      matchId: number;
      removed: RemovedMatch;
      generatedAt: string;
    };

export interface MatchDetailResponse {
  match: LiveMatch;
}
