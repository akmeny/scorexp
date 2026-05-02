import { createHash } from "node:crypto";
import type {
  LeagueGroup,
  MatchDetail,
  MatchDetailPrediction,
  MatchScore,
  NormalizedMatch,
  ProviderMatchDetail,
  ProviderMatchEvent,
  ProviderPrediction,
  ProviderTeamStatistics,
  ProviderMatch,
  ScoreboardSnapshot,
  ScoreboardView,
  StatusGroup
} from "./types.js";

const LIVE_STATES = new Set([
  "First half",
  "Second half",
  "Half time",
  "Extra time",
  "Break time",
  "Penalties",
  "Suspended",
  "Interrupted",
  "In progress"
]);

const FINISHED_STATES = new Set([
  "Finished",
  "Finished after penalties",
  "Finished after extra time",
  "Cancelled",
  "Awarded",
  "Abandoned"
]);

const UPCOMING_STATES = new Set(["Not started", "Postponed", "To be announced"]);

const TOP_LEAGUE_HINTS = [
  "super lig",
  "premier league",
  "la liga",
  "serie a",
  "bundesliga",
  "ligue 1",
  "champions league",
  "europa league",
  "conference league",
  "eredivisie",
  "primeira liga",
  "major league soccer",
  "world cup",
  "euro"
];

export function classifyStatus(description: string | null | undefined): StatusGroup {
  const normalized = description?.trim();
  if (!normalized) return "unknown";
  if (LIVE_STATES.has(normalized)) return "live";
  if (FINISHED_STATES.has(normalized)) return "finished";
  if (UPCOMING_STATES.has(normalized)) return "upcoming";
  return "unknown";
}

export function parseScore(raw: string | null | undefined, penaltiesRaw?: string | null): MatchScore {
  const [home, away] = splitScore(raw);
  const [penaltiesHome, penaltiesAway] = splitScore(penaltiesRaw);

  return {
    home,
    away,
    penaltiesHome,
    penaltiesAway,
    raw: raw ?? null,
    penaltiesRaw: penaltiesRaw ?? null
  };
}

export function normalizeMatch(raw: ProviderMatch, timezone: string, updatedAt = new Date().toISOString()): NormalizedMatch {
  const date = raw.date ?? updatedAt;
  const statusDescription = raw.state?.description?.trim() || "Unknown";
  const leagueName = raw.league?.name?.trim() || "Unknown League";
  const countryName = raw.country?.name?.trim() || "World";

  return {
    id: String(raw.id),
    providerId: String(raw.id),
    round: raw.round ?? null,
    date,
    localTime: formatLocalTime(date, timezone),
    timestamp: Date.parse(date) || Date.now(),
    country: {
      code: raw.country?.code ? String(raw.country.code) : "World",
      name: countryName,
      logo: raw.country?.logo ?? null
    },
    league: {
      id: raw.league?.id !== undefined && raw.league?.id !== null ? String(raw.league.id) : `league-${leagueName}`,
      name: leagueName,
      logo: raw.league?.logo ?? null,
      season: raw.league?.season !== undefined && raw.league?.season !== null ? String(raw.league.season) : null
    },
    homeTeam: normalizeTeam(raw.homeTeam, "Home"),
    awayTeam: normalizeTeam(raw.awayTeam, "Away"),
    status: {
      description: statusDescription,
      group: classifyStatus(statusDescription),
      minute: normalizeMinute(raw.state?.clock)
    },
    score: parseScore(raw.state?.score?.current, raw.state?.score?.penalties),
    isTopTier: isTopTier(countryName, leagueName),
    lastUpdatedAt: updatedAt,
    source: "highlightly"
  };
}

export function normalizeMatchDetail(
  raw: ProviderMatchDetail,
  timezone: string,
  fetchedAt: string,
  expiresAt: string,
  refreshPolicy: MatchDetail["refreshPolicy"]
): MatchDetail {
  const match = normalizeMatch(raw, timezone, fetchedAt);
  const detail = {
    id: match.id,
    source: "highlightly" as const,
    fetchedAt,
    expiresAt,
    refreshPolicy,
    match,
    venue: {
      name: cleanString(raw.venue?.name),
      city: cleanString(raw.venue?.city),
      country: cleanString(raw.venue?.country),
      capacity: normalizeNumber(raw.venue?.capacity)
    },
    referee: {
      name: cleanString(raw.referee?.name),
      nationality: cleanString(raw.referee?.nationality)
    },
    forecast: {
      status: cleanString(raw.forecast?.status),
      temperature: normalizeNumber(raw.forecast?.temperature)
    },
    events: normalizeDetailEvents(raw.events),
    statistics: normalizeDetailStatistics(raw.statistics),
    predictions: {
      latestLive: latestPrediction(raw.predictions?.live),
      latestPrematch: latestPrediction(raw.predictions?.prematch)
    }
  };

  return {
    ...detail,
    checksum: createMatchDetailChecksum(detail)
  };
}

