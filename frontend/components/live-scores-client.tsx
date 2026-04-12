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
  type UIEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { MatchDrawer } from "@/components/match-drawer";
import { MatchRowById } from "@/components/match-row";
import {
  describeBackendError,
  fetchTodayMatchesSnapshot,
  isLikelyBackendWakeup,
} from "@/lib/api";
import { formatLastUpdated } from "@/lib/format";
import { clientLogger } from "@/lib/logger";
import {
  buildVisibleGroups,
  flattenGroups,
  type FlatListItem,
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

interface ItemMeasurements {
  heights: number[];
  offsets: number[];
  totalHeight: number;
}

const leagueHeaderHeight = 70;
const matchRowHeight = 82;
const overscan = 8;
const coldStartRetryDelays = [2500, 5000, 10000, 20000, 30000];
const delayedDataThresholdMs = 90_000;
const freshnessTickMs = 30_000;

function getItemHeight(item: FlatListItem): number {
  return item.type === "league" ? leagueHeaderHeight : matchRowHeight;
}

function buildMeasurements(items: readonly FlatListItem[]): ItemMeasurements {
  const heights: number[] = [];
  const offsets: number[] = [];
  let totalHeight = 0;

  for (const item of items) {
    const height = getItemHeight(item);
    offsets.push(totalHeight);
    heights.push(height);
    totalHeight += height;
  }

  return {
    heights,
    offsets,
    totalHeight,
  };
}

function findStartIndex(
  offsets: readonly number[],
  heights: readonly number[],
  scrollTop: number,
): number {
  let low = 0;
  let high = offsets.length - 1;
  let result = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const itemBottom = (offsets[middle] ?? 0) + (heights[middle] ?? 0);

    if (itemBottom <= scrollTop) {
      low = middle + 1;
    } else {
      result = middle;
      high = middle - 1;
    }
  }

  return result;
}

function countVisibleMatches(groups: readonly LeagueGroup[]): number {
  return groups.reduce((total, group) => total + group.matchIds.length, 0);
}

function formatSeconds(milliseconds: number): string {
  return `${Math.ceil(milliseconds / 1000)}s`;
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

const LeagueVirtualHeader = memo(function LeagueVirtualHeader({
  group,
}: {
  group: LeagueGroup;
}) {
  return (
    <header className="league-flat-header">
      <div>
        <h2 className="league-title">{group.leagueName}</h2>
        <p className="league-country">{group.country}</p>
      </div>
      <span className="league-count">{group.matchIds.length}</span>
    </header>
  );
});

const VirtualizedScoreboardList = memo(function VirtualizedScoreboardList({
  store,
  groups,
  selectedMatchId,
}: {
  store: LiveMatchStore;
  groups: readonly LeagueGroup[];
  selectedMatchId: number | null;
}) {
  const items = useMemo(() => flattenGroups(groups), [groups]);
  const measurements = useMemo(() => buildMeasurements(items), [items]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(680);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateViewportHeight = () => {
      setViewportHeight(viewport.clientHeight || 680);
    };

    updateViewportHeight();

    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    pendingScrollTopRef.current = event.currentTarget.scrollTop;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setScrollTop(pendingScrollTopRef.current);
    });
  }, []);

  if (items.length === 0) {
    return null;
  }

  const maxScrollTop = Math.max(0, measurements.totalHeight - viewportHeight);
  const clampedScrollTop = Math.min(scrollTop, maxScrollTop);
  const firstVisibleIndex = findStartIndex(
    measurements.offsets,
    measurements.heights,
    clampedScrollTop,
  );
  const viewportBottom = clampedScrollTop + viewportHeight;
  let lastVisibleIndex = firstVisibleIndex;

  while (
    lastVisibleIndex < items.length &&
    (measurements.offsets[lastVisibleIndex] ?? 0) < viewportBottom
  ) {
    lastVisibleIndex += 1;
  }

  const startIndex = Math.max(0, firstVisibleIndex - overscan);
  const endIndex = Math.min(items.length, lastVisibleIndex + overscan);
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <section className="scoreboard-virtual-card" aria-label="Live scores">
      <div
        ref={viewportRef}
        className="scoreboard-list-viewport"
        onScroll={handleScroll}
      >
        <div
          className="scoreboard-virtual-inner"
          style={{
            height: measurements.totalHeight,
          }}
        >
          {visibleItems.map((item, visibleIndex) => {
            const itemIndex = startIndex + visibleIndex;
            const height = measurements.heights[itemIndex] ?? matchRowHeight;
            const offset = measurements.offsets[itemIndex] ?? 0;

            return (
              <div
                key={item.key}
                className={`scoreboard-virtual-item is-${item.type}`}
                style={{
                  height,
                  transform: `translateY(${offset}px)`,
                }}
              >
                {item.type === "league" ? (
                  <LeagueVirtualHeader group={item.group} />
                ) : (
                  <MatchRowById
                    store={store}
                    matchId={item.matchId}
                    isSelected={selectedMatchId === item.matchId}
                  />
                )}
              </div>
            );
          })}
        </div>
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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const structure = useLiveMatchStructure(store);
  const meta = useLiveMatchStoreMeta(store);
  const searchParams = useSearchParams();
  const selectedMatchId = Number(searchParams.get("matchId") ?? "");
  const activeMatchId =
    Number.isInteger(selectedMatchId) && selectedMatchId > 0
      ? selectedMatchId
      : null;

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

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleLiveOnlyChange = useCallback((value: boolean) => {
    startTransition(() => {
      setLiveOnly(value);
    });
  }, []);

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
    if (!initialSnapshot.error) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let attempt = 0;

    const scheduleSnapshotRetry = () => {
      const delay =
        coldStartRetryDelays[
          Math.min(attempt, coldStartRetryDelays.length - 1)
        ] ?? 30000;

      setWakeRetry((current) => ({
        active: true,
        attempt: attempt + 1,
        nextDelayMs: delay,
        lastError: current.lastError,
      }));
      setConnectionStatus((current) => (current === "live" ? current : "waking"));

      timer = window.setTimeout(() => {
        void retrySnapshot();
      }, delay);
    };

    const retrySnapshot = async () => {
      try {
        clientLogger.info("Retrying today snapshot after backend wake delay", {
          attempt: attempt + 1,
        });

        const snapshot = await fetchTodayMatchesSnapshot();

        if (cancelled) {
          return;
        }

        startTransition(() => {
          store.applySnapshot(snapshot);
        });
        setTransportError(null);
        setWakeRetry({
          active: false,
          attempt: 0,
          nextDelayMs: null,
          lastError: null,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = describeBackendError(error);
        attempt += 1;
        setTransportError(message);
        setWakeRetry({
          active: isLikelyBackendWakeup(error),
          attempt,
          nextDelayMs: null,
          lastError: message,
        });
        clientLogger.warn("Today snapshot retry failed", {
          attempt,
          likelyWakeup: isLikelyBackendWakeup(error),
          message,
        });
        scheduleSnapshotRetry();
      }
    };

    scheduleSnapshotRetry();

    return () => {
      cancelled = true;

      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [initialSnapshot.error, store]);

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
  const hasMatchesInStore = structure.orderedIds.length > 0;
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

      {!hasMatchesInStore ? (
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
          <VirtualizedScoreboardList
            store={store}
            groups={visibleGroups}
            selectedMatchId={activeMatchId}
          />
          <MatchDrawer store={store} selectedMatchId={activeMatchId} />
        </section>
      )}
    </main>
  );
}
