import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const numberFromEnv = (fallback: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return fallback;
    return Number(value);
  }, z.number().int().positive());

const schema = z.object({
  HIGHLIGHTLY_API_KEY: z.string().min(1, "HIGHLIGHTLY_API_KEY is required"),
  HIGHLIGHTLY_API_BASE_URL: z.string().url().default("https://soccer.highlightly.net"),
  PORT: numberFromEnv(4000),
  HOST: z.string().default("0.0.0.0"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  DEFAULT_TIMEZONE: z.string().default("Europe/Istanbul"),
  DATA_DIR: z.string().default("./apps/api/data"),
  CACHE_DRIVER: z.enum(["redis", "memory"]).default("redis"),
  DURABLE_STORE: z.enum(["file", "redis"]).default("file"),
  REDIS_URL: z.string().optional(),
  LIVE_REFRESH_SECONDS: numberFromEnv(180),
  UPCOMING_REFRESH_SECONDS: numberFromEnv(900),
  FINISHED_REFRESH_SECONDS: numberFromEnv(86400),
  CLIENT_REFRESH_SECONDS: numberFromEnv(30)
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment: ${message}`);
}

const dataDir = path.isAbsolute(parsed.data.DATA_DIR)
  ? parsed.data.DATA_DIR
  : path.resolve(repoRoot, parsed.data.DATA_DIR);

export const env = {
  highlightlyApiKey: parsed.data.HIGHLIGHTLY_API_KEY,
  highlightlyApiBaseUrl: parsed.data.HIGHLIGHTLY_API_BASE_URL.replace(/\/$/, ""),
  port: parsed.data.PORT,
  host: parsed.data.HOST,
  frontendOrigin: parsed.data.FRONTEND_ORIGIN,
  defaultTimezone: parsed.data.DEFAULT_TIMEZONE,
  dataDir,
  cacheDriver: parsed.data.CACHE_DRIVER,
  durableStore: parsed.data.DURABLE_STORE,
  redisUrl: parsed.data.REDIS_URL,
  liveRefreshSeconds: parsed.data.LIVE_REFRESH_SECONDS,
  upcomingRefreshSeconds: parsed.data.UPCOMING_REFRESH_SECONDS,
  finishedRefreshSeconds: parsed.data.FINISHED_REFRESH_SECONDS,
  clientRefreshSeconds: parsed.data.CLIENT_REFRESH_SECONDS,
  repoRoot
};

export type AppEnv = typeof env;
