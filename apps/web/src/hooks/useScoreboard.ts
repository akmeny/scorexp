import { useCallback, useEffect, useRef, useState } from "react";
import { fetchScoreboard } from "../lib/api";
import type { ScoreboardSnapshot, ScoreboardView } from "../types";

const SCOREBOARD_CACHE_PREFIX = "scorexp:scoreboard:v2";
const SCOREBOARD_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const SCOREBOARD_LIVE_CACHE_MAX_AGE_MS = 30 * 1000;

interface UseScoreboardState {
  data: ScoreboardSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}

export function useScoreboard(date: string, timezone: string, view: ScoreboardView): UseScoreboardState {
  const initialSnapshotRef = useRef<ScoreboardSnapshot | null | undefined>(undefined);
  if (initialSnapshotRef.current === undefined) {
    initialSnapshotRef.current = readCachedScoreboard(date, timezone, view);
  }

  const [data, setData] = useState<ScoreboardSnapshot | null>(() => initialSnapshotRef.current ?? null);
  const [loading, setLoading] = useState(() => !initialSnapshotRef.current);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const dataRef = useRef<ScoreboardSnapshot | null>(initialSnapshotRef.current ?? null);
  const abortRef = useRef<AbortController | null>(null);
  const requestKey = `${date}:${timezone}:${view}`;

  const load = useCallback(
    async (silent = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (silent) setRefreshing(true);
      if (!silent) setLoading(true);

      try {
        const result = await fetchScoreboard({
          date,
          timezone,
          view,
          etag: etagRef.current,
          signal: controller.signal
        });

        if (result.etag) etagRef.current = result.etag;
        const nextSnapshot = result.snapshot;
        if (nextSnapshot) {
          writeCachedScoreboard(nextSnapshot);
          setData((current) => {
            if (current && current.checksum === nextSnapshot.checksum && current.view === nextSnapshot.view) {
              dataRef.current = current;
              return current;
            }
            dataRef.current = nextSnapshot;
            return nextSnapshot;
          });
        }
        setError(null);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") {
          console.warn("Skor yenileme başarısız oldu", caught);
          setError(dataRef.current ? null : "Skorlar şu anda alınamadı.");
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [date, timezone, view]
  );

  useEffect(() => {
    etagRef.current = null;
    const cached = readCachedScoreboard(date, timezone, view);

    if (cached) {
      dataRef.current = cached;
      setData(cached);
      setLoading(false);
      void load(true);
    } else {
      dataRef.current = null;
      setData(null);
      void load(false);
    }

    return () => abortRef.current?.abort();
  }, [load, requestKey]);

  useEffect(() => {
    const seconds = data?.refreshPolicy.clientRefreshSeconds ?? 100;
    const interval = window.setInterval(() => {
      void load(true);
    }, Math.max(10, seconds) * 1000);

    return () => window.clearInterval(interval);
  }, [data?.refreshPolicy.clientRefreshSeconds, load]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    };
    const refreshOnPageShow = (event: PageTransitionEvent) => {
      if (event.persisted || document.visibilityState === "visible") {
        void load(true);
      }
    };

    document.addEventListener("visibilitychange", refreshOnResume);
    window.addEventListener("focus", refreshOnResume);
    window.addEventListener("online", refreshOnResume);
    window.addEventListener("pageshow", refreshOnPageShow);

    return () => {
      document.removeEventListener("visibilitychange", refreshOnResume);
      window.removeEventListener("focus", refreshOnResume);
      window.removeEventListener("online", refreshOnResume);
      window.removeEventListener("pageshow", refreshOnPageShow);
    };
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => void load(true)
  };
}

function readCachedScoreboard(date: string, timezone: string, view: ScoreboardView): ScoreboardSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(scoreboardCacheKey(date, timezone, view));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { savedAt?: number; snapshot?: ScoreboardSnapshot };
    if (!parsed.snapshot || typeof parsed.savedAt !== "number") return null;
    const age = Date.now() - parsed.savedAt;
    if (snapshotHasLiveMatches(parsed.snapshot) && age > SCOREBOARD_LIVE_CACHE_MAX_AGE_MS) return null;
    if (age > SCOREBOARD_CACHE_MAX_AGE_MS) return null;
    if (parsed.snapshot.date !== date || parsed.snapshot.timezone !== timezone || parsed.snapshot.view !== view) return null;

    return parsed.snapshot;
  } catch {
    return null;
  }
}

function writeCachedScoreboard(snapshot: ScoreboardSnapshot): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      scoreboardCacheKey(snapshot.date, snapshot.timezone, snapshot.view),
      JSON.stringify({
        savedAt: Date.now(),
        snapshot
      })
    );
  } catch {
    // Storage can be unavailable in private modes or when the quota is full.
  }
}

function scoreboardCacheKey(date: string, timezone: string, view: ScoreboardView) {
  return `${SCOREBOARD_CACHE_PREFIX}:${date}:${timezone}:${view}`;
}

function snapshotHasLiveMatches(snapshot: ScoreboardSnapshot) {
  return snapshot.counts.live > 0 || snapshot.refreshPolicy.reason === "live";
}
