import type { FastifyBaseLogger } from "fastify";
import type { ApiSportsClient } from "./apiSportsClient.js";
import {
  buildTournamentSummary,
  normalizeDetailedStatistics,
  normalizeFixtureDetails,
  normalizeHeadToHead,
  normalizeLineups,
  normalizePlayerSections,
  normalizePrediction,
  normalizeRecentForm,
  normalizeStandings,
  normalizeTimelineEvent,
  summarizeTeamSeasonStats,
} from "./normalizer.js";
import type {
  MatchDetailTabKey,
  MatchFormSummary,
  MatchFullDetail,
  MatchStandingsSummary,
  NormalizedMatch,
} from "./types.js";

interface MatchDetailCoverage {
  events: boolean;
  statistics: boolean;
  lineups: boolean;
  players: boolean;
  standings: boolean;
  predictions: boolean;
  leagueType: string | null;
}

interface MatchDetailCacheEntry {
  detail: MatchFullDetail;
  expiresAt: number;
}

interface CoverageCacheEntry {
  coverage: MatchDetailCoverage;
  expiresAt: number;
}

interface StandingsCacheEntry {
  standings: MatchStandingsSummary | null;
  expiresAt: number;
}

export class MatchDetailService {
  private readonly detailCache = new Map<number, MatchDetailCacheEntry>();

  private readonly coverageCache = new Map<string, CoverageCacheEntry>();

  private readonly standingsCache = new Map<string, StandingsCacheEntry>();

  constructor(
    private readonly client: ApiSportsClient,
    private readonly logger: FastifyBaseLogger,
    private readonly providerEnabled: boolean,
  ) {}

