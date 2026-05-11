import type { AppEnv } from "../config/env.js";
import type { PushNotificationService } from "../services/pushNotifications.js";
import type { ScoreboardService } from "../services/scoreboard.js";
import { localDate, scoreboardRefreshSeconds } from "../utils/date.js";

export function startScoreboardPoller(
  service: ScoreboardService,
  appEnv: AppEnv,
  logger: Pick<Console, "info" | "warn">,
  pushNotifications?: PushNotificationService
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const warm = async () => {
    const today = localDate(appEnv.defaultTimezone);
    const tomorrow = shiftDate(today, 1);
    try {
      const snapshots = await Promise.all([
        service.warmScoreboard(today, appEnv.defaultTimezone),
        service.warmScoreboard(tomorrow, appEnv.defaultTimezone)
      ]);
      await pushNotifications?.monitorScoreboards(snapshots);
      void service.warmMatchDetailsForSnapshot(snapshots[0]).catch((error) => {
        logger.warn(`Match detail warmup failed: ${(error as Error).message}`);
      });
    } catch (error) {
      logger.warn(`Scoreboard warmup failed: ${(error as Error).message}`);
    }
  };

  const run = async () => {
    await warm();
    if (stopped) return;

    const seconds = scoreboardRefreshSeconds(appEnv.defaultTimezone);
    timer = setTimeout(run, seconds * 1000);
  };

  void run();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

function shiftDate(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
