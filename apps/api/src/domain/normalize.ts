import { createHash } from "node:crypto";
import type {
  LeagueGroup,
  MatchHighlight,
  MatchDetail,
  MatchDetailPrediction,
  MatchScore,
  NormalizedMatch,
  ProviderHighlight,
  ProviderLineupPlayer,
  ProviderLineupsResponse,
  ProviderMatchDetail,
  ProviderMatchEvent,
  ProviderPrediction,
  ProviderStandingGroup,
  ProviderStandingRecord,
  ProviderStandingsResponse,
  ProviderTeamStatistics,
  ProviderTopPlayer,
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
      logo:
        raw.league?.logo ??
        providerAssetUrl(
          "leagues",
          raw.league?.id !== undefined && raw.league?.id !== null ? String(raw.league.id) : `league-${leagueName}`
        ),
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
    redCards: normalizeRedCards(raw),
    isTopTier: isTopTier(countryName, leagueName),
    lastUpdatedAt: updatedAt,
    source: "highlightly"
  };
}

export function normalizeHighlight(raw: ProviderHighlight, timezone: string, updatedAt = new Date().toISOString()): MatchHighlight {
  return {
    id: String(raw.id),
    type: cleanString(raw.type),
    title: cleanString(raw.title) ?? "Maç özeti",
    description: cleanString(raw.description),
    imageUrl: cleanString(raw.imgUrl),
    url: cleanString(raw.url),
    embedUrl: cleanString(raw.embedUrl),
    source: cleanString(raw.source),
    channel: cleanString(raw.channel),
    match: raw.match ? normalizeMatch(raw.match, timezone, updatedAt) : null
  };
}

export function normalizeMatchDetail(
  raw: ProviderMatchDetail,
  timezone: string,
  fetchedAt: string,
  expiresAt: string,
  refreshPolicy: MatchDetail["refreshPolicy"],
  context: {
    headToHead?: ProviderMatch[];
    homeForm?: ProviderMatch[];
    awayForm?: ProviderMatch[];
    standings?: ProviderStandingsResponse | null;
    events?: ProviderMatchEvent[] | null;
    statistics?: ProviderTeamStatistics[] | null;
    lineups?: ProviderLineupsResponse | null;
  } = {}
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
    events: normalizeDetailEvents(context.events ?? raw.events),
    statistics: normalizeDetailStatistics(context.statistics ?? raw.statistics),
    headToHead: normalizeMatchList(context.headToHead, timezone, fetchedAt),
    form: {
      home: normalizeMatchList(context.homeForm, timezone, fetchedAt),
      away: normalizeMatchList(context.awayForm, timezone, fetchedAt)
    },
    standings: normalizeStandings(context.standings, match),
    lineups: normalizeLineups(context.lineups, match, fetchedAt),
    topPlayers: {
      home: normalizeTopPlayers(raw.homeTeam?.topPlayers),
      away: normalizeTopPlayers(raw.awayTeam?.topPlayers)
    },
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
        redCards: match.redCards,
        localTime: match.localTime
      }))
    }))
  };

  return createHash("sha256").update(JSON.stringify(stableShape)).digest("hex").slice(0, 16);
}

export function createHighlightsChecksum(highlights: MatchHighlight[]): string {
  const stableShape = highlights.map((highlight) => ({
    id: highlight.id,
    title: highlight.title,
    embedUrl: highlight.embedUrl,
    url: highlight.url,
    imageUrl: highlight.imageUrl,
    matchId: highlight.match?.id ?? null
  }));

  return createHash("sha256").update(JSON.stringify(stableShape)).digest("hex").slice(0, 16);
}

