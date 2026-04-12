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

export interface NormalizedMatchInput {
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
}

export interface NormalizedMatch extends NormalizedMatchInput {
  lastUpdatedAt: string;
}

export interface MatchFreshness {
  matchId: number;
  lastSeenAt: string;
  lastLiveSeenAt: string | null;
  lastFallbackSeenAt: string | null;
  lastEventsRefreshAt: string | null;
  lastProviderChangeAt: string;
  providerSource: "live" | "fallback" | "live+fallback";
  liveUnchangedStreak: number;
  fallbackUnchangedStreak: number;
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
