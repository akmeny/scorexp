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

interface LeagueFavoriteRule {
  country?: string | RegExp;
  league: RegExp;
}

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"]);

const defaultFavoriteRules: readonly LeagueFavoriteRule[] = [
  { country: "turkey", league: /^super-lig$/ },
  { country: "turkey", league: /^1-lig$/ },
  { country: "turkey", league: /^(?:ziraat-turkiye-kupasi|turkiye-kupasi|cup)$/ },
  { country: "turkey", league: /^super-cup$/ },
  { country: "europe", league: /uefa-champions-league(?!-women)/ },
  { country: "europe", league: /uefa-europa-league/ },
  { country: "europe", league: /uefa-europa-conference-league|uefa-conference-league/ },
  { country: "europe", league: /uefa-super-cup/ },
  { country: "world", league: /fifa-club-world-cup|club-world-cup/ },
  { country: "world", league: /world-cup(?!-u)/ },
  { country: "europe", league: /uefa-european-championship|euro-championship|european-championship/ },
  { country: "europe", league: /uefa-nations-league|nations-league/ },
  { country: "north-america", league: /concacaf-nations-league/ },
  { country: "south-america", league: /copa-america/ },
  { country: "asia", league: /asian-cup/ },
  { country: "africa", league: /africa-cup-of-nations/ },
  { country: "north-america", league: /concacaf-gold-cup/ },
  { country: "south-america", league: /copa-libertadores|conmebol-libertadores/ },
  { country: "south-america", league: /copa-sudamericana|conmebol-sudamericana/ },
  { country: "north-america", league: /concacaf-champions-cup|concacaf-champions-league/ },
  { country: "asia", league: /afc-champions-league/ },
  { country: "africa", league: /caf-champions-league/ },
  { country: "england", league: /^premier-league$/ },
  { country: "england", league: /^championship$/ },
  { country: "germany", league: /^bundesliga$/ },
  { country: "spain", league: /^la-liga$/ },
  { country: "germany", league: /^2-bundesliga$/ },
  { country: "italy", league: /^serie-a$/ },
  { country: "france", league: /^ligue-1$/ },
  { country: "netherlands", league: /^eredivisie$/ },
  { country: "netherlands", league: /^eerste-divisie$/ },
  { country: "portugal", league: /^primeira-liga$/ },
  { country: "belgium", league: /pro-league|jupiler-pro-league/ },
  { country: "scotland", league: /premiership$/ },
  { country: "switzerland", league: /^super-league$/ },
  { country: "austria", league: /^bundesliga$/ },
  { country: "denmark", league: /^superliga$/ },
  { country: "norway", league: /^eliteserien$/ },
  { country: "sweden", league: /^allsvenskan$/ },
  { country: "sweden", league: /^superettan$/ },
  { country: "czech-republic", league: /^czech-liga$|^first-league$/ },
  { country: "poland", league: /^ekstraklasa$/ },
  { country: "greece", league: /^super-league-1$/ },
  { country: "croatia", league: /^hnl$/ },
  { country: "serbia", league: /^super-liga$/ },
  { country: "ukraine", league: /^premier-league$/ },
  { country: "brazil", league: /^serie-a$/ },
  { country: /united-states|usa/, league: /^major-league-soccer$/ },
  { country: "australia", league: /^a-league$/ },
  { country: "japan", league: /^j1-league$/ },
  { country: "south-korea", league: /^k-league-1$/ },
  { country: "argentina", league: /liga-profesional-argentina|primera-division/ },
  { country: "mexico", league: /^liga-mx$/ },
  { country: "colombia", league: /primera-a/ },
  { country: "china", league: /^super-league$/ },
  { country: "saudi-arabia", league: /^pro-league$/ },
  { country: "azerbaijan", league: /premyer-liqa|premier-league/ },
  { country: "romania", league: /^liga-i$/ },
];

function normalizeLeagueValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function matchesCountryRule(
  normalizedCountry: string,
  countryRule: LeagueFavoriteRule["country"],
): boolean {
  if (!countryRule) {
    return true;
  }

  if (typeof countryRule === "string") {
    return normalizedCountry === countryRule;
  }

  return countryRule.test(normalizedCountry);
}

export function getDefaultLeagueFavoritePriority(group: Pick<LeagueGroup, "country" | "leagueName">): number | null {
  const normalizedCountry = normalizeLeagueValue(group.country);
  const normalizedLeague = normalizeLeagueValue(group.leagueName);

  for (const [index, rule] of defaultFavoriteRules.entries()) {
    if (!matchesCountryRule(normalizedCountry, rule.country)) {
      continue;
    }

    if (rule.league.test(normalizedLeague)) {
      return index;
    }
  }

  return null;
}

export function getDefaultLeagueFavoriteKeys(
  groups: readonly LeagueGroup[],
): Set<string> {
  const keys = new Set<string>();

  for (const group of groups) {
    if (getDefaultLeagueFavoritePriority(group) !== null) {
      keys.add(group.key);
    }
  }

  return keys;
}

export function sortGroupsByFavoritePriority(
  groups: readonly LeagueGroup[],
  favoriteLeagueKeys: ReadonlySet<string>,
): LeagueGroup[] {
  const indexedGroups = groups.map((group, index) => ({
    group,
    index,
    isFavorite: favoriteLeagueKeys.has(group.key),
    priority: getDefaultLeagueFavoritePriority(group),
  }));

  indexedGroups.sort((left, right) => {
    if (left.isFavorite !== right.isFavorite) {
      return left.isFavorite ? -1 : 1;
    }

    if (left.isFavorite && right.isFavorite) {
      const leftPriority = left.priority ?? Number.POSITIVE_INFINITY;
      const rightPriority = right.priority ?? Number.POSITIVE_INFINITY;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
    }

    return left.index - right.index;
  });

  return indexedGroups.map((entry) => entry.group);
}

export function isLiveStatus(
  statusShort: string,
  liveRetainUntil: string | null = null,
): boolean {
  if (liveStatuses.has(statusShort)) {
    return true;
  }

  return liveRetainUntil !== null && Date.parse(liveRetainUntil) > Date.now();
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

      if (filters.liveOnly && !isLiveStatus(match.statusShort, match.liveRetainUntil)) {
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

export function buildFavoriteGroups(
  groups: readonly LeagueGroup[],
  favoriteMatchIds: ReadonlySet<number>,
): LeagueGroup[] {
  const favoriteGroups: LeagueGroup[] = [];

  for (const group of groups) {
    const matchIds = group.matchIds.filter((matchId) => favoriteMatchIds.has(matchId));

    if (matchIds.length === 0) {
      continue;
    }

    favoriteGroups.push({
      ...group,
      matchIds,
    });
  }

  return favoriteGroups;
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
    "liveRetainUntil" in changes ||
    "homeTeam" in changes ||
    "awayTeam" in changes
  );
}
