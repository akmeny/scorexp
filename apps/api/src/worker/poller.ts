import type { AppEnv } from "../config/env.js";
import type { ScoreboardService } from "../services/scoreboard.js";
import { localDate } from "../utils/date.js";

export function startScoreboardPoller(service: ScoreboardService, appEnv: AppEnv, logger: Pick<Console, "info" | "warn">) {
  const warm = async () => {
    const today = localDate(appEnv.defaultTimezone);
    try {
      await service.warmScoreboard(today, appEnv.defaultTimezone);
    } catch (error) {
      logger.warn(`Scoreboard warmup failed: ${(error as Error).message}`);
    }
  };

  void warm();
  const interval = setInterval(warm, 60_000);

  return () => clearInterval(interval);
}
