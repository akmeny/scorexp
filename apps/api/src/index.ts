import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { HighlightlyClient } from "./provider/highlightly.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerFootballRoutes } from "./routes/football.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { PushNotificationService } from "./services/pushNotifications.js";
import { ScoreboardService } from "./services/scoreboard.js";
import { createHotCache } from "./storage/cache.js";
import { JsonFileStore, type DurableStore } from "./storage/jsonStore.js";
import { createPushSubscriptionStore } from "./storage/pushSubscriptionStore.js";
import { createRedisDurableStore, type RedisDurableStore } from "./storage/redisStore.js";
import { createUserProfileStore } from "./storage/userProfileStore.js";
import { scoreboardRefreshSeconds } from "./utils/date.js";
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
const userProfileStore = await createUserProfileStore(env);
const pushSubscriptionStore = await createPushSubscriptionStore(env);
const pushNotifications = new PushNotificationService(env, pushSubscriptionStore, console);

app.get("/api/health", async () => ({
  ok: true,
  service: "scorexp-api",
  cache: env.cacheDriver,
  durableStore: env.durableStore,
  scoreboardRefreshSeconds: scoreboardRefreshSeconds(env.defaultTimezone),
  time: new Date().toISOString()
}));

await registerFootballRoutes(app, scoreboard, env);
await registerAuthRoutes(app, env, userProfileStore);
await registerNotificationRoutes(app, env, userProfileStore, pushNotifications);
await registerChatRoutes(app, { env, profileStore: userProfileStore });

const stopPoller = startScoreboardPoller(scoreboard, env, console, pushNotifications);

const shutdown = async () => {
  stopPoller();
  await redisDurableStore?.close();
  await pushNotifications.close();
  await userProfileStore.close();
  await cache.close();
  await app.close();
};

process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

await app.listen({ port: env.port, host: env.host });