function createMatchDetailChecksum(detail: Omit<MatchDetail, "checksum">): string {
  const stableShape = {
    id: detail.id,
    status: detail.match.status,
    score: detail.match.score,
    redCards: detail.match.redCards,
    events: detail.events,
    statistics: detail.statistics,
    headToHead: detail.headToHead.map((match) => ({ id: match.id, score: match.score, status: match.status })),
    form: {
      home: detail.form.home.map((match) => ({ id: match.id, score: match.score, status: match.status })),
      away: detail.form.away.map((match) => ({ id: match.id, score: match.score, status: match.status }))
    },
    standings: detail.standings,
    predictions: detail.predictions
  };

  return createHash("sha256").update(JSON.stringify(stableShape)).digest("hex").slice(0, 16);
}

function normalizeTeam(team: ProviderMatch["homeTeam"], fallback: string) {
  const id = team?.id !== undefined && team.id !== null ? String(team.id) : fallback.toLowerCase();

  return {
    id,
    name: team?.name?.trim() || fallback,
    logo: team?.logo ?? providerAssetUrl("teams", id)
  };
}

function normalizeRedCards(raw: ProviderMatch) {
  const fromStatistics = redCardsFromStatistics(raw);
  if (fromStatistics) return fromStatistics;

  return redCardsFromEvents(raw);
}

function redCardsFromStatistics(raw: ProviderMatch) {
  if (!Array.isArray(raw.statistics)) return null;

  const cards = { home: 0, away: 0 };
  let found = false;

  for (const group of raw.statistics) {
    const side = providerTeamSide(group.team, raw);
    if (!side || !Array.isArray(group.statistics)) continue;

    const redCardStat = group.statistics.find((item) => isRedCardLabel(item.displayName));
    if (!redCardStat) continue;

    cards[side] = Math.max(0, normalizeCardCount(redCardStat.value));
    found = true;
  }

  return found ? cards : null;
}

function redCardsFromEvents(raw: ProviderMatch) {
  const cards = { home: 0, away: 0 };
  if (!Array.isArray(raw.events)) return cards;

  for (const event of raw.events) {
    if (!isRedCardLabel(event.type)) continue;

    const side = providerTeamSide(event.team, raw);
    if (side) cards[side] += 1;
  }

  return cards;
}

function providerTeamSide(team: ProviderMatch["homeTeam"], raw: ProviderMatch) {
  const teamId = providerEntityId(team?.id);
  const homeId = providerEntityId(raw.homeTeam?.id);
  const awayId = providerEntityId(raw.awayTeam?.id);

  if (teamId && homeId && teamId === homeId) return "home" as const;
  if (teamId && awayId && teamId === awayId) return "away" as const;

  const teamName = cleanString(team?.name)?.toLowerCase();
  if (!teamName) return null;
  if (teamName === cleanString(raw.homeTeam?.name)?.toLowerCase()) return "home" as const;
  if (teamName === cleanString(raw.awayTeam?.name)?.toLowerCase()) return "away" as const;
  return null;
}

function providerEntityId(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function isRedCardLabel(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "";
  return normalized.includes("red") && normalized.includes("card");
}

function normalizeCardCount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
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
              value: item.value ?? null,
              period: normalizeStatisticPeriodLabel(item)
            }))
        : []
    }))
    .filter((group) => group.statistics.length > 0);
}

function normalizeStatisticPeriodLabel(item: {
  period?: number | string | null;
  half?: number | string | null;
  group?: number | string | null;
  scope?: number | string | null;
  matchPeriod?: number | string | null;
}) {
  return (
    cleanString(item.period) ??
    cleanString(item.half) ??
    cleanString(item.matchPeriod) ??
    cleanString(item.group) ??
    cleanString(item.scope)
  );
}

function normalizeMatchList(matches: ProviderMatch[] | null | undefined, timezone: string, fetchedAt: string) {
  if (!Array.isArray(matches)) return [];
  return matches.map((match) => normalizeMatch(match, timezone, fetchedAt));
}

function normalizeTopPlayers(players: ProviderTopPlayer[] | null | undefined) {
  if (!Array.isArray(players)) return [];

  return players
    .filter((player) => cleanString(player.name))
    .map((player) => ({
      name: cleanString(player.name) ?? "Player",
      position: cleanString(player.position),
      statistics: Array.isArray(player.statistics)
        ? player.statistics
            .filter((stat) => cleanString(stat.name))
            .map((stat) => ({
              name: cleanString(stat.name) ?? "Statistic",
              value: stat.value ?? null
            }))
        : []
    }));
}

