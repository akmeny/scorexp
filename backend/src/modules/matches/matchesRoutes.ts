import type { FastifyInstance } from "fastify";
import type { MatchStore } from "./matchStore.js";

interface MatchIdParams {
  id: string;
}

export async function registerMatchesRoutes(
  app: FastifyInstance,
  store: MatchStore,
): Promise<void> {
  app.get("/api/matches/live", async () => {
    return {
      matches: store.getAll(),
      generatedAt: new Date().toISOString(),
      total: store.size(),
    };
  });

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