  async getDetail(match: NormalizedMatch): Promise<MatchFullDetail> {
    const cached = this.detailCache.get(match.matchId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.detail;
    }

    const generatedAt = new Date().toISOString();

    if (!this.providerEnabled) {
      return this.cacheDetail(match.matchId, {
        fixture: null,
        statistics: [],
        events: [],
        lineups: [],
        players: [],
        headToHead: [],
        form: null,
        standings: null,
        predictions: null,
        tournament: null,
        availableTabs: ["summary"],
        generatedAt,
      }, match);
    }

    const fixtureResponse = await this.trySection(
      "fixture",
      match.matchId,
      () => this.client.getFixtureById(match.matchId),
    );
    const fixture = fixtureResponse?.data[0] ?? null;
    const season = fixture?.league.season ?? null;
    const coverage =
      fixture && season
        ? await this.getCoverage(fixture.league.id, season)
        : {
            events: true,
            statistics: true,
            lineups: true,
            players: true,
            standings: false,
            predictions: true,
            leagueType: null,
          };

    const [
      eventsResponse,
      statisticsResponse,
      lineupsResponse,
      playersResponse,
      headToHeadResponse,
      homeRecentResponse,
      awayRecentResponse,
      standings,
      homeSeasonStats,
      awaySeasonStats,
      predictionResponse,
    ] = await Promise.all([
      coverage.events
        ? this.trySection("events", match.matchId, () =>
            this.client.getFixtureEvents(match.matchId),
          )
        : Promise.resolve(null),
      coverage.statistics
        ? this.trySection("statistics", match.matchId, () =>
            this.client.getFixtureStatistics(match.matchId),
          )
        : Promise.resolve(null),
      coverage.lineups
        ? this.trySection("lineups", match.matchId, () =>
            this.client.getFixtureLineups(match.matchId),
          )
        : Promise.resolve(null),
      coverage.players
        ? this.trySection("players", match.matchId, () =>
            this.client.getFixturePlayers(match.matchId),
          )
        : Promise.resolve(null),
      this.trySection("headtohead", match.matchId, () =>
        this.client.getFixturesHeadToHead(match.homeTeam.id, match.awayTeam.id, 10),
      ),
      this.trySection("form-home", match.matchId, () =>
        this.client.getRecentFixturesForTeam(match.homeTeam.id, 10),
      ),
      this.trySection("form-away", match.matchId, () =>
        this.client.getRecentFixturesForTeam(match.awayTeam.id, 10),
      ),
      coverage.standings && season
        ? this.getStandings(match.leagueId, season, match.homeTeam.id, match.awayTeam.id)
        : Promise.resolve(null),
      season
        ? this.trySection("team-stats-home", match.matchId, () =>
            this.client.getTeamStatistics(match.leagueId, season, match.homeTeam.id),
          )
        : Promise.resolve(null),
      season
        ? this.trySection("team-stats-away", match.matchId, () =>
            this.client.getTeamStatistics(match.leagueId, season, match.awayTeam.id),
          )
        : Promise.resolve(null),
      coverage.predictions
        ? this.trySection("predictions", match.matchId, () =>
            this.client.getPredictions(match.matchId),
          )
        : Promise.resolve(null),
    ]);

    const fixtureDetails = fixture ? normalizeFixtureDetails(fixture) : null;
    const finalFixtureDetails = fixtureDetails
      ? {
          ...fixtureDetails,
          leagueType: coverage.leagueType,
        }
      : null;
    const statistics = statisticsResponse
      ? normalizeDetailedStatistics(
          statisticsResponse.data,
          match.homeTeam.id,
          match.awayTeam.id,
        )
      : [];
    const events = (eventsResponse?.data ?? [])
      .map(normalizeTimelineEvent)
      .sort((left, right) => {
        const leftValue = (left.minute ?? 0) * 100 + (left.extraMinute ?? 0);
        const rightValue = (right.minute ?? 0) * 100 + (right.extraMinute ?? 0);
        return rightValue - leftValue;
      });
    const lineups = normalizeLineups(lineupsResponse?.data ?? []);
    const players = normalizePlayerSections(playersResponse?.data ?? []);
    const headToHead = normalizeHeadToHead(headToHeadResponse?.data ?? []).filter(
      (fixtureEntry) => fixtureEntry.matchId !== match.matchId,
    );

    const homeRecent = normalizeRecentForm(homeRecentResponse?.data ?? [], match.homeTeam.id)
      .filter((fixtureEntry) => fixtureEntry.matchId !== match.matchId)
      .slice(0, 10);
    const awayRecent = normalizeRecentForm(awayRecentResponse?.data ?? [], match.awayTeam.id)
      .filter((fixtureEntry) => fixtureEntry.matchId !== match.matchId)
      .slice(0, 10);

    const form: MatchFormSummary | null =
      homeRecent.length > 0 || awayRecent.length > 0 || homeSeasonStats || awaySeasonStats
        ? {
            home: {
              teamId: match.homeTeam.id,
              teamName: match.homeTeam.name,
              teamLogo: match.homeTeam.logo,
              last5: homeRecent.slice(0, 5),
              last10: homeRecent,
              seasonStats: summarizeTeamSeasonStats(homeSeasonStats?.data[0] ?? null),
            },
            away: {
              teamId: match.awayTeam.id,
              teamName: match.awayTeam.name,
              teamLogo: match.awayTeam.logo,
              last5: awayRecent.slice(0, 5),
              last10: awayRecent,
              seasonStats: summarizeTeamSeasonStats(awaySeasonStats?.data[0] ?? null),
            },
          }
        : null;

    const predictions = normalizePrediction(predictionResponse?.data[0] ?? null);
    const tournament = buildTournamentSummary(finalFixtureDetails, standings);
    const availableTabs = this.buildAvailableTabs({
      statistics,
      events,
      lineups,
      players,
      headToHead,
      form,
      standings,
      tournament,
      predictions,
    });

    return this.cacheDetail(
      match.matchId,
      {
        fixture: finalFixtureDetails,
        statistics,
        events,
        lineups,
        players,
        headToHead,
        form,
        standings,
        predictions,
        tournament,
        availableTabs,
        generatedAt,
      },
      match,
    );
  }

  private cacheDetail(
    matchId: number,
    detail: MatchFullDetail,
    match: NormalizedMatch,
  ): MatchFullDetail {
    this.detailCache.set(matchId, {
      detail,
      expiresAt: Date.now() + this.getDetailTtlMs(match.statusShort),
    });

    return detail;
  }

