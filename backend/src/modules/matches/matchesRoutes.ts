import type { FastifyInstance } from "fastify";
import type { MatchStore } from "./matchStore.js";

interface MatchIdParams {
  id: string;
}

interface MatchesQuery {
  offset?: string;
  limit?: string;
  q?: string;
  liveOnly?: string;
}

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"]);

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  max: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export async function registerMatchesRoutes(
  app: FastifyInstance,
  store: MatchStore,
): Promise<void> {
  const getSnapshot = async (request: { query: MatchesQuery }) => {
    const offset = parsePositiveInteger(request.query.offset, 0, 100_000);
    const hasExplicitLimit = typeof request.query.limit === "string";
    const limit = hasExplicitLimit
      ? parsePositiveInteger(request.query.limit, 80, 200)
      : null;
    const query = request.query.q?.trim().toLowerCase() ?? "";
    const liveOnly = parseBoolean(request.query.liveOnly);
    const allMatches = store.getAll();
    const filteredMatches = allMatches.filter((match) => {
      if (liveOnly && !liveStatuses.has(match.statusShort)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        match.homeTeam.name.toLowerCase().includes(query) ||
        match.awayTeam.name.toLowerCase().includes(query) ||
        match.leagueName.toLowerCase().includes(query) ||
        match.country.toLowerCase().includes(query)
      );
    });
    const pagedMatches =
      limit === null
        ? filteredMatches
        : filteredMatches.slice(offset, offset + limit);
    const nextOffset =
      limit !== null && offset + pagedMatches.length < filteredMatches.length
        ? offset + pagedMatches.length
        : null;

    return {
      matches: pagedMatches,
      generatedAt: new Date().toISOString(),
      total: filteredMatches.length,
      offset,
      limit: limit ?? filteredMatches.length,
      nextOffset,
      hasMore: nextOffset !== null,
    };
  };

  app.get<{ Querystring: MatchesQuery }>("/api/matches/today", getSnapshot);
  app.get<{ Querystring: MatchesQuery }>("/api/matches/live", getSnapshot);

  app.get<{ Params: MatchIdParams }>("/api/matches/:id", async (request, reply) => {
    const matchId = Number(request.params.id);

    if (!Number.isInteger(matchId) || matchId <= 0) {
      return reply.code(400).send({
        error: "Invalid match id",
      });
    }

    const match = store.getById(matchId);

    if (!match) {
      return reply.code(404).send({
        error: "Match not found",
      });
    }

    return {
      match,
      freshness: store.getFreshness(matchId),
    };
  });
}
