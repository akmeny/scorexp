"use client";

import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useSearchParams } from "next/navigation";
import { MatchDrawer } from "@/components/match-drawer";
import { MatchRowById } from "@/components/match-row";
import {
  describeBackendError,
  fetchTodayMatchesPage,
  isLikelyBackendWakeup,
} from "@/lib/api";
import { formatLastUpdated } from "@/lib/format";
import { clientLogger } from "@/lib/logger";
import {
  buildVisibleGroups,
  type LeagueGroup,
  type MatchFilters,
} from "@/lib/matches";
import {
  LiveMatchStore,
  useLiveMatchStoreMeta,
  useLiveMatchStructure,
} from "@/lib/live-match-store";
import { getSocket } from "@/lib/socket";
import type {
  MatchesDiffResponse,
  MatchesPageResponse,
  MatchesSnapshotResponse,
  MatchesSnapshotViewModel,
} from "@/lib/types";

type ConnectionStatus = "connecting" | "waking" | "live" | "reconnecting";

interface WakeRetryState {
  active: boolean;
  attempt: number;
  nextDelayMs: number | null;
  lastError: string | null;
}

interface PaginationState {
  hasMore: boolean;
  loading: boolean;
  nextOffset: number;
  error: string | null;
}

const pageSize = 72;
const coldStartRetryDelays = [2500, 5000, 10000, 20000, 30000];
const delayedDataThresholdMs = 90_000;
const freshnessTickMs = 30_000;
const loadMoreRootMargin = "1200px 0px 1600px";

function countVisibleMatches(groups: readonly LeagueGroup[]): number {
  return groups.reduce((total, group) => total + group.matchIds.length, 0);
}

function formatSeconds(milliseconds: number): string {
  return `${Math.ceil(milliseconds / 1000)}s`;
}

function createEmptySnapshot(): MatchesSnapshotResponse {
  return {
    matches: [],
    generatedAt: new Date().toISOString(),
    total: 0,
  };
}

const FilterBar = memo(function FilterBar({
  query,
  liveOnly,
  totalMatches,
  visibleMatches,
  onQueryChange,
  onLiveOnlyChange,
}: {
  query: string;
  liveOnly: boolean;
  totalMatches: number;
  visibleMatches: number;
  onQueryChange: (value: string) => void;
  onLiveOnlyChange: (value: boolean) => void;
}) {
  return (
    <section className="filter-bar" aria-label="Scoreboard filters">
      <label className="search-control">
        <span>Search team</span>
        <input
          type="search"
          value={query}
          placeholder="Team, league, or country"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
      </label>

      <button
        type="button"
        className={`filter-toggle ${liveOnly ? "is-active" : ""}`}
        aria-pressed={liveOnly}
        onClick={() => onLiveOnlyChange(!liveOnly)}
      >
        Live only
      </button>

      <div className="filter-summary" aria-live="polite">
        <strong>{visibleMatches}</strong>
        <span>shown</span>
        <span className="summary-divider">/</span>
        <span>{totalMatches} today</span>
      </div>
    </section>
  );
});

const LeagueStreamSection = memo(function LeagueStreamSection({
  store,
  group,
  selectedMatchId,
}: {
  store: LiveMatchStore;
  group: LeagueGroup;
  selectedMatchId: number | null;
}) {
  return (
    <section className="league-stream-section">
      <header className="league-flat-header">
        <div>
          <h2 className="league-title">{group.leagueName}</h2>
          <p className="league-country">{group.country}</p>
        </div>
        <span className="league-count">{group.matchIds.length}</span>
      </header>

      <div className="league-stream-matches">
        {group.matchIds.map((matchId) => (
          <MatchRowById
            key={matchId}
            store={store}
            matchId={matchId}
            isSelected={selectedMatchId === matchId}
          />
        ))}
      </div>
    </section>
  );
});

