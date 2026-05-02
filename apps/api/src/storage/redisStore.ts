import { Redis } from "ioredis";
import type { NormalizedMatch, SnapshotCacheEntry } from "../domain/types.js";
import type { DurableStore } from "./jsonStore.js";

interface CompletedDateRecord {
  completedAt: string;
  fetchedAt: string;
  matchCount: number;
}

export class RedisDurableStore implements DurableStore {
  private readonly prefix = "scorexp:durable";

  constructor(private readonly redis: InstanceType<typeof Redis>) {}

  async getSnapshot(key: string): Promise<SnapshotCacheEntry | null> {
    return this.getJson<SnapshotCacheEntry>(this.snapshotKey(key));
  }

  async saveSnapshot(key: string, snapshot: SnapshotCacheEntry): Promise<void> {
    await this.redis.set(this.snapshotKey(key), JSON.stringify(snapshot));
  }

  async getFinishedMatches(key: string): Promise<NormalizedMatch[]> {
    const values = await this.redis.hvals(this.finishedKey(key));
    return values.map((value) => JSON.parse(value) as NormalizedMatch);
  }

  async saveFinishedMatches(key: string, matches: NormalizedMatch[]): Promise<void> {
    if (matches.length === 0) return;

    const pipeline = this.redis.pipeline();
    for (const match of matches) {
      pipeline.hsetnx(this.finishedKey(key), match.id, JSON.stringify(match));
    }
    await pipeline.exec();
  }

  async getCompletedDate(key: string): Promise<CompletedDateRecord | null> {
    return this.getJson<CompletedDateRecord>(this.completedKey(key));
  }

  async markDateCompleted(key: string, matchCount: number, fetchedAt: string): Promise<void> {
    const record: CompletedDateRecord = {
      completedAt: new Date().toISOString(),
      fetchedAt,
      matchCount
    };

    await this.redis.setnx(this.completedKey(key), JSON.stringify(record));
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private snapshotKey(key: string) {
    return `${this.prefix}:snapshot:${key}`;
  }

  private finishedKey(key: string) {
    return `${this.prefix}:finished:${key}`;
  }

  private completedKey(key: string) {
    return `${this.prefix}:completed:${key}`;
  }
}

export async function createRedisDurableStore(redisUrl: string) {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false
  });
  await redis.connect();
  return new RedisDurableStore(redis);
}
