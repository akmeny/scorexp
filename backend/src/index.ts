import cors from "@fastify/cors";
import Fastify, { type RawServerDefault } from "fastify";
import { env, isApiSportsConfigured } from "./config/env.js";
import { fastifyLoggerOptions } from "./config/logger.js";
import { ApiSportsClient } from "./modules/matches/apiSportsClient.js";
import { MatchStore } from "./modules/matches/matchStore.js";
import { registerMatchesRoutes } from "./modules/matches/matchesRoutes.js";
import { LiveMatchesPollingService } from "./modules/matches/pollingService.js";
import { SocketHub } from "./modules/socket/socketServer.js";

function buildCorsOriginChecker(allowedOrigins: string[]) {
  return (
    origin: string | undefined,
    callback: (error: Error | null, allow: boolean) => void,
  ): void => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by ScoreXP CORS policy"), false);
  };
}

async function buildServer() {
  const app = Fastify<RawServerDefault>({
    logger: fastifyLoggerOptions,
  });

  const store = new MatchStore();
  const socketHub = new SocketHub(
    app.server,
    env.frontendOrigins,
    store,
    app.log.child({
      module: "socket",
    }),
    env.socketBatchWindowMs,
  );

  const pollingService = new LiveMatchesPollingService({
    client: new ApiSportsClient({
      apiKey: env.apiSportsKey,
      baseUrl: env.apiSportsBaseUrl,
      requestTimeoutMs: env.requestTimeoutMs,
    }),
    store,
    socketHub,
    logger: app.log.child({
      module: "poller",
    }),
    baseIntervalMs: env.pollIntervalMs,
    maxIntervalMs: env.maxPollIntervalMs,
    eventSummaryTtlMs: env.eventSummaryTtlMs,
    maxEventRefreshesPerTick: env.maxEventRefreshesPerTick,
    enabled: isApiSportsConfigured,
  });

  await app.register(cors, {
    origin: buildCorsOriginChecker(env.frontendOrigins),
    credentials: true,
    methods: ["GET", "HEAD", "OPTIONS"],
  });

  await registerMatchesRoutes(app, store);

  app.get("/health", async () => {
    const pollingStatus = pollingService.getStatus();

    return {
      status:
        isApiSportsConfigured && !pollingStatus.lastError ? "ok" : "degraded",
      service: "scorexp-backend",
      serverTime: new Date().toISOString(),
      apiSportsConfigured: isApiSportsConfigured,
      frontendOrigins: env.frontendOrigins,
      store: store.getMeta(),
      polling: pollingStatus,
      socket: socketHub.getMetrics(),
    };
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    reply.status(statusCode).send({
      error: "Internal server error",
    });
  });

  app.addHook("onClose", async () => {
    await pollingService.stop();
    await socketHub.close();
  });

  return {
    app,
    pollingService,
  };
}

async function start() {
  const { app, pollingService } = await buildServer();

  try {
    await app.listen({
      port: env.port,
      host: "0.0.0.0",
    });

    app.log.info(
      {
        port: env.port,
        frontendOrigins: env.frontendOrigins,
      },
      "ScoreXP backend listening",
    );

    pollingService.start();
  } catch (error) {
    app.log.error({ err: error }, "Failed to start backend");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down ScoreXP backend");

    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "Failed to shut down cleanly");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void start();