const ProgressiveScoreboardList = memo(function ProgressiveScoreboardList({
  store,
  groups,
  selectedMatchId,
  loadedMatches,
  totalMatches,
  pagination,
  loadMoreRef,
}: {
  store: LiveMatchStore;
  groups: readonly LeagueGroup[];
  selectedMatchId: number | null;
  loadedMatches: number;
  totalMatches: number;
  pagination: PaginationState;
  loadMoreRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="scoreboard-stream" aria-label="Today scores">
      {groups.map((group) => (
        <LeagueStreamSection
          key={group.key}
          store={store}
          group={group}
          selectedMatchId={selectedMatchId}
        />
      ))}

      <div ref={loadMoreRef} className="load-more-sentinel" aria-live="polite">
        {pagination.loading ? (
          <div className="progressive-loader">
            <span className="loader-shimmer" />
            <span>Loading more matches...</span>
          </div>
        ) : pagination.error ? (
          <div className="progressive-loader is-error">
            <span>{pagination.error}</span>
          </div>
        ) : pagination.hasMore ? (
          <div className="progressive-loader">
            <span>{loadedMatches} loaded</span>
            <span>Scroll for more</span>
          </div>
        ) : (
          <div className="progressive-loader is-complete">
            <span>
              All {totalMatches} matches loaded for this view.
            </span>
          </div>
        )}
      </div>
    </section>
  );
});