export function groupMatches(matches: NormalizedMatch[]): LeagueGroup[] {
  const groups = new Map<string, LeagueGroup>();

  for (const match of matches) {
    const key = `${match.country.code}:${match.league.id}`;
    const existing =
      groups.get(key) ??
      ({
        key,
        country: match.country,
        league: match.league,
        isTopTier: match.isTopTier,
        counts: { live: 0, finished: 0, upcoming: 0, unknown: 0 },
        matches: []
      } satisfies LeagueGroup);

    existing.counts[match.status.group] += 1;
    existing.matches.push(match);
    existing.isTopTier = existing.isTopTier || match.isTopTier;
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      matches: group.matches.sort((a, b) => a.timestamp - b.timestamp || a.homeTeam.name.localeCompare(b.homeTeam.name))
    }))
    .sort((a, b) => {
      const liveDiff = b.counts.live - a.counts.live;
      if (liveDiff !== 0) return liveDiff;
      if (a.isTopTier !== b.isTopTier) return a.isTopTier ? -1 : 1;
      const countryDiff = a.country.name.localeCompare(b.country.name);
      if (countryDiff !== 0) return countryDiff;
      return a.league.name.localeCompare(b.league.name);
    });
}

export function filterSnapshot(snapshot: ScoreboardSnapshot, view: ScoreboardView): ScoreboardSnapshot {
  if (view === "all") return { ...snapshot, view };

  const leagues = snapshot.leagues
    .map((league) => {
      const matches = league.matches.filter((match) => match.status.group === view);
      return {
        ...league,
        matches,
        counts: matches.reduce(
          (acc, match) => {
            acc[match.status.group] += 1;
            return acc;
          },
          { live: 0, finished: 0, upcoming: 0, unknown: 0 } as LeagueGroup["counts"]
        )
      };
    })
    .filter((league) => league.matches.length > 0);

  return { ...snapshot, view, leagues, counts: countMatches(leagues) };
}

export function countMatches(leagues: LeagueGroup[]): Record<StatusGroup | "all", number> {
  const counts: Record<StatusGroup | "all", number> = {
    all: 0,
    live: 0,
    finished: 0,
    upcoming: 0,
    unknown: 0
  };

  for (const league of leagues) {
    for (const match of league.matches) {
      counts.all += 1;
      counts[match.status.group] += 1;
    }
  }

  return counts;
}

export function createSnapshotChecksum(snapshot: Omit<ScoreboardSnapshot, "checksum">): string {
  const stableShape = {
    date: snapshot.date,
    timezone: snapshot.timezone,
    counts: snapshot.counts,
    leagues: snapshot.leagues.map((league) => ({
      key: league.key,
      matches: league.matches.map((match) => ({
        id: match.id,
        status: match.status,
        score: match.score,
        localTime: match.localTime
      }))
    }))
  };

  return createHash("sha256").update(JSON.stringify(stableShape)).digest("hex").slice(0, 16);
}

function createMatchDetailChecksum(detail: Omit<MatchDetail, "checksum">): string {
  const stableShape = {
    id: detail.id,
    status: detail.match.status,
    score: detail.match.score,
    events: detail.events,
    statistics: detail.statistics,
    predictions: detail.predictions
  };

  return createHash("sha256").update(JSON.stringify(stableShape)).digest("hex").slice(0, 16);
}

function normalizeTeam(team: ProviderMatch["homeTeam"], fallback: string) {
  return {
    id: team?.id !== undefined && team.id !== null ? String(team.id) : fallback.toLowerCase(),
    name: team?.name?.trim() || fallback,
    logo: team?.logo ?? null
  };
}

function normalizeDetailEvents(events: ProviderMatchEvent[] | null | undefined) {
  if (!Array.isArray(events)) return [];

  return events
    .filter((event) => cleanString(event.type))
    .map((event) => ({
      team: normalizeTeam(event.team, "Team"),
      time: event.time !== undefined && event.time !== null && event.time !== "" ? String(event.time) : null,
      type: cleanString(event.type) ?? "Event",
      player: cleanString(event.player),
      assist: cleanString(event.assist),
      substituted: cleanString(event.substituted)
    }));
}

function normalizeDetailStatistics(groups: ProviderTeamStatistics[] | null | undefined) {
  if (!Array.isArray(groups)) return [];

  return groups
    .map((group) => ({
      team: normalizeTeam(group.team, "Team"),
      statistics: Array.isArray(group.statistics)
        ? group.statistics
            .filter((item) => cleanString(item.displayName))
            .map((item) => ({
              displayName: cleanString(item.displayName) ?? "Statistic",
              value: item.value ?? null
            }))
        : []
    }))
    .filter((group) => group.statistics.length > 0);
}

function latestPrediction(items: ProviderPrediction[] | null | undefined): MatchDetailPrediction | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const latest = items[items.length - 1];

  return {
    type: cleanString(latest.type),
    modelType: cleanString(latest.modelType),
    description: cleanString(latest.description),
    generatedAt: cleanString(latest.generatedAt),
    probabilities: {
      home: cleanString(latest.probabilities?.home),
      draw: cleanString(latest.probabilities?.draw),
      away: cleanString(latest.probabilities?.away)
    }
  };
}

function cleanString(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitScore(raw: string | null | undefined): [number | null, number | null] {
  if (!raw) return [null, null];
  const match = raw.match(/(-?\d+)\s*-\s*(-?\d+)/);
  if (!match) return [null, null];
  return [Number(match[1]), Number(match[2])];
}

function normalizeMinute(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLocalTime(date: string, timezone: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "--:--";

  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed);
}

function isTopTier(countryName: string, leagueName: string) {
  const haystack = `${countryName} ${leagueName}`.toLowerCase();
  return TOP_LEAGUE_HINTS.some((hint) => haystack.includes(hint));
}
