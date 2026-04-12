import type { FastifyBaseLogger } from "fastify";
import type { Server as HttpServer } from "node:http";
import { Buffer } from "node:buffer";
import { Server as SocketIOServer, type Socket } from "socket.io";
import type { MatchStore } from "../matches/matchStore.js";
import type {
  MatchDiff,
  MatchPatch,
  MatchPatchChanges,
  NormalizedMatch,
  RemovedMatch,
} from "../matches/types.js";
import { compareMatches } from "../matches/types.js";

interface MatchSnapshotPayload {
  matches: NormalizedMatch[];
  generatedAt: string;
  total: number;
}

interface MatchDiffPayload extends MatchDiff {
  generatedAt: string;
  total: number;
}

export type MatchUpdatePayload =
  | {
      type: "added";
      matchId: number;
      match: NormalizedMatch;
      generatedAt: string;
    }
  | {
      type: "updated";
      matchId: number;
      changes: MatchPatchChanges;
      generatedAt: string;
    }
  | {
      type: "removed";
      matchId: number;
      removed: RemovedMatch;
      generatedAt: string;
    };

interface SocketHubMetrics {
  batchWindowMs: number;
  broadcastCount: number;
  totalChangedMatches: number;
  lastChangedMatches: number;
  totalDiffPayloadBytes: number;
  lastDiffPayloadBytes: number;
  lastBroadcastAt: string | null;
  broadcastsPerMinute: number;
}

function roomForMatch(matchId: number): string {
  return `match:${matchId}`;
}

export class SocketHub {
  private readonly io: SocketIOServer;

  private flushTimer: NodeJS.Timeout | null = null;

  private readonly pendingAdded = new Map<number, NormalizedMatch>();

  private readonly pendingUpdated = new Map<number, MatchPatchChanges>();

  private readonly pendingRemoved = new Map<number, RemovedMatch>();

  private readonly recentBroadcastTimestamps: number[] = [];

  private readonly metrics: SocketHubMetrics;

