import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMatchDetail } from "../lib/api";
import type { MatchDetail } from "../types";

interface UseMatchDetailState {
  data: MatchDetail | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}

export function useMatchDetail(matchId: string | null, timezone: string, refreshKey: string | null = null): UseMatchDetailState {
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const dataRef = useRef<MatchDetail | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (silent = false, options: { force?: boolean } = {}) => {
      if (!matchId) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (silent) setRefreshing(true);
      if (!silent) setLoading(true);

      try {
        const result = await fetchMatchDetail({
          matchId,
          timezone,
          etag: etagRef.current,
          force: options.force,
          signal: controller.signal
        });

        if (result.etag) etagRef.current = result.etag;
        if (result.detail) {
          setData((current) => {
            if (current && current.checksum === result.detail?.checksum) {
              dataRef.current = current;
              return current;
            }

            dataRef.current = result.detail;
            return result.detail;
          });
        }
        setError(null);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") {
          console.warn("Maç detayı yenileme başarısız oldu", caught);
          setError(dataRef.current ? null : "Maç detayı şu anda alınamadı.");
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [matchId, timezone]
  );

  useEffect(() => {
    etagRef.current = null;
    dataRef.current = null;
    setData(null);
    setError(null);

    if (!matchId) {
      setLoading(false);
      setRefreshing(false);
      abortRef.current?.abort();
      return;
    }

    void load(false);
    return () => abortRef.current?.abort();
  }, [load, matchId]);

  useEffect(() => {
    if (!matchId || !data) return;

    const seconds = data.refreshPolicy.clientRefreshSeconds;
    const interval = window.setInterval(() => {
      void load(true);
    }, Math.max(10, seconds) * 1000);

    return () => window.clearInterval(interval);
  }, [data, load, matchId]);

  useEffect(() => {
    if (!matchId || !refreshKey || !dataRef.current) return;
    void load(true, { force: true });
  }, [load, matchId, refreshKey]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "visible") {
        void load(true, { force: true });
      }
    };
    const refreshOnPageShow = (event: PageTransitionEvent) => {
      if (event.persisted || document.visibilityState === "visible") {
        void load(true, { force: true });
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
    reload: () => void load(true, { force: true })
  };
}
