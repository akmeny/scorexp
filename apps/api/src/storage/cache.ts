import { Redis } from "ioredis";
import type { AppEnv } from "../config/env.js";

interface StoredValue<T> {
  value: T;
  expiresAt: number;
}

export interface HotCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  close(): Promise<void>;
}

export async function createHotCache(appEnv: AppEnv, logger: Pick<Console, "info" | "warn">): Promise<HotCache> {
  if (appEnv.cacheDriver === "redis" && appEnv.redisUrl) {
    const redis = new Redis(appEnv.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });

    try {
      await redis.connect();
      logger.info("Redis hot cache connected.");
      return new RedisHotCache(redis);
    } catch (error) {
      logger.warn(`Redis unavailable, falling back to memory cache: ${(error as Error).message}`);
      redis.disconnect();
    }
  }

  logger.info("Using memory hot cache.");
  return new MemoryHotCache();
}

class RedisHotCache implements HotCache {
  constructor(private readonly redis: InstanceType<typeof Redis>) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }
}

class MemoryHotCache implements HotCache {
  private readonly values = new Map<string, StoredValue<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.values.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.values.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async close(): Promise<void> {
    this.values.clear();
  }
}
