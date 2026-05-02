import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppEnv } from "../config/env.js";
import type { ScoreboardView } from "../domain/types.js";
import type { ScoreboardService } from "../services/scoreboard.js";
import { isValidDateString, localDate } from "../utils/date.js";

const querySchema = z.object({
  date: z.string().optional(),
  timezone: z.string().optional(),
  view: z.enum(["all", "live", "finished", "upcoming"]).optional()
});

const detailParamsSchema = z.object({
  id: z.string().min(1)
});

const detailQuerySchema = z.object({
  timezone: z.string().optional()
});

export async function registerFootballRoutes(app: FastifyInstance, service: ScoreboardService, appEnv: AppEnv) {
  app.get("/api/v1/football/scoreboard", async (request, reply) => {
    const parsed = querySchema.parse(request.query);
    const timezone = parsed.timezone ?? appEnv.defaultTimezone;
    const date = parsed.date ?? localDate(timezone);
    const view: ScoreboardView = parsed.view ?? "all";

    if (!isValidDateString(date)) {
      return reply.code(400).send({ message: "date must be YYYY-MM-DD" });
    }

    const snapshot = await service.getScoreboard({ date, timezone, view });
    const etag = `"${snapshot.checksum}:${snapshot.view}"`;

    reply.header("Cache-Control", "no-store");
    reply.header("ETag", etag);

    if (request.headers["if-none-match"] === etag) {
      return reply.code(304).send();
    }

    return snapshot;
  });

  app.get("/api/v1/football/matches/:id/detail", async (request, reply) => {
    const params = detailParamsSchema.parse(request.params);
    const parsed = detailQuerySchema.parse(request.query);
    const timezone = parsed.timezone ?? appEnv.defaultTimezone;

    const detail = await service.getMatchDetail({ matchId: params.id, timezone });
    const etag = `"${detail.checksum}"`;

    reply.header("Cache-Control", "no-store");
    reply.header("ETag", etag);

    if (request.headers["if-none-match"] === etag) {
      return reply.code(304).send();
    }

    return detail;
  });

  app.get("/api/v1/football/flow", async () => ({
    title: "ScoreXP Football Data Flow",
    nodes: [
      { id: "browser", label: "Tarayici", role: "UI state + silent refresh" },
      { id: "api", label: "Fastify API", role: "Stable scoreboard contract" },
      { id: "cache", label: "Redis hot cache", role: "3m / 15m / 24h provider gate" },
      { id: "store", label: "Durable finished store", role: "Bitmis maclari kilitler" },
      { id: "provider", label: "Highlightly Football API", role: "Football source of truth" }
    ],
    edges: [
      ["browser", "api", "30 sn sessiz fetch"],
      ["api", "cache", "checksum + TTL kontrol"],
      ["api", "store", "bitmis mac snapshot kontrol"],
      ["api", "provider", "yalnizca sure dolunca"],
      ["provider", "api", "raw match payload"],
      ["api", "store", "normalize + finished write-once"],
      ["api", "browser", "stable grouped snapshot"]
    ]
  }));
}
