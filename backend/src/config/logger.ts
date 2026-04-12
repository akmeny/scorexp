import type { FastifyServerOptions } from "fastify";

export const fastifyLoggerOptions: NonNullable<
  FastifyServerOptions["logger"]
> = {
  level: process.env.LOG_LEVEL ?? "info",
};
