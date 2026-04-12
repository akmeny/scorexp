"use client";

type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

const configuredLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL ??
  (process.env.NODE_ENV === "production" ? "warn" : "debug")) as LogLevel;

function shouldLog(level: Exclude<LogLevel, "silent">): boolean {
  const currentRank = levelRank[configuredLevel] ?? levelRank.warn;

  return levelRank[level] >= currentRank;
}

function writeLog(
  level: Exclude<LogLevel, "silent">,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = context ? [message, context] : [message];

  if (level === "debug") {
    console.debug("[scorexp]", ...payload);
  } else if (level === "info") {
    console.info("[scorexp]", ...payload);
  } else if (level === "warn") {
    console.warn("[scorexp]", ...payload);
  } else {
    console.error("[scorexp]", ...payload);
  }
}

export const clientLogger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    writeLog("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    writeLog("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    writeLog("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    writeLog("error", message, context),
};
