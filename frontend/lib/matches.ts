import type { LiveMatch, MatchPatchChanges } from "@/lib/types";

export interface LeagueGroup {
  key: string;
  leagueId: number;
  leagueName: string;
  country: string;
  countryFlag: string;
  matchIds: readonly number[];
}

export interface MatchStructureSnapshot {
  revision: number;
  orderedIds: readonly number[];
  groups: readonly LeagueGroup[];
}

export interface MatchFilters {
  query: string;
  liveOnly: boolean;
}

export type FlatListItem =
  | {
      key: string;
      type: "league";
      group: LeagueGroup;
    }
  | {
      key: string;
      type: "match";
      matchId: number;
      leagueKey: string;
    };

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"]);

export function isLiveStatus(statusShort: string): boolean {
  return liveStatuses.has(statusShort);
}

export function compareMatchesForStructure(
  left: LiveMatch,
  right: LiveMatch,
): number {
  const countryDelta = left.country.localeCompare(right.country);
  if (countryDelta !== 0) {
    return countryDelta;
  }

  const leagueDelta = left.leagueName.localeCompare(right.leagueName);
  if (leagueDelta !== 0) {
    return leagueDelta;
  }

  const kickoffDelta =
    new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
  if (kickoffDelta !== 0) {
    return kickoffDelta;
  }

  return left.matchId - right.matchId;
}

export function createStructureSnapshot(
  matches: Iterable<LiveMatch>,
  revision: number,
): MatchStructureSnapshot {
  const orderedMatches = [...matches].sort(compareMatchesForStructure);
  const orderedIds = orderedMatches.map((match) => match.matchId);
  const groups = new Map<string, LeagueGroup>();

  for (const match of orderedMatches) {
    const key = `${match.country}:${match.leagueId}`;
    const existing = groups.get(key);

    if (existing) {
      groups.set(key, {
        ...existing,
        matchIds: [...existing.matchIds, match.matchId],
      });
      continue;
    }

    groups.set(key, {
      key,
      leagueId: match.leagueId,
      leagueName: match.leagueName,
      country: match.country,
      countryFlag: match.countryFlag,
      matchIds: [match.matchId],
    });
  }

  return {
    revision,
    orderedIds,
    groups: [...groups.values()],
  };
}

function matchesQuery(match: LiveMatch, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return (
    match.homeTeam.name.toLowerCase().includes(normalizedQuery) ||
    match.awayTeam.name.toLowerCase().includes(normalizedQuery) ||
    match.leagueName.toLowerCase().includes(normalizedQuery) ||
    match.country.toLowerCase().includes(normalizedQuery)
  );
}

export function buildVisibleGroups(
  structure: MatchStructureSnapshot,
  getMatch: (matchId: number) => LiveMatch | null,
  filters: MatchFilters,
): LeagueGroup[] {
  const normalizedQuery = filters.query.trim().toLowerCase();
  const visibleGroups: LeagueGroup[] = [];

  for (const group of structure.groups) {
    const visibleIds: number[] = [];

    for (const matchId of group.matchIds) {
      const match = getMatch(matchId);

      if (!match) {
        continue;
      }

      if (filters.liveOnly && !isLiveStatus(match.statusShort)) {
        continue;
      }

      if (!matchesQuery(match, normalizedQuery)) {
        continue;
      }

      visibleIds.push(matchId);
    }

    if (visibleIds.length === 0) {
      continue;
    }

    visibleGroups.push({
      ...group,
      matchIds: visibleIds,
    });
  }

  return visibleGroups;
}

export function flattenGroups(groups: readonly LeagueGroup[]): FlatListItem[] {
  const items: FlatListItem[] = [];

  for (const group of groups) {
    items.push({
      key: `league:${group.key}`,
      type: "league",
      group,
    });

    for (const matchId of group.matchIds) {
      items.push({
        key: `match:${matchId}`,
        type: "match",
        matchId,
        leagueKey: group.key,
      });
    }
  }

  return items;
}

export function patchAffectsStructure(changes: MatchPatchChanges): boolean {
  return (
    "leagueId" in changes ||
    "leagueName" in changes ||
    "country" in changes ||
    "countryFlag" in changes ||
    "startTime" in changes ||
    "statusShort" in changes ||
    "homeTeam" in changes ||
    "awayTeam" in changes
  );
}
