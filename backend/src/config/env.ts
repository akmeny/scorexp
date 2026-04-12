import { config as loadDotenv } from "dotenv";

loadDotenv();

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOrigins(value: string | undefined): string[] {
  const raw = value?.trim();

  if (!raw) {
    return ["http://localhost:3000"];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const apiSportsKey = process.env.APISPORTS_KEY?.trim() ?? "";

export const env = {
  port: parseNumber(process.env.PORT, 4000),
  apiSportsKey,
  apiSportsBaseUrl: trimTrailingSlash(
    process.env.APISPORTS_BASE_URL?.trim() ??
      "https://v3.football.api-sports.io",
  ),
  frontendOrigins: parseOrigins(process.env.FRONTEND_ORIGIN),
  pollIntervalMs: parseNumber(process.env.POLL_INTERVAL_MS, 15_000),
  requestTimeoutMs: 10_000,
  eventSummaryTtlMs: 45_000,
  maxEventRefreshesPerTick: 3,
  maxPollIntervalMs: 60_000,
  socketBatchWindowMs: 900,
};

export const isApiSportsConfigured = apiSportsKey.length > 0;