  constructor(
    server: HttpServer,
    origins: string[],
    private readonly store: MatchStore,
    private readonly logger: FastifyBaseLogger,
    private readonly batchWindowMs: number,
  ) {
    this.metrics = {
      batchWindowMs,
      broadcastCount: 0,
      totalChangedMatches: 0,
      lastChangedMatches: 0,
      totalDiffPayloadBytes: 0,
      lastDiffPayloadBytes: 0,
      lastBroadcastAt: null,
      broadcastsPerMinute: 0,
    };

    this.io = new SocketIOServer(server, {
      cors: {
        origin: origins.length === 1 ? origins[0] : origins,
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    this.io.on("connection", (socket) => {
      this.onConnection(socket);
    });
  }

  getMetrics(): SocketHubMetrics {
    this.pruneRecentBroadcasts(Date.now());

    return {
      ...this.metrics,
      broadcastsPerMinute: this.recentBroadcastTimestamps.length,
    };
  }

  private onConnection(socket: Socket): void {
    this.logger.info({ socketId: socket.id }, "Socket client connected");

    if (socket.handshake.query.snapshot !== "off") {
      this.emitSnapshotTo(socket);
    }

    socket.on("match:watch", (matchId: unknown) => {
      const parsed = Number(matchId);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        return;
      }

      void socket.join(roomForMatch(parsed));
    });

    socket.on("match:unwatch", (matchId: unknown) => {
      const parsed = Number(matchId);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        return;
      }

      void socket.leave(roomForMatch(parsed));
    });

    socket.on("disconnect", (reason) => {
      this.logger.info(
        { socketId: socket.id, reason },
        "Socket client disconnected",
      );
    });
  }

  private emitSnapshotTo(socket: Socket): void {
    const payload: MatchSnapshotPayload = {
      matches: this.store.getAll(),
      generatedAt: new Date().toISOString(),
      total: this.store.size(),
    };

    socket.emit("matches:snapshot", payload);
  }

  queueDiff(diff: MatchDiff): void {
    for (const removed of diff.removed) {
      this.pendingAdded.delete(removed.matchId);
      this.pendingUpdated.delete(removed.matchId);
      this.pendingRemoved.set(removed.matchId, removed);
    }

    for (const match of diff.added) {
      this.pendingRemoved.delete(match.matchId);
      this.pendingUpdated.delete(match.matchId);
      this.pendingAdded.set(match.matchId, match);
    }

    for (const patch of diff.updated) {
      if (this.pendingRemoved.has(patch.matchId)) {
        continue;
      }

      const pendingAdded = this.pendingAdded.get(patch.matchId);

      if (pendingAdded) {
        this.pendingAdded.set(patch.matchId, {
          ...pendingAdded,
          ...patch.changes,
        });
        continue;
      }

      const existingPatch = this.pendingUpdated.get(patch.matchId) ?? {};
      this.pendingUpdated.set(patch.matchId, {
        ...existingPatch,
        ...patch.changes,
      });
    }

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPending();
    }, this.batchWindowMs);
  }

  private flushPending(): void {
    const added = [...this.pendingAdded.values()].sort(compareMatches);
    const updated = [...this.pendingUpdated.entries()]
      .map(
        ([matchId, changes]): MatchPatch => ({
          matchId,
          changes,
        }),
      )
      .sort((left, right) => left.matchId - right.matchId);
    const removed = [...this.pendingRemoved.values()].sort(
      (left, right) => left.matchId - right.matchId,
    );

    this.pendingAdded.clear();
    this.pendingUpdated.clear();
    this.pendingRemoved.clear();

    if (added.length === 0 && updated.length === 0 && removed.length === 0) {
      return;
    }

    const generatedAt = new Date().toISOString();
    const payload: MatchDiffPayload = {
      added,
      updated,
      removed,
      generatedAt,
      total: this.store.size(),
    };

    const payloadSize = Buffer.byteLength(JSON.stringify(payload), "utf8");
    const changedMatches = added.length + updated.length + removed.length;

    this.io.emit("matches:diff", payload);

    for (const match of added) {
      const room = roomForMatch(match.matchId);

      if (this.io.sockets.adapter.rooms.has(room)) {
        const updatePayload: MatchUpdatePayload = {
          type: "added",
          matchId: match.matchId,
          match,
          generatedAt,
        };
        this.io.to(room).emit("match:update", updatePayload);
      }
    }

    for (const patch of updated) {
      const room = roomForMatch(patch.matchId);

      if (this.io.sockets.adapter.rooms.has(room)) {
        const updatePayload: MatchUpdatePayload = {
          type: "updated",
          matchId: patch.matchId,
          changes: patch.changes,
          generatedAt,
        };
        this.io.to(room).emit("match:update", updatePayload);
      }
    }

    for (const removal of removed) {
      const room = roomForMatch(removal.matchId);

      if (this.io.sockets.adapter.rooms.has(room)) {
        const updatePayload: MatchUpdatePayload = {
          type: "removed",
          matchId: removal.matchId,
          removed: removal,
          generatedAt,
        };
        this.io.to(room).emit("match:update", updatePayload);
      }
    }

    const now = Date.now();
    this.recentBroadcastTimestamps.push(now);
    this.pruneRecentBroadcasts(now);

    this.metrics.broadcastCount += 1;
    this.metrics.totalChangedMatches += changedMatches;
    this.metrics.lastChangedMatches = changedMatches;
    this.metrics.totalDiffPayloadBytes += payloadSize;
    this.metrics.lastDiffPayloadBytes = payloadSize;
    this.metrics.lastBroadcastAt = generatedAt;
    this.metrics.broadcastsPerMinute = this.recentBroadcastTimestamps.length;

    this.logger.info(
      {
        added: added.length,
        updated: updated.length,
        removed: removed.length,
        payloadBytes: payloadSize,
      },
      "Broadcasted batched compact match diff",
    );
  }

  private pruneRecentBroadcasts(now: number): void {
    while (
      this.recentBroadcastTimestamps.length > 0 &&
      now - (this.recentBroadcastTimestamps[0] ?? now) > 60_000
    ) {
      this.recentBroadcastTimestamps.shift();
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    await this.io.close();
  }
}
