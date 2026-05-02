import { useCallback, useEffect, useRef, useState } from "react";
import { fetchScoreboard } from "../lib/api";
import type { ScoreboardSnapshot, ScoreboardView } from "../types";

interface UseScoreboardState {
  data: ScoreboardSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}

export function useScoreboard(date: string, timezone: string, view: ScoreboardView): UseScoreboardState {
  const [data, setData] = useState<ScoreboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const requestKey = `${date}:${timezone}:${view}`;

  const load = useCallback(
    async (silent = false) => {
      const controller = new AbortController();
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
          setData((current) => {
            if (current && current.checksum === nextSnapshot.checksum && current.view === nextSnapshot.view) {
              return current;
            }
            return nextSnapshot;
          });
        }
        setError(null);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") {
          setError((caught as Error).message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }

      return () => controller.abort();
    },
    [date, timezone, view]
  );

  useEffect(() => {
    etagRef.current = null;
    void load(false);
  }, [load, requestKey]);

  useEffect(() => {
    const seconds = data?.refreshPolicy.clientRefreshSeconds ?? 30;
    const interval = window.setInterval(() => {
      void load(true);
    }, Math.max(10, seconds) * 1000);

    return () => window.clearInterval(interval);
  }, [data?.refreshPolicy.clientRefreshSeconds, load]);

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => void load(true)
  };
}
