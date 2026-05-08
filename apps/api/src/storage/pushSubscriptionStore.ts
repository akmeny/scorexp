import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "ioredis";
import type { AppEnv } from "../config/env.js";

export interface BrowserPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface FavoriteMatchSnapshot {
  scoreKey: string;
  redCardsHome: number;
  redCardsAway: number;
  statusGroup: "live" | "finished" | "upcoming" | "unknown";
  statusDescription: string;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  subscription: BrowserPushSubscription;
  favorites: string[];
  snapshots: Record<string, FavoriteMatchSnapshot>;
  lastCheckedAt: number | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PushSubscriptionStore {
  upsertSubscription(userId: string, subscription: BrowserPushSubscription, userAgent?: string | null): Promise<PushSubscriptionRecord>;
  deleteSubscription(userId: string, endpoint: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  listByUser(userId: string): Promise<PushSubscriptionRecord[]>;
  listAll(): Promise<PushSubscriptionRecord[]>;
  save(record: PushSubscriptionRecord): Promise<void>;
  close(): Promise<void>;
}

type PushSubscriptionRecords = Record<string, PushSubscriptionRecord>;

const pushSubscriptionFileName = "push-subscriptions.json";

export async function createPushSubscriptionStore(env: AppEnv): Promise<PushSubscriptionStore> {
  if (env.redisUrl) {
    try {
      const redis = new Redis(env.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false
      });
      await redis.connect();
      return new RedisPushSubscriptionStore(redis);
    } catch (error) {
      console.warn(`Push subscription Redis store unavailable, falling back to file store: ${(error as Error).message}`);
    }
  }

  return new FilePushSubscriptionStore(path.join(env.dataDir, pushSubscriptionFileName));
}

export function pushSubscriptionId(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

class RedisPushSubscriptionStore implements PushSubscriptionStore {
  private readonly prefix = "scorexp:pushSubscriptions:v1";

  constructor(private readonly redis: InstanceType<typeof Redis>) {}

  async upsertSubscription(
    userId: string,
    subscription: BrowserPushSubscription,
    userAgent?: string | null
  ): Promise<PushSubscriptionRecord> {
    const id = pushSubscriptionId(subscription.endpoint);
    const existing = await this.getById(id);
    const now = new Date().toISOString();
    const record: PushSubscriptionRecord = {
      id,
      userId,
      endpoint: subscription.endpoint,
      subscription,
      favorites: existing?.userId === userId ? existing.favorites : [],
      snapshots: existing?.userId === userId ? existing.snapshots : {},
      lastCheckedAt: existing?.userId === userId ? existing.lastCheckedAt : null,
      userAgent: userAgent ?? existing?.userAgent ?? null,
      createdAt: existing?.userId === userId ? existing.createdAt : now,
      updatedAt: now
    };

    await this.save(record);
    return record;
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    const id = pushSubscriptionId(endpoint);
    const record = await this.getById(id);
    if (!record || record.userId !== userId) return;
    await this.deleteById(id);
  }

  async deleteById(id: string): Promise<void> {
    await this.redis.del(this.recordKey(id));
    await this.redis.srem(this.indexKey(), id);
  }

  async listByUser(userId: string): Promise<PushSubscriptionRecord[]> {
    const records = await this.listAll();
    return records.filter((record) => record.userId === userId);
  }

  async listAll(): Promise<PushSubscriptionRecord[]> {
    const ids = await this.redis.smembers(this.indexKey());
    if (ids.length === 0) return [];

    const values = await this.redis.mget(ids.map((id) => this.recordKey(id)));
    return values
      .map((value) => (value ? (JSON.parse(value) as PushSubscriptionRecord) : null))
      .filter((record): record is PushSubscriptionRecord => Boolean(record));
  }

  async save(record: PushSubscriptionRecord): Promise<void> {
    await this.redis.set(this.recordKey(record.id), JSON.stringify(record));
    await this.redis.sadd(this.indexKey(), record.id);
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }

  private async getById(id: string) {
    const raw = await this.redis.get(this.recordKey(id));
    return raw ? (JSON.parse(raw) as PushSubscriptionRecord) : null;
  }

  private indexKey() {
    return `${this.prefix}:ids`;
  }

  private recordKey(id: string) {
    return `${this.prefix}:record:${id}`;
  }
}

class FilePushSubscriptionStore implements PushSubscriptionStore {
  constructor(private readonly filePath: string) {}

  async upsertSubscription(
    userId: string,
    subscription: BrowserPushSubscription,
    userAgent?: string | null
  ): Promise<PushSubscriptionRecord> {
    const records = await this.readRecords();
    const id = pushSubscriptionId(subscription.endpoint);
    const existing = records[id];
    const now = new Date().toISOString();
    const record: PushSubscriptionRecord = {
      id,
      userId,
      endpoint: subscription.endpoint,
      subscription,
      favorites: existing?.userId === userId ? existing.favorites : [],
      snapshots: existing?.userId === userId ? existing.snapshots : {},
      lastCheckedAt: existing?.userId === userId ? existing.lastCheckedAt : null,
      userAgent: userAgent ?? existing?.userAgent ?? null,
      createdAt: existing?.userId === userId ? existing.createdAt : now,
      updatedAt: now
    };

    records[id] = record;
    await this.writeRecords(records);
    return record;
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    const records = await this.readRecords();
    const id = pushSubscriptionId(endpoint);
    if (records[id]?.userId !== userId) return;

    delete records[id];
    await this.writeRecords(records);
  }

  async deleteById(id: string): Promise<void> {
    const records = await this.readRecords();
    delete records[id];
    await this.writeRecords(records);
  }

  async listByUser(userId: string): Promise<PushSubscriptionRecord[]> {
    const records = await this.readRecords();
    return Object.values(records).filter((record) => record.userId === userId);
  }

  async listAll(): Promise<PushSubscriptionRecord[]> {
    const records = await this.readRecords();
    return Object.values(records);
  }

  async save(record: PushSubscriptionRecord): Promise<void> {
    const records = await this.readRecords();
    records[record.id] = {
      ...record,
      updatedAt: new Date().toISOString()
    };
    await this.writeRecords(records);
  }

  async close(): Promise<void> {
    return undefined;
  }

  private async readRecords(): Promise<PushSubscriptionRecords> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed as PushSubscriptionRecords;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeRecords(records: PushSubscriptionRecords): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}
