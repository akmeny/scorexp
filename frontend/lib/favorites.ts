export interface FavoriteSnapshot {
  leagueKeys: string[];
  matchIds: number[];
  disabledDefaultLeagueKeys: string[];
}

const favoritesStorageKey = "scorexp-favorites";

function createEmptyFavoriteSnapshot(): FavoriteSnapshot {
  return {
    leagueKeys: [],
    matchIds: [],
    disabledDefaultLeagueKeys: [],
  };
}

export function loadFavorites(): FavoriteSnapshot {
  if (typeof window === "undefined") {
    return createEmptyFavoriteSnapshot();
  }

  try {
    const raw = window.localStorage.getItem(favoritesStorageKey);

    if (!raw) {
      return createEmptyFavoriteSnapshot();
    }

    const parsed = JSON.parse(raw) as Partial<FavoriteSnapshot>;

    return {
      leagueKeys: Array.isArray(parsed.leagueKeys)
        ? parsed.leagueKeys.filter((value): value is string => typeof value === "string")
        : [],
      matchIds: Array.isArray(parsed.matchIds)
        ? parsed.matchIds.filter((value): value is number => Number.isInteger(value))
        : [],
      disabledDefaultLeagueKeys: Array.isArray(parsed.disabledDefaultLeagueKeys)
        ? parsed.disabledDefaultLeagueKeys.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    };
  } catch {
    return createEmptyFavoriteSnapshot();
  }
}

export function saveFavorites(snapshot: FavoriteSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(favoritesStorageKey, JSON.stringify(snapshot));
  } catch {
    // Ignore storage write failures.
  }
}
