"use client";

import { useSyncExternalStore } from "react";
import {
  createStructureSnapshot,
  patchAffectsStructure,
  type MatchStructureSnapshot,
} from "@/lib/matches";
import type {
  LiveMatch,
  MatchesDiffResponse,
  MatchesPageResponse,
  MatchesSnapshotResponse,
} from "@/lib/types";

interface StoreMetaSnapshot {
  generatedAt: string;
  total: number;
}

type Listener = () => void;

export class LiveMatchStore {
  private matches = new Map<number, LiveMatch>();

  private structureRevision = 0;

  private structureSnapshot: MatchStructureSnapshot = {
    revision: 0,
    orderedIds: [],
    groups: [],
  };

  private metaSnapshot: StoreMetaSnapshot = {
    generatedAt: new Date(0).toISOString(),
    total: 0,
  };

  private readonly structureListeners = new Set<Listener>();

  private readonly metaListeners = new Set<Listener>();

  private readonly matchListeners = new Map<number, Set<Listener>>();

  constructor(initialSnapshot: MatchesSnapshotResponse) {
    this.replaceAll(initialSnapshot);
  }

  subscribeStructure = (listener: Listener): (() => void) => {
    this.structureListeners.add(listener);

    return () => {
      this.structureListeners.delete(listener);
    };
  };

  subscribeMeta = (listener: Listener): (() => void) => {
    this.metaListeners.add(listener);

    return () => {
      this.metaListeners.delete(listener);
    };
  };

  subscribeMatch = (matchId: number, listener: Listener): (() => void) => {
    const existing = this.matchListeners.get(matchId);

    if (existing) {
      existing.add(listener);
    } else {
      this.matchListeners.set(matchId, new Set([listener]));
    }

    return () => {
      const listeners = this.matchListeners.get(matchId);

      if (!listeners) {
        return;
      }

      listeners.delete(listener);

      if (listeners.size === 0) {
        this.matchListeners.delete(matchId);
      }
    };
  };

  getStructureSnapshot = (): MatchStructureSnapshot => this.structureSnapshot;

  getMetaSnapshot = (): StoreMetaSnapshot => this.metaSnapshot;

  getMatch = (matchId: number): LiveMatch | null => this.matches.get(matchId) ?? null;

  applySnapshot(snapshot: MatchesSnapshotResponse): void {
    const previousIds = new Set(this.matches.keys());
    this.replaceAll(snapshot);

    for (const match of snapshot.matches) {
      this.emitMatch(match.matchId);
      previousIds.delete(match.matchId);
    }

    for (const removedId of previousIds) {
      this.emitMatch(removedId);
    }

    this.emitStructure();
    this.emitMeta();
  }

  applyPage(page: MatchesPageResponse): void {
    const changedMatchIds = new Set<number>();
    let structureChanged = false;

    for (const match of page.matches) {
      const previous = this.matches.get(match.matchId);

      this.matches.set(match.matchId, match);
      changedMatchIds.add(match.matchId);

      if (!previous || previous !== match || patchAffectsStructure(match)) {
        structureChanged = true;
      }
    }

    this.metaSnapshot = {
      generatedAt: page.generatedAt,
      total: page.total,
    };

    if (structureChanged) {
      this.rebuildStructure();
      this.emitStructure();
    }

    for (const matchId of changedMatchIds) {
      this.emitMatch(matchId);
    }

    this.emitMeta();
  }

  applyDiff(diff: MatchesDiffResponse): void {
    let structureChanged = false;
    const changedMatchIds = new Set<number>();

    for (const removed of diff.removed) {
      if (this.matches.delete(removed.matchId)) {
        changedMatchIds.add(removed.matchId);
        structureChanged = true;
      }
    }

    for (const match of diff.added) {
      this.matches.set(match.matchId, match);
      changedMatchIds.add(match.matchId);
      structureChanged = true;
    }

    for (const patch of diff.updated) {
      const previous = this.matches.get(patch.matchId);

      if (!previous) {
        continue;
      }

      this.matches.set(patch.matchId, {
        ...previous,
        ...patch.changes,
      });
      changedMatchIds.add(patch.matchId);

      if (patchAffectsStructure(patch.changes)) {
        structureChanged = true;
      }
    }

    this.metaSnapshot = {
      generatedAt: diff.generatedAt,
      total: Math.max(this.metaSnapshot.total, this.matches.size),
    };

    if (structureChanged) {
      this.rebuildStructure();
      this.emitStructure();
    }

    if (changedMatchIds.size > 0) {
      for (const matchId of changedMatchIds) {
        this.emitMatch(matchId);
      }
    }

    this.emitMeta();
  }

  private replaceAll(snapshot: MatchesSnapshotResponse): void {
    this.matches = new Map(snapshot.matches.map((match) => [match.matchId, match]));
    this.metaSnapshot = {
      generatedAt: snapshot.generatedAt,
      total: snapshot.total,
    };
    this.rebuildStructure();
  }

  private rebuildStructure(): void {
    this.structureRevision += 1;
    this.structureSnapshot = createStructureSnapshot(
      this.matches.values(),
      this.structureRevision,
    );
  }

  private emitStructure(): void {
    for (const listener of this.structureListeners) {
      listener();
    }
  }

  private emitMeta(): void {
    for (const listener of this.metaListeners) {
      listener();
    }
  }

  private emitMatch(matchId: number): void {
    const listeners = this.matchListeners.get(matchId);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener();
    }
  }
}

export function useLiveMatchStoreMeta(store: LiveMatchStore): StoreMetaSnapshot {
  return useSyncExternalStore(
    store.subscribeMeta,
    store.getMetaSnapshot,
    store.getMetaSnapshot,
  );
}

export function useLiveMatchStructure(
  store: LiveMatchStore,
): MatchStructureSnapshot {
  return useSyncExternalStore(
    store.subscribeStructure,
    store.getStructureSnapshot,
    store.getStructureSnapshot,
  );
}

export function useLiveMatch(
  store: LiveMatchStore,
  matchId: number | null,
): LiveMatch | null {
  return useSyncExternalStore(
    (listener) => {
      if (matchId === null) {
        return () => undefined;
      }

      return store.subscribeMatch(matchId, listener);
    },
    () => (matchId === null ? null : store.getMatch(matchId)),
    () => (matchId === null ? null : store.getMatch(matchId)),
  );
}
