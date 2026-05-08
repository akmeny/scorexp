import webpush from "web-push";
import type { AppEnv } from "../config/env.js";
import type { NormalizedMatch, ScoreboardSnapshot } from "../domain/types.js";
import type {
  BrowserPushSubscription,
  FavoriteMatchSnapshot,
  PushSubscriptionRecord,
  PushSubscriptionStore
} from "../storage/pushSubscriptionStore.js";

interface FavoriteNotificationEvent {
  key: string;
  title: string;
  body: string;
}

export class PushNotificationService {
  private readonly enabled: boolean;

  constructor(
    private readonly appEnv: AppEnv,
    private readonly store: PushSubscriptionStore,
    private readonly logger: Pick<Console, "info" | "warn">
  ) {
    this.enabled = Boolean(appEnv.vapidPublicKey && appEnv.vapidPrivateKey && appEnv.vapidSubject);

    if (this.enabled) {
      webpush.setVapidDetails(appEnv.vapidSubject, appEnv.vapidPublicKey, appEnv.vapidPrivateKey);
      this.logger.info("Web push notifications enabled.");
    } else {
      this.logger.warn("Web push notifications disabled: VAPID keys are missing.");
    }
  }

  getPublicConfig() {
    return {
      enabled: this.enabled,
      publicKey: this.enabled ? this.appEnv.vapidPublicKey : null
    };
  }

  async subscribe(userId: string, subscription: BrowserPushSubscription, userAgent?: string | null) {
    if (!this.enabled) {
      throw new Error("Push notifications are not configured");
    }

    return this.store.upsertSubscription(userId, subscription, userAgent);
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.store.deleteSubscription(userId, endpoint);
  }

  async syncFavorites(userId: string, favoriteIds: string[]) {
    const sanitizedFavorites = uniqueIds(favoriteIds);
    const records = await this.store.listByUser(userId);

    for (const record of records) {
      const favoriteSet = new Set(sanitizedFavorites);
      const snapshots = Object.fromEntries(
        Object.entries(record.snapshots).filter(([matchId]) => favoriteSet.has(matchId))
      ) as Record<string, FavoriteMatchSnapshot>;

      await this.store.save({
        ...record,
        favorites: sanitizedFavorites,
        snapshots
      });
    }
  }

  async monitorScoreboards(snapshots: ScoreboardSnapshot[]) {
    if (!this.enabled || snapshots.length === 0) return;

    const matchesById = new Map<string, NormalizedMatch>();
    for (const snapshot of snapshots) {
      for (const match of flattenMatches(snapshot)) {
        matchesById.set(match.id, match);
      }
    }
    if (matchesById.size === 0) return;

    const records = await this.store.listAll();
    const now = Date.now();

    for (const record of records) {
      if (record.favorites.length === 0) continue;
      await this.processRecord(record, matchesById, now);
    }
  }

  async close() {
    await this.store.close();
  }

  private async processRecord(record: PushSubscriptionRecord, matchesById: Map<string, NormalizedMatch>, now: number) {
    const favoriteIds = uniqueIds(record.favorites);
    const nextSnapshots: Record<string, FavoriteMatchSnapshot> = {};
    const staleGap =
      record.lastCheckedAt !== null && now - record.lastCheckedAt > this.appEnv.pushMonitorMaxGapSeconds * 1000;
    const canNotify = record.lastCheckedAt !== null && !staleGap;

    for (const matchId of favoriteIds) {
      const match = matchesById.get(matchId);
      if (!match) continue;

      const current = favoriteSnapshot(match);
      const previous = record.snapshots[matchId];

      if (previous && canNotify) {
        const events = favoriteMatchNotificationEvents(previous, current, match);
        for (const event of events) {
          await this.sendNotification(record, match, event);
        }
      }

      nextSnapshots[matchId] = current;
    }

    await this.store.save({
      ...record,
      favorites: favoriteIds,
      snapshots: nextSnapshots,
      lastCheckedAt: now
    });
  }

  private async sendNotification(record: PushSubscriptionRecord, match: NormalizedMatch, event: FavoriteNotificationEvent) {
    const payload = JSON.stringify({
      title: `ScoreXP - ${event.title}`,
      body: event.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/notification-badge.png",
      image: "/icons/icon-512.png",
      tag: `scorexp:${record.id}:${event.key}`,
      renotify: true,
      requireInteraction: false,
      timestamp: Date.now(),
      vibrate: [90, 45, 90],
      actions: [{ action: "open", title: "Maçı aç" }],
      data: {
        matchId: match.id,
        providerId: match.providerId,
        url: "/",
        eventKey: event.key
      }
    });

    try {
      await webpush.sendNotification(record.subscription as webpush.PushSubscription, payload, {
        TTL: this.appEnv.pushNotificationTtlSeconds,
        urgency: "high"
      });
    } catch (error) {
      const statusCode = webPushStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        await this.store.deleteById(record.id);
        return;
      }

      this.logger.warn(`Push notification failed (${statusCode ?? "unknown"}): ${(error as Error).message}`);
    }
  }
}

