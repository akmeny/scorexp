import fs from "node:fs/promises";
import path from "node:path";
import type { NormalizedMatch, SnapshotCacheEntry } from "../domain/types.js";

interface CompletedDateRecord {
  completedAt: string;
  fetchedAt: string;
  matchCount: number;
}

interface DurableData {
  version: 1;
  snapshots: Record<string, SnapshotCacheEntry>;
  finishedMatchesByDate: Record<string, Record<string, NormalizedMatch>>;
  completedDates: Record<string, CompletedDateRecord>;
}

const emptyData = (): DurableData => ({
  version: 1,
  snapshots: {},
  finishedMatchesByDate: {},
  completedDates: {}
});

export class JsonFileStore {
  private data: DurableData = emptyData();
  private loadPromise: Promise<void>;
  private writeQueue = Promise.resolve();

  constructor(private readonly dataDir: string) {
    this.loadPromise = this.load();
  }

  async getSnapshot(key: string): Promise<SnapshotCacheEntry | null> {
    await this.loadPromise;
    return this.data.snapshots[key] ?? null;
  }

  async saveSnapshot(key: string, snapshot: SnapshotCacheEntry): Promise<void> {
    await this.loadPromise;
    this.data.snapshots[key] = snapshot;
    await this.persist();
  }

  async getFinishedMatches(key: string): Promise<NormalizedMatch[]> {
    await this.loadPromise;
    return Object.values(this.data.finishedMatchesByDate[key] ?? {});
  }

  async saveFinishedMatches(key: string, matches: NormalizedMatch[]): Promise<void> {
    if (matches.length === 0) return;
    await this.loadPromise;
    const existing = this.data.finishedMatchesByDate[key] ?? {};

    for (const match of matches) {
      if (!existing[match.id]) {
        existing[match.id] = match;
      }
    }

    this.data.finishedMatchesByDate[key] = existing;
    await this.persist();
  }

  async getCompletedDate(key: string): Promise<CompletedDateRecord | null> {
    await this.loadPromise;
    return this.data.completedDates[key] ?? null;
  }

  async markDateCompleted(key: string, matchCount: number, fetchedAt: string): Promise<void> {
    await this.loadPromise;
    if (this.data.completedDates[key]) return;

    this.data.completedDates[key] = {
      completedAt: new Date().toISOString(),
      fetchedAt,
      matchCount
    };
    await this.persist();
  }

  private async load() {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.data = JSON.parse(raw) as DurableData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      this.data = emptyData();
      await this.persist();
    }
  }

  private async persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(this.dataDir, { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.data, null, 2));
      await fs.rename(tmp, this.filePath);
    });

    await this.writeQueue;
  }

  private get filePath() {
    return path.join(this.dataDir, "scorexp-store.json");
  }
}