  private getDetailTtlMs(statusShort: string): number {
    if (["1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"].includes(statusShort)) {
      return 25_000;
    }

    if (["NS", "TBD"].includes(statusShort)) {
      return 10 * 60 * 1000;
    }

    return 45 * 60 * 1000;
  }

  private async getCoverage(
    leagueId: number,
    season: number,
  ): Promise<MatchDetailCoverage> {
    const key = `${leagueId}:${season}`;
    const cached = this.coverageCache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.coverage;
    }

    const response = await this.trySection("league-coverage", leagueId, () =>
      this.client.getLeague(leagueId, season),
    );

    const seasonCoverage = response?.data[0]?.seasons?.find(
      (entry) => entry.year === season,
    );
    const coverage: MatchDetailCoverage = {
      events: seasonCoverage?.coverage?.fixtures?.events ?? true,
      statistics:
        seasonCoverage?.coverage?.fixtures?.statistics_fixtures ?? true,
      lineups: seasonCoverage?.coverage?.fixtures?.lineups ?? true,
      players:
        seasonCoverage?.coverage?.players ??
        seasonCoverage?.coverage?.fixtures?.statistics_players ??
        true,
      standings: seasonCoverage?.coverage?.standings ?? false,
      predictions: seasonCoverage?.coverage?.predictions ?? true,
      leagueType: response?.data[0]?.league?.type?.trim() || null,
    };

    this.coverageCache.set(key, {
      coverage,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return coverage;
  }

  private async getStandings(
    leagueId: number,
    season: number,
    homeTeamId: number,
    awayTeamId: number,
  ): Promise<MatchStandingsSummary | null> {
    const key = `${leagueId}:${season}`;
    const cached = this.standingsCache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.standings;
    }

    const response = await this.trySection("standings", leagueId, () =>
      this.client.getStandings(leagueId, season),
    );
    const standings = normalizeStandings(
      response?.data[0] ?? null,
      homeTeamId,
      awayTeamId,
    );

    this.standingsCache.set(key, {
      standings,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return standings;
  }

  private buildAvailableTabs(sections: {
    statistics: MatchFullDetail["statistics"];
    events: MatchFullDetail["events"];
    lineups: MatchFullDetail["lineups"];
    players: MatchFullDetail["players"];
    headToHead: MatchFullDetail["headToHead"];
    form: MatchFullDetail["form"];
    standings: MatchFullDetail["standings"];
    tournament: MatchFullDetail["tournament"];
    predictions: MatchFullDetail["predictions"];
  }): MatchDetailTabKey[] {
    const tabs: MatchDetailTabKey[] = ["summary"];

    if (sections.statistics.length > 0) {
      tabs.push("statistics");
    }

    if (sections.events.length > 0) {
      tabs.push("events");
    }

    if (sections.lineups.length > 0) {
      tabs.push("lineups");
    }

    if (sections.players.length > 0) {
      tabs.push("players");
    }

    if (sections.headToHead.length > 0) {
      tabs.push("h2h");
    }

    if (
      sections.form &&
      (sections.form.home.last10.length > 0 ||
        sections.form.away.last10.length > 0 ||
        sections.form.home.seasonStats !== null ||
        sections.form.away.seasonStats !== null)
    ) {
      tabs.push("form");
    }

    if (sections.standings && sections.standings.groups.length > 0) {
      tabs.push("standings");
    }

    if (
      sections.tournament &&
      (sections.tournament.round ||
        sections.tournament.venueName ||
        sections.tournament.referee ||
        sections.tournament.homeStandingDescription ||
        sections.tournament.awayStandingDescription)
    ) {
      tabs.push("tournament");
    }

    if (
      sections.predictions &&
      (sections.predictions.advice ||
        sections.predictions.winnerName ||
        sections.predictions.percentHome ||
        Object.keys(sections.predictions.comparison).length > 0)
    ) {
      tabs.push("predictions");
    }

    return tabs;
  }

  private async trySection<T>(
    section: string,
    matchId: number,
    loader: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await loader();
    } catch (error) {
      this.logger.warn(
        {
          error,
          section,
          matchId,
        },
        "Match detail section fetch failed",
      );

      return null;
    }
  }
}