function flattenMatches(snapshot: ScoreboardSnapshot) {
  return snapshot.leagues.flatMap((league) => league.matches);
}

function favoriteSnapshot(match: NormalizedMatch): FavoriteMatchSnapshot {
  return {
    scoreKey: scoreSnapshot(match),
    redCardsHome: match.redCards?.home ?? 0,
    redCardsAway: match.redCards?.away ?? 0,
    statusGroup: match.status.group,
    statusDescription: match.status.description
  };
}

function favoriteMatchNotificationEvents(previous: FavoriteMatchSnapshot, current: FavoriteMatchSnapshot, match: NormalizedMatch) {
  const events: FavoriteNotificationEvent[] = [];
  const scoreSide = scoreIncreaseSide(previous.scoreKey, current.scoreKey);
  const cancelledGoalSide = scoreDecreaseSide(previous.scoreKey, current.scoreKey);

  for (const side of expandSides(scoreSide)) {
    const team = side === "home" ? match.homeTeam.name : match.awayTeam.name;
    events.push({
      key: `goal:${side}:${current.scoreKey}`,
      title: "Gol",
      body: `${team} gol attı. Skor: ${formatNotificationScore(match)}`
    });
  }

  for (const side of expandSides(cancelledGoalSide)) {
    const team = side === "home" ? match.homeTeam.name : match.awayTeam.name;
    events.push({
      key: `goal-cancelled:${side}:${current.scoreKey}`,
      title: "Gol iptal",
      body: `${team} golü iptal edildi. Skor: ${formatNotificationScore(match)}`
    });
  }

  if (current.redCardsHome > previous.redCardsHome) {
    events.push({
      key: `red-card:home:${current.redCardsHome}`,
      title: "Kırmızı kart",
      body: `${match.homeTeam.name} kırmızı kart gördü.`
    });
  }

  if (current.redCardsAway > previous.redCardsAway) {
    events.push({
      key: `red-card:away:${current.redCardsAway}`,
      title: "Kırmızı kart",
      body: `${match.awayTeam.name} kırmızı kart gördü.`
    });
  }

  if (current.statusGroup === "live" && previous.statusGroup !== "live") {
    events.push({
      key: `match-started:${current.statusDescription}`,
      title: "Maç başladı",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} başladı.`
    });
  }

  if (isSecondHalf(current.statusDescription) && !isSecondHalf(previous.statusDescription)) {
    events.push({
      key: `second-half:${current.statusDescription}`,
      title: "İkinci yarı başladı",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} maçında ikinci yarı başladı.`
    });
  }

  if (current.statusGroup === "finished" && previous.statusGroup !== "finished") {
    events.push({
      key: `match-finished:${current.scoreKey}`,
      title: "Maç bitti",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} bitti. Skor: ${formatNotificationScore(match)}`
    });
  }

  return events;
}

function scoreSnapshot(match: NormalizedMatch) {
  return `${match.score.home ?? ""}:${match.score.away ?? ""}`;
}

function scoreIncreaseSide(previous: string, current: string) {
  const [previousHome, previousAway] = previous.split(":").map(toScoreNumber);
  const [currentHome, currentAway] = current.split(":").map(toScoreNumber);
  const homeIncreased = currentHome > previousHome;
  const awayIncreased = currentAway > previousAway;

  if (homeIncreased && awayIncreased) return "both";
  if (homeIncreased) return "home";
  if (awayIncreased) return "away";
  return null;
}

function scoreDecreaseSide(previous: string, current: string) {
  const [previousHome, previousAway] = previous.split(":").map(toScoreNumber);
  const [currentHome, currentAway] = current.split(":").map(toScoreNumber);
  const homeDecreased = currentHome < previousHome;
  const awayDecreased = currentAway < previousAway;

  if (homeDecreased && awayDecreased) return "both";
  if (homeDecreased) return "home";
  if (awayDecreased) return "away";
  return null;
}

function expandSides(side: string | null) {
  if (side === "both") return ["home", "away"] as const;
  if (side === "home" || side === "away") return [side] as const;
  return [];
}

function toScoreNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNotificationScore(match: NormalizedMatch) {
  if (match.score.home === null || match.score.away === null) return "-";
  return `${match.score.home}-${match.score.away}`;
}

function isSecondHalf(description: string) {
  const value = description.toLocaleLowerCase("tr-TR");
  return value.includes("second half") || value.includes("2nd half") || value.includes("2. yar") || value.includes("ikinci yar");
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function webPushStatusCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === "number" ? value : null;
}
