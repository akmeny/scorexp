import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { HighlightlyClient } from "./provider/highlightly.js";
import { registerFootballRoutes } from "./routes/football.js";
import { ScoreboardService } from "./services/scoreboard.js";
import { createHotCache } from "./storage/cache.js";
import { JsonFileStore, type DurableStore } from "./storage/jsonStore.js";
import { createRedisDurableStore, type RedisDurableStore } from "./storage/redisStore.js";
import { startScoreboardPoller } from "./worker/poller.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  }
});

const origins = env.frontendOrigin === "*" ? true : env.frontendOrigin.split(",").map((origin) => origin.trim());
await app.register(cors, { origin: origins });

const cache = await createHotCache(env, console);
let redisDurableStore: RedisDurableStore | null = null;
let store: DurableStore = new JsonFileStore(env.dataDir);

if (env.durableStore === "redis" && env.redisUrl) {
  try {
    redisDurableStore = await createRedisDurableStore(env.redisUrl);
    store = redisDurableStore;
    console.info("Redis durable store connected.");
  } catch (error) {
    console.warn(`Redis durable store unavailable, falling back to file store: ${(error as Error).message}`);
  }
}

const highlightly = new HighlightlyClient(env);
const scoreboard = new ScoreboardService(env, highlightly, cache, store);

app.get("/api/health", async () => ({
  ok: true,
  service: "scorexp-api",
  cache: env.cacheDriver,
  durableStore: env.durableStore,
  time: new Date().toISOString()
}));

await registerFootballRoutes(app, scoreboard, env);

const stopPoller = startScoreboardPoller(scoreboard, env, console);

const shutdown = async () => {
  stopPoller();
  await redisDurableStore?.close();
  await cache.close();
  await app.close();
};

process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

await app.listen({ port: env.port, host: env.host });
