import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { HighlightlyClient } from "./provider/highlightly.js";
import { registerFootballRoutes } from "./routes/football.js";
import { ScoreboardService } from "./services/scoreboard.js";
import { createHotCache } from "./storage/cache.js";
import { JsonFileStore } from "./storage/jsonStore.js";
import { startScoreboardPoller } from "./worker/poller.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  }
});

const origins = env.frontendOrigin === "*" ? true : env.frontendOrigin.split(",").map((origin) => origin.trim());
await app.register(cors, { origin: origins });

const cache = await createHotCache(env, console);
const store = new JsonFileStore(env.dataDir);
const highlightly = new HighlightlyClient(env);
const scoreboard = new ScoreboardService(env, highlightly, cache, store);

app.get("/api/health", async () => ({
  ok: true,
  service: "scorexp-api",
  cache: env.cacheDriver,
  time: new Date().toISOString()
}));

await registerFootballRoutes(app, scoreboard, env);

const stopPoller = startScoreboardPoller(scoreboard, env, console);

const shutdown = async () => {
  stopPoller();
  await cache.close();
  await app.close();
};

process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

await app.listen({ port: env.port, host: env.host });