export function LiveScoresClient({
  initialSnapshot,
}: {
  initialSnapshot: MatchesSnapshotViewModel;
}) {
  const [store] = useState(() => new LiveMatchStore(initialSnapshot));
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>(initialSnapshot.error ? "waking" : "connecting");
  const [transportError, setTransportError] = useState<string | null>(
    initialSnapshot.error,
  );
  const [wakeRetry, setWakeRetry] = useState<WakeRetryState>({
    active: Boolean(initialSnapshot.error),
    attempt: initialSnapshot.error ? 1 : 0,
    nextDelayMs: initialSnapshot.error ? coldStartRetryDelays[0] ?? null : null,
    lastError: initialSnapshot.error,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    hasMore: true,
    loading: false,
    nextOffset: 0,
    error: null,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const paginationRef = useRef<PaginationState>({
    hasMore: true,
    loading: false,
    nextOffset: 0,
    error: null,
  });
  const retryTimerRef = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const deferredQuery = useDeferredValue(query);
  const structure = useLiveMatchStructure(store);
  const meta = useLiveMatchStoreMeta(store);
  const searchParams = useSearchParams();
  const selectedMatchId = Number(searchParams.get("matchId") ?? "");
  const activeMatchId =
    Number.isInteger(selectedMatchId) && selectedMatchId > 0
      ? selectedMatchId
      : null;

  const setPaginationState = useEffectEvent((next: PaginationState) => {
    paginationRef.current = next;
    setPagination(next);
  });

  const filters: MatchFilters = useMemo(
    () => ({
      query: deferredQuery,
      liveOnly,
    }),
    [deferredQuery, liveOnly],
  );

  const visibleGroups = useMemo(
    () => buildVisibleGroups(structure, store.getMatch, filters),
    [filters, store, structure],
  );
  const visibleMatchCount = useMemo(
    () => countVisibleMatches(visibleGroups),
    [visibleGroups],
  );
  const loadedMatchCount = structure.orderedIds.length;
  const hasMatchesInStore = loadedMatchCount > 0;

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleLiveOnlyChange = useCallback((value: boolean) => {
    startTransition(() => {
      setLiveOnly(value);
    });
  }, []);

  const loadMatchesPage = useEffectEvent(async (reset: boolean) => {
    const current = paginationRef.current;

    if (current.loading || (!reset && !current.hasMore)) {
      return;
    }

    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const offset = reset ? 0 : current.nextOffset;
    setPaginationState({
      hasMore: reset ? true : current.hasMore,
      loading: true,
      nextOffset: offset,
      error: null,
    });

    try {
      const page: MatchesPageResponse = await fetchTodayMatchesPage({
        offset,
        limit: pageSize,
        query: deferredQuery,
        liveOnly,
      });

      startTransition(() => {
        if (reset) {
          store.applySnapshot(page);
        } else {
          store.applyPage(page);
        }
      });

      setTransportError(null);
      setWakeRetry({
        active: false,
        attempt: 0,
        nextDelayMs: null,
        lastError: null,
      });
      setPaginationState({
        hasMore: page.hasMore,
        loading: false,
        nextOffset: page.nextOffset ?? offset + page.matches.length,
        error: null,
      });
    } catch (error) {
      const message = describeBackendError(error);
      const likelyWakeup = isLikelyBackendWakeup(error);
      const storeEmpty = store.getStructureSnapshot().orderedIds.length === 0;

      setConnectionStatus(storeEmpty ? "waking" : "reconnecting");
      setTransportError(message);
      setPaginationState({
        hasMore: reset ? true : current.hasMore,
        loading: false,
        nextOffset: offset,
        error: message,
      });
      clientLogger.warn("Today page fetch failed", {
        offset,
        reset,
        likelyWakeup,
        message,
      });

      if (likelyWakeup && storeEmpty) {
        setWakeRetry((currentWakeRetry) => {
          const attempt = currentWakeRetry.active
            ? currentWakeRetry.attempt + 1
            : 1;
          const delay =
            coldStartRetryDelays[
              Math.min(attempt - 1, coldStartRetryDelays.length - 1)
            ] ?? 30000;

          retryTimerRef.current = window.setTimeout(() => {
            void loadMatchesPage(true);
          }, delay);

          return {
            active: true,
            attempt,
            nextDelayMs: delay,
            lastError: message,
          };
        });
      }
    }
  });

  const handleSnapshot = useEffectEvent((snapshot: MatchesSnapshotResponse) => {
    setTransportError(null);
    setWakeRetry({
      active: false,
      attempt: 0,
      nextDelayMs: null,
      lastError: null,
    });
    startTransition(() => {
      store.applySnapshot(snapshot);
    });
  });

  const handleDiff = useEffectEvent((diff: MatchesDiffResponse) => {
    setTransportError(null);
    setWakeRetry((current) => ({
      ...current,
      active: false,
      nextDelayMs: null,
      lastError: null,
    }));
    startTransition(() => {
      store.applyDiff(diff);
    });
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, freshnessTickMs);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    setPaginationState({
      hasMore: true,
      loading: false,
      nextOffset: 0,
      error: null,
    });
    startTransition(() => {
      store.applySnapshot(createEmptySnapshot());
    });
    void loadMatchesPage(true);
  }, [deferredQuery, liveOnly, loadMatchesPage, setPaginationState, store]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMatchesPage(false);
        }
      },
      {
        root: null,
        rootMargin: loadMoreRootMargin,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    hasMatchesInStore,
    loadMatchesPage,
    pagination.hasMore,
    visibleGroups.length,
  ]);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnectionStatus("live");
      setTransportError(null);
      setWakeRetry({
        active: false,
        attempt: 0,
        nextDelayMs: null,
        lastError: null,
      });
      clientLogger.info("Socket connected");
    };

    const onDisconnect = () => {
      setConnectionStatus("reconnecting");
      clientLogger.warn("Socket disconnected");
    };

    const onConnectError = (error: Error) => {
      const storeEmpty = store.getMetaSnapshot().total === 0;
      setConnectionStatus(storeEmpty ? "waking" : "reconnecting");
      setTransportError(
        storeEmpty
          ? "The backend may be waking up. Reconnect attempts are backed off automatically."
          : error.message,
      );
      clientLogger.warn("Socket connection failed", {
        message: error.message,
        storeEmpty,
      });
    };

    const onReconnectAttempt = (attempt: number) => {
      clientLogger.info("Socket reconnect attempt", {
        attempt,
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("matches:snapshot", handleSnapshot);
    socket.on("matches:diff", handleDiff);
    socket.io.on("reconnect_attempt", onReconnectAttempt);

    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("matches:snapshot", handleSnapshot);
      socket.off("matches:diff", handleDiff);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.disconnect();
    };
  }, []);

  const connectionStatusClass =
    connectionStatus === "live"
      ? "is-live"
      : connectionStatus === "connecting"
        ? "is-connecting"
        : "is-muted";
  const connectionStatusLabel =
    connectionStatus === "live"
      ? "Live socket"
      : connectionStatus === "connecting"
        ? "Connecting"
        : connectionStatus === "waking"
          ? "Backend waking"
          : "Reconnecting";
  const lastUpdateMs = new Date(meta.generatedAt).getTime();
  const dataAgeMs = Number.isFinite(lastUpdateMs)
    ? Math.max(0, nowMs - lastUpdateMs)
    : 0;
  const dataDelayed =
    hasMatchesInStore &&
    connectionStatus !== "live" &&
    dataAgeMs >= delayedDataThresholdMs;

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">ScoreXP</p>
          <h1 className="page-title">Today&apos;s football scores</h1>
          <p className="page-subtitle">
            Full-day fixture coverage grouped by league, with live matches
            refreshed through compact socket diffs as the action changes.
          </p>
        </div>
        <div className="hero-meta">
          <span className={`status-pill ${connectionStatusClass}`}>
            {connectionStatusLabel}
          </span>
          <span className="timestamp-label">
            Last updated {formatLastUpdated(meta.generatedAt)}
          </span>
        </div>
      </section>

      <FilterBar
        query={query}
        liveOnly={liveOnly}
        totalMatches={meta.total}
        visibleMatches={visibleMatchCount}
        onQueryChange={handleQueryChange}
        onLiveOnlyChange={handleLiveOnlyChange}
      />

      {transportError ? (
        <section className="banner banner-warning">
          <p>{transportError}</p>
          {wakeRetry.active && wakeRetry.nextDelayMs ? (
            <p className="banner-subtext">
              Retry {wakeRetry.attempt} scheduled in{" "}
              {formatSeconds(wakeRetry.nextDelayMs)}.
            </p>
          ) : null}
        </section>
      ) : null}

      {dataDelayed ? (
        <section className="banner banner-info">
          <p>
            Live data is temporarily delayed. Keeping the latest known scores on
            screen while the backend reconnects.
          </p>
          <p className="banner-subtext">
            Last successful update was about {formatSeconds(dataAgeMs)} ago.
          </p>
        </section>
      ) : null}

      {!hasMatchesInStore && pagination.loading ? (
        <section className="empty-card wake-card">
          <span className="wake-pulse" />
          <p>Loading today&apos;s football board.</p>
          <p className="empty-subtext">
            Pulling only the first screenful now. More matches and logos load as
            you scroll.
          </p>
        </section>
      ) : !hasMatchesInStore ? (
        <section className={`empty-card ${wakeRetry.active ? "wake-card" : ""}`}>
          {wakeRetry.active ? <span className="wake-pulse" /> : null}
          <p>
            {wakeRetry.active
              ? "Backend is waking up."
              : "No football matches are in today's store right now."}
          </p>
          <p className="empty-subtext">
            {wakeRetry.active
              ? "Render free services can sleep after inactivity. ScoreXP is retrying with safe backoff and will hydrate the live list automatically."
              : "Once API-Sports returns today's fixtures, they will appear here automatically."}
          </p>
          {wakeRetry.active && wakeRetry.lastError ? (
            <p className="empty-subtext">{wakeRetry.lastError}</p>
          ) : null}
        </section>
      ) : visibleGroups.length === 0 ? (
        <section className="empty-card">
          <p>No matches pass the current filters.</p>
          <p className="empty-subtext">
            Clear search or turn off live-only mode to widen the list.
          </p>
        </section>
      ) : (
        <section className="scoreboard-grid">
          <ProgressiveScoreboardList
            store={store}
            groups={visibleGroups}
            selectedMatchId={activeMatchId}
            loadedMatches={loadedMatchCount}
            totalMatches={meta.total}
            pagination={pagination}
            loadMoreRef={loadMoreRef}
          />
          <MatchDrawer store={store} selectedMatchId={activeMatchId} />
        </section>
      )}
    </main>
  );
}