function normalizeStandings(raw: ProviderStandingsResponse | null | undefined, fallbackMatch: NormalizedMatch) {
  const groups = raw?.groups;
  if (!Array.isArray(groups)) return null;

  const normalizedGroups = groups
    .map((group: ProviderStandingGroup) => ({
      name: cleanString(group.name) ?? fallbackMatch.league.name,
      rows: Array.isArray(group.standings)
        ? group.standings.map((row) => ({
            team: normalizeTeam(row.team, "Team"),
            position: typeof row.position === "number" ? row.position : null,
            points: typeof row.points === "number" ? row.points : null,
            total: normalizeStandingRecord(row.total),
            home: normalizeStandingRecord(row.home),
            away: normalizeStandingRecord(row.away)
          }))
        : []
    }))
    .filter((group) => group.rows.length > 0);

  if (normalizedGroups.length === 0) return null;

  return {
    league: {
      id: raw?.league?.id !== undefined && raw.league.id !== null ? String(raw.league.id) : fallbackMatch.league.id,
      name: raw?.league?.name?.trim() || fallbackMatch.league.name,
      logo:
        raw?.league?.logo ??
        providerAssetUrl("leagues", raw?.league?.id !== undefined && raw.league.id !== null ? String(raw.league.id) : fallbackMatch.league.id),
      season: raw?.league?.season !== undefined && raw.league.season !== null ? String(raw.league.season) : fallbackMatch.league.season
    },
    groups: normalizedGroups
  };
}

function normalizeLineups(raw: ProviderLineupsResponse | null | undefined, fallbackMatch: NormalizedMatch, fetchedAt: string) {
  if (!raw?.homeTeam && !raw?.awayTeam) return null;

  const home = normalizeLineupTeam(raw.homeTeam, fallbackMatch.homeTeam);
  const away = normalizeLineupTeam(raw.awayTeam, fallbackMatch.awayTeam);
  if (!home && !away) return null;

  return {
    home,
    away,
    fetchedAt
  };
}

function normalizeLineupTeam(raw: ProviderLineupsResponse["homeTeam"], fallbackTeam: NormalizedMatch["homeTeam"]) {
  if (!raw) return null;

  const initialLineup = Array.isArray(raw.initialLineup)
    ? raw.initialLineup
        .map((row) => (Array.isArray(row) ? row.map(normalizeLineupPlayer).filter((player) => player.name) : []))
        .filter((row) => row.length > 0)
    : [];
  const substitutes = Array.isArray(raw.substitutes)
    ? raw.substitutes.map(normalizeLineupPlayer).filter((player) => player.name)
    : [];

  if (initialLineup.length === 0 && substitutes.length === 0 && !cleanString(raw.formation)) return null;

  return {
    team: normalizeTeam(raw, fallbackTeam.name),
    formation: cleanString(raw.formation),
    initialLineup,
    substitutes
  };
}

function normalizeLineupPlayer(player: ProviderLineupPlayer) {
  return {
    id: providerEntityId(player.id),
    name: cleanString(player.name) ?? "",
    number: normalizeNumber(player.number),
    position: cleanString(player.position)
  };
}

function normalizeStandingRecord(record: ProviderStandingRecord | null | undefined) {
  return {
    wins: record?.wins ?? 0,
    draws: record?.draws ?? 0,
    games: record?.games ?? 0,
    loses: record?.loses ?? 0,
    scoredGoals: record?.scoredGoals ?? 0,
    receivedGoals: record?.receivedGoals ?? 0
  };
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
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerAssetUrl(kind: "teams" | "leagues", id: string) {
  if (!id || !/^\d+$/.test(id)) return null;
  return `https://highlightly.net/soccer/images/${kind}/${encodeURIComponent(id)}.png`;
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
