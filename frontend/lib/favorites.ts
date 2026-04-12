export interface FavoriteSnapshot {
  leagueKeys: string[];
  matchIds: number[];
}

const favoritesStorageKey = "scorexp-favorites";

export function loadFavorites(): FavoriteSnapshot {
  if (typeof window === "undefined") {
    return {
      leagueKeys: [],
      matchIds: [],
    };
  }

  try {
    const raw = window.localStorage.getItem(favoritesStorageKey);

    if (!raw) {
      return {
        leagueKeys: [],
        matchIds: [],
      };
    }

    const parsed = JSON.parse(raw) as Partial<FavoriteSnapshot>;

    return {
      leagueKeys: Array.isArray(parsed.leagueKeys)
        ? parsed.leagueKeys.filter((value): value is string => typeof value === "string")
        : [],
      matchIds: Array.isArray(parsed.matchIds)
        ? parsed.matchIds.filter((value): value is number => Number.isInteger(value))
        : [],
    };
  } catch {
    return {
      leagueKeys: [],
      matchIds: [],
    };
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
