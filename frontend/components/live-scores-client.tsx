"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
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
import {
  formatDateLabel,
  getScoreboardDateKey,
  isTodayDateKey,
  isValidDateKey,
  offsetDateKey,
} from "@/lib/date";
import { loadFavorites, saveFavorites } from "@/lib/favorites";
import {
  LiveMatchStore,
  useLiveMatchStoreMeta,
  useLiveMatchStructure,
} from "@/lib/live-match-store";
import { clientLogger } from "@/lib/logger";
import {
  buildFavoriteGroups,
  buildVisibleGroups,
  type LeagueGroup,
  type MatchFilters,
} from "@/lib/matches";
import { getSocket } from "@/lib/socket";
import type {
  MatchesDiffResponse,
  MatchesPageResponse,
  MatchesSnapshotResponse,
  MatchesSnapshotViewModel,
} from "@/lib/types";

type ConnectionStatus = "connecting" | "waking" | "live" | "reconnecting";
type ScoreboardMode = "all" | "live" | "favorites";

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

function createLeaguePanelId(groupKey: string): string {
  return `league-panel-${groupKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

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

const ScoreboardNavigation = memo(function ScoreboardNavigation({
  mode,
  selectedDate,
  favoriteCount,
  onShowToday,
  onShowLive,
  onShowFavorites,
  onShiftDate,
  onOpenDatePicker,
  onDateChange,
  dateInputRef,
}: {
  mode: ScoreboardMode;
  selectedDate: string;
  favoriteCount: number;
  onShowToday: () => void;
  onShowLive: () => void;
  onShowFavorites: () => void;
  onShiftDate: (direction: -1 | 1) => void;
  onOpenDatePicker: () => void;
  onDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  dateInputRef: RefObject<HTMLInputElement | null>;
}) {
  const isToday = isTodayDateKey(selectedDate);

  return (
    <section className="scoreboard-nav" aria-label="Scoreboard navigation">
      <div className="scoreboard-nav-modes">
        <button
          type="button"
          className={`scoreboard-nav-button ${
            mode === "all" && isToday ? "is-active" : ""
          }`}
          aria-pressed={mode === "all" && isToday}
          onClick={onShowToday}
        >
          {"Bug\u00FCn"}
        </button>
        <button
          type="button"
          className={`scoreboard-nav-button ${mode === "live" ? "is-active" : ""}`}
          aria-pressed={mode === "live"}
          onClick={onShowLive}
        >
          {"Canl\u0131"}
        </button>
        <button
          type="button"
          className={`scoreboard-nav-button ${
            mode === "favorites" ? "is-active" : ""
          }`}
          aria-pressed={mode === "favorites"}
          onClick={onShowFavorites}
        >
          Favoriler
          {favoriteCount > 0 ? (
            <span className="scoreboard-nav-count">{favoriteCount}</span>
          ) : null}
        </button>
      </div>

      <div className="scoreboard-nav-date">
        <button
          type="button"
          className="scoreboard-date-arrow"
          aria-label="Previous day"
          onClick={() => onShiftDate(-1)}
        >
          &lt;
        </button>
        <button
          type="button"
          className="scoreboard-date-button"
          onClick={onOpenDatePicker}
        >
          {formatDateLabel(selectedDate)}
        </button>
        <button
          type="button"
          className="scoreboard-date-arrow"
          aria-label="Next day"
          onClick={() => onShiftDate(1)}
        >
          &gt;
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          onChange={onDateChange}
          className="scoreboard-date-native"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </section>
  );
});

const LeagueStreamSection = memo(function LeagueStreamSection({
  store,
  group,
  isOpen,
  isFavorite,
  favoriteMatchIds,
  selectedMatchId,
  onToggle,
  onToggleFavorite,
  onToggleFavoriteMatch,
}: {
  store: LiveMatchStore;
  group: LeagueGroup;
  isOpen: boolean;
  isFavorite: boolean;
  favoriteMatchIds: ReadonlySet<number>;
  selectedMatchId: number | null;
  onToggle: (groupKey: string) => void;
  onToggleFavorite: (groupKey: string) => void;
  onToggleFavoriteMatch: (matchId: number) => void;
}) {
  const panelId = createLeaguePanelId(group.key);

  return (
    <section
      className={`league-stream-section ${isOpen ? "is-open" : "is-collapsed"}`}
    >
      <div className="league-flat-header">
        <button
          type="button"
          className="league-toggle-main"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => onToggle(group.key)}
        >
          <div>
            <div className="league-primary-line">
              {group.countryFlag ? (
                <img
                  src={group.countryFlag}
                  alt=""
                  width={18}
                  height={13}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="country-flag"
                />
              ) : (
                <span className="country-flag country-flag-fallback" />
              )}
              <h2 className="league-title">{group.country}</h2>
            </div>
            <p className="league-country">{group.leagueName}</p>
          </div>
          <div className="league-toggle-meta">
            <span className="league-count">{group.matchIds.length}</span>
            <span
              aria-hidden="true"
              className={`league-chevron ${isOpen ? "is-open" : ""}`}
            />
          </div>
        </button>
        <button
          type="button"
          className={`favorite-toggle league-favorite-toggle ${
            isFavorite ? "is-active" : ""
          }`}
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite(group.key)}
        >
          {isFavorite ? "Saved" : "Save"}
        </button>
      </div>

      {isOpen ? (
        <div id={panelId} className="league-stream-matches">
          {group.matchIds.map((matchId) => (
            <MatchRowById
              key={matchId}
              store={store}
              matchId={matchId}
              isSelected={selectedMatchId === matchId}
              isFavorite={favoriteMatchIds.has(matchId)}
              onToggleFavorite={onToggleFavoriteMatch}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
});

const ProgressiveScoreboardList = memo(function ProgressiveScoreboardList({
  store,
  groups,
  expandedLeagueKeys,
  favoriteLeagueKeys,
  favoriteMatchIds,
  selectedMatchId,
  loadedMatches,
  visibleMatchCount,
  totalMatches,
  pagination,
  loadMoreRef,
  mode,
  emptyState,
  onToggleLeague,
  onToggleFavoriteLeague,
  onToggleFavoriteMatch,
}: {
  store: LiveMatchStore;
  groups: readonly LeagueGroup[];
  expandedLeagueKeys: ReadonlySet<string>;
  favoriteLeagueKeys: ReadonlySet<string>;
  favoriteMatchIds: ReadonlySet<number>;
  selectedMatchId: number | null;
  loadedMatches: number;
  visibleMatchCount: number;
  totalMatches: number;
  pagination: PaginationState;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  mode: ScoreboardMode;
  emptyState: string | null;
  onToggleLeague: (groupKey: string) => void;
  onToggleFavoriteLeague: (groupKey: string) => void;
  onToggleFavoriteMatch: (matchId: number) => void;
}) {
  const showInlineEmpty =
    groups.length === 0 &&
    !pagination.loading &&
    !pagination.hasMore &&
    Boolean(emptyState);

  return (
    <section className="scoreboard-stream" aria-label="Football scores">
      {showInlineEmpty ? (
        <section className="empty-card scoreboard-inline-empty">
          <p>{emptyState}</p>
        </section>
      ) : null}

      {groups.map((group) => (
        <LeagueStreamSection
          key={group.key}
          store={store}
          group={group}
          isOpen={expandedLeagueKeys.has(group.key)}
          isFavorite={favoriteLeagueKeys.has(group.key)}
          favoriteMatchIds={favoriteMatchIds}
          selectedMatchId={selectedMatchId}
          onToggle={onToggleLeague}
          onToggleFavorite={onToggleFavoriteLeague}
          onToggleFavoriteMatch={onToggleFavoriteMatch}
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
            <span>
              {mode === "favorites"
                ? `${visibleMatchCount} favorite matches visible`
                : `${loadedMatches} loaded`}
            </span>
            <span>Scroll for more</span>
          </div>
        ) : (
          <div className="progressive-loader is-complete">
            <span>
              {mode === "favorites"
                ? visibleMatchCount === 0
                  ? "No favorite matches on this date."
                  : `Showing ${visibleMatchCount} favorite matches on this date.`
                : `All ${totalMatches} matches loaded for this view.`}
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
  const [selectedDate, setSelectedDate] = useState(() => getScoreboardDateKey());
  const [mode, setMode] = useState<ScoreboardMode>("all");
  const [expandedLeagueKeys, setExpandedLeagueKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoriteLeagueKeys, setFavoriteLeagueKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoriteMatchIds, setFavoriteMatchIds] = useState<Set<number>>(
    () => new Set(),
  );
  const paginationRef = useRef<PaginationState>({
    hasMore: true,
    loading: false,
    nextOffset: 0,
    error: null,
  });
  const retryTimerRef = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
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

  const todayDateKey = useMemo(
    () => getScoreboardDateKey(new Date(nowMs)),
    [nowMs],
  );
  const selectedDateLabel = useMemo(
    () => formatDateLabel(selectedDate),
    [selectedDate],
  );
  const liveOnly = mode === "live";
  const favoritesCount = favoriteLeagueKeys.size + favoriteMatchIds.size;
  const isRealtimeDate = selectedDate === todayDateKey;

  const filters: MatchFilters = useMemo(
    () => ({
      query: "",
      liveOnly,
    }),
    [liveOnly],
  );

  const baseVisibleGroups = useMemo(
    () => buildVisibleGroups(structure, store.getMatch, filters),
    [filters, store, structure],
  );
  const visibleGroups = useMemo(() => {
    if (mode !== "favorites") {
      return baseVisibleGroups;
    }

    return buildFavoriteGroups(
      baseVisibleGroups,
      favoriteLeagueKeys,
      favoriteMatchIds,
    );
  }, [baseVisibleGroups, favoriteLeagueKeys, favoriteMatchIds, mode]);
  const loadedMatchCount = structure.orderedIds.length;
  const visibleMatchCount = useMemo(
    () => countVisibleMatches(visibleGroups),
    [visibleGroups],
  );
  const hasMatchesInStore = loadedMatchCount > 0;
  const emptyState = useMemo(() => {
    if (mode === "favorites") {
      if (favoritesCount === 0) {
        return "No favorite leagues or matches yet. Save items to build this view.";
      }

      return `No favorites land on ${selectedDateLabel}.`;
    }

    if (mode === "live") {
      return `No live matches found for ${selectedDateLabel}.`;
    }

    return `No matches found for ${selectedDateLabel}.`;
  }, [favoritesCount, mode, selectedDateLabel]);

  const handleToggleLeague = useCallback((groupKey: string) => {
    setExpandedLeagueKeys((current) => {
      const next = new Set(current);

      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }

      return next;
    });
  }, []);

  const handleToggleFavoriteLeague = useCallback((groupKey: string) => {
    setFavoriteLeagueKeys((current) => {
      const next = new Set(current);

      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }

      return next;
    });
  }, []);

  const handleToggleFavoriteMatch = useCallback((matchId: number) => {
    setFavoriteMatchIds((current) => {
      const next = new Set(current);

      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }

      return next;
    });
  }, []);

  const handleShowToday = useCallback(() => {
    startTransition(() => {
      setMode("all");
      setSelectedDate(todayDateKey);
    });
  }, [todayDateKey]);

  const handleShowLive = useCallback(() => {
    startTransition(() => {
      setMode("live");
      setSelectedDate(todayDateKey);
    });
  }, [todayDateKey]);

  const handleShowFavorites = useCallback(() => {
    startTransition(() => {
      setMode("favorites");
    });
  }, []);

  const handleSetSelectedDate = useCallback(
    (nextDate: string) => {
      if (!isValidDateKey(nextDate)) {
        return;
      }

      startTransition(() => {
        setSelectedDate(nextDate);

        if (mode === "live") {
          setMode("all");
        }
      });
    },
    [mode],
  );

  const handleShiftDate = useCallback(
    (direction: -1 | 1) => {
      handleSetSelectedDate(offsetDateKey(selectedDate, direction));
    },
    [handleSetSelectedDate, selectedDate],
  );

  const handleOpenDatePicker = useCallback(() => {
    const input = dateInputRef.current;

    if (!input) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }, []);

  const handleDateInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleSetSelectedDate(event.currentTarget.value);
    },
    [handleSetSelectedDate],
  );

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
        date: selectedDate,
        offset,
        limit: pageSize,
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
      clientLogger.warn("Matches page fetch failed", {
        offset,
        reset,
        date: selectedDate,
        liveOnly,
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
    if (!isRealtimeDate) {
      return;
    }

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
    if (!isRealtimeDate) {
      return;
    }

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
    const favorites = loadFavorites();

    setFavoriteLeagueKeys(new Set(favorites.leagueKeys));
    setFavoriteMatchIds(new Set(favorites.matchIds));
  }, []);

  useEffect(() => {
    saveFavorites({
      leagueKeys: [...favoriteLeagueKeys],
      matchIds: [...favoriteMatchIds],
    });
  }, [favoriteLeagueKeys, favoriteMatchIds]);

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
  }, [liveOnly, selectedDate, store]);

  useEffect(() => {
    if (activeMatchId === null) {
      return;
    }

    const selectedGroup = visibleGroups.find((group) =>
      group.matchIds.includes(activeMatchId),
    );

    if (!selectedGroup) {
      return;
    }

    setExpandedLeagueKeys((current) => {
      if (current.has(selectedGroup.key)) {
        return current;
      }

      const next = new Set(current);
      next.add(selectedGroup.key);
      return next;
    });
  }, [activeMatchId, visibleGroups]);

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
  }, [hasMatchesInStore, pagination.hasMore, pagination.loading, visibleGroups.length]);

  useEffect(() => {
    const socket = getSocket();

    if (!isRealtimeDate) {
      socket.disconnect();
      setConnectionStatus("connecting");
      return;
    }

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
  }, [handleDiff, handleSnapshot, isRealtimeDate, store]);

  const lastUpdateMs = new Date(meta.generatedAt).getTime();
  const dataAgeMs = Number.isFinite(lastUpdateMs)
    ? Math.max(0, nowMs - lastUpdateMs)
    : 0;
  const dataDelayed =
    isRealtimeDate &&
    hasMatchesInStore &&
    connectionStatus !== "live" &&
    dataAgeMs >= delayedDataThresholdMs;

  return (
    <main className="page-shell">
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
          <p>Loading matches for {selectedDateLabel}.</p>
          <p className="empty-subtext">
            Pulling only the first screenful now. More matches and logos load as
            you scroll.
          </p>
        </section>
      ) : !hasMatchesInStore && wakeRetry.active ? (
        <section className="empty-card wake-card">
          <span className="wake-pulse" />
          <p>Backend is waking up.</p>
          <p className="empty-subtext">
            ScoreXP is retrying with safe backoff and will hydrate matches for{" "}
            {selectedDateLabel} automatically.
          </p>
          {wakeRetry.lastError ? (
            <p className="empty-subtext">{wakeRetry.lastError}</p>
          ) : null}
        </section>
      ) : (
        <section className="scoreboard-grid">
          <div className="scoreboard-column">
            <ScoreboardNavigation
              mode={mode}
              selectedDate={selectedDate}
              favoriteCount={favoritesCount}
              onShowToday={handleShowToday}
              onShowLive={handleShowLive}
              onShowFavorites={handleShowFavorites}
              onShiftDate={handleShiftDate}
              onOpenDatePicker={handleOpenDatePicker}
              onDateChange={handleDateInputChange}
              dateInputRef={dateInputRef}
            />
            <ProgressiveScoreboardList
              store={store}
              groups={visibleGroups}
              expandedLeagueKeys={expandedLeagueKeys}
              favoriteLeagueKeys={favoriteLeagueKeys}
              favoriteMatchIds={favoriteMatchIds}
              selectedMatchId={activeMatchId}
              loadedMatches={loadedMatchCount}
              visibleMatchCount={visibleMatchCount}
              totalMatches={meta.total}
              pagination={pagination}
              loadMoreRef={loadMoreRef}
              mode={mode}
              emptyState={emptyState}
              onToggleLeague={handleToggleLeague}
              onToggleFavoriteLeague={handleToggleFavoriteLeague}
              onToggleFavoriteMatch={handleToggleFavoriteMatch}
            />
          </div>
          <MatchDrawer store={store} selectedMatchId={activeMatchId} />
        </section>
      )}
    </main>
  );
}
