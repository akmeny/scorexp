import type { AppEnv } from "../config/env.js";
import type { PushNotificationService } from "../services/pushNotifications.js";
import type { ScoreboardService } from "../services/scoreboard.js";
import { localDate } from "../utils/date.js";

export function startScoreboardPoller(
  service: ScoreboardService,
  appEnv: AppEnv,
  logger: Pick<Console, "info" | "warn">,
  pushNotifications?: PushNotificationService
) {
  const warm = async () => {
    const today = localDate(appEnv.defaultTimezone);
    const tomorrow = shiftDate(today, 1);
    try {
      const snapshots = await Promise.all([
        service.warmScoreboard(today, appEnv.defaultTimezone),
        service.warmScoreboard(tomorrow, appEnv.defaultTimezone)
      ]);
      await pushNotifications?.monitorScoreboards(snapshots);
    } catch (error) {
      logger.warn(`Scoreboard warmup failed: ${(error as Error).message}`);
    }
  };

  void warm();
  const interval = setInterval(warm, 60_000);

  return () => clearInterval(interval);
}

function shiftDate(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
