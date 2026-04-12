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
import { ChatDrawer } from "@/components/chat-drawer";
import { LeagueFavoriteIcon } from "@/components/favorite-icons";
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
  getDefaultLeagueFavoriteKeys,
  isLiveStatus,
  sortGroupsByFavoritePriority,
  type LeagueGroup,
  type MatchFilters,
} from "@/lib/matches";
import { translateCountryName } from "@/lib/i18n";
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
const realtimeSyncIntervalMs = 12_000;
const realtimeSyncPageSize = 200;

function createLeaguePanelId(groupKey: string): string {
  return `league-panel-${groupKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function countVisibleMatches(groups: readonly LeagueGroup[]): number {
  return groups.reduce((total, group) => total + group.matchIds.length, 0);
}

function buildAutoOpenLeagueKeys(
  groups: readonly LeagueGroup[],
  store: LiveMatchStore,
  activeFavoriteLeagueKeys: ReadonlySet<string>,
  favoriteMatchIds: ReadonlySet<number>,
  activeMatchId: number | null,
): Set<string> {
  const keys = new Set<string>();

  for (const group of groups) {
    const hasLiveMatch = group.matchIds.some((matchId) => {
      const match = store.getMatch(matchId);
      return match ? isLiveStatus(match.statusShort) : false;
    });
    const hasFavoriteMatch = group.matchIds.some((matchId) => favoriteMatchIds.has(matchId));
    const hasSelectedMatch =
      activeMatchId !== null && group.matchIds.includes(activeMatchId);

    if (
      activeFavoriteLeagueKeys.has(group.key) ||
      hasLiveMatch ||
      hasFavoriteMatch ||
      hasSelectedMatch
    ) {
      keys.add(group.key);
    }
  }

  return keys;
}

function formatSeconds(milliseconds: number): string {
  return `${Math.ceil(milliseconds / 1000)} sn`;
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
    <section className="scoreboard-nav" aria-label="Maç gezintisi">
      <div className="scoreboard-nav-modes">
        <button
          type="button"
          className={`scoreboard-nav-button ${
            mode === "all" && isToday ? "is-active" : ""
          }`}
          aria-pressed={mode === "all" && isToday}
          onClick={onShowToday}
        >
          {"Bugün"}
        </button>
        <button
          type="button"
          className={`scoreboard-nav-button ${mode === "live" ? "is-active" : ""}`}
          aria-pressed={mode === "live"}
          onClick={onShowLive}
        >
          {"Canlı"}
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
          aria-label="Önceki gün"
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
          aria-label="Sonraki gün"
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
          <div className="league-primary-line is-compact">
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
              <h2 className="league-title">
                {translateCountryName(group.country, group.countryFlag)}
              </h2>
            </div>
            <span className="league-inline-separator">-</span>
            <span className="league-name-inline">{group.leagueName}</span>
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
          aria-label={
            isFavorite
              ? "Ligi favorilerden çıkar"
              : "Ligi favorilere ekle"
          }
          onClick={() => onToggleFavorite(group.key)}
        >
          <LeagueFavoriteIcon active={isFavorite} />
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
  activeFavoriteLeagueKeys,
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
  activeFavoriteLeagueKeys: ReadonlySet<string>;
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
    <section className="scoreboard-stream" aria-label="Futbol skorları">
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
          isFavorite={activeFavoriteLeagueKeys.has(group.key)}
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
            <span>Daha fazla maç yükleniyor...</span>
          </div>
        ) : pagination.error ? (
          <div className="progressive-loader is-error">
            <span>{pagination.error}</span>
          </div>
        ) : pagination.hasMore ? (
          <div className="progressive-loader">
            <span>
              {mode === "favorites"
                ? `${visibleMatchCount} favori maç görünüyor`
                : `${loadedMatches} maç yüklendi`}
            </span>
            <span>Daha fazlası için kaydırın</span>
          </div>
        ) : (
          <div className="progressive-loader is-complete">
            <span>
              {mode === "favorites"
                ? visibleMatchCount === 0
                  ? "Bu tarihte favori maç yok."
                  : `Bu tarihte ${visibleMatchCount} favori maç gösteriliyor.`
                : `Bu görünümdeki ${totalMatches} maçın tamamı yüklendi.`}
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
  const [collapsedLeagueKeys, setCollapsedLeagueKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [manualFavoriteLeagueKeys, setManualFavoriteLeagueKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [disabledDefaultLeagueKeys, setDisabledDefaultLeagueKeys] = useState<Set<string>>(
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
  const defaultFavoriteLeagueKeys = useMemo(
    () => getDefaultLeagueFavoriteKeys(structure.groups),
    [structure.groups],
  );
  const activeFavoriteLeagueKeys = useMemo(() => {
    const next = new Set(manualFavoriteLeagueKeys);

    for (const groupKey of defaultFavoriteLeagueKeys) {
      if (!disabledDefaultLeagueKeys.has(groupKey)) {
        next.add(groupKey);
      }
    }

    return next;
  }, [
    defaultFavoriteLeagueKeys,
    disabledDefaultLeagueKeys,
    manualFavoriteLeagueKeys,
  ]);
  const visibleGroups = useMemo(() => {
    if (mode === "favorites") {
      return buildFavoriteGroups(baseVisibleGroups, favoriteMatchIds);
    }

    return sortGroupsByFavoritePriority(baseVisibleGroups, activeFavoriteLeagueKeys);
  }, [activeFavoriteLeagueKeys, baseVisibleGroups, favoriteMatchIds, mode]);
  const loadedMatchCount = structure.orderedIds.length;
  const visibleMatchCount = useMemo(
    () => countVisibleMatches(visibleGroups),
    [visibleGroups],
  );
  const hasMatchesInStore = loadedMatchCount > 0;
  const favoritesCount = favoriteMatchIds.size;
  const autoOpenLeagueKeys = useMemo(
    () =>
      buildAutoOpenLeagueKeys(
        visibleGroups,
        store,
        activeFavoriteLeagueKeys,
        favoriteMatchIds,
        activeMatchId,
      ),
    [
      activeFavoriteLeagueKeys,
      activeMatchId,
      favoriteMatchIds,
      store,
      visibleGroups,
    ],
  );
  const effectiveExpandedLeagueKeys = useMemo(() => {
    const next = new Set(expandedLeagueKeys);

    for (const groupKey of autoOpenLeagueKeys) {
      if (!collapsedLeagueKeys.has(groupKey)) {
        next.add(groupKey);
      }
    }

    return next;
  }, [autoOpenLeagueKeys, collapsedLeagueKeys, expandedLeagueKeys]);
  const emptyState = useMemo(() => {
    if (mode === "favorites") {
      if (favoritesCount === 0) {
        return "Henüz favori maç yok. Bu görünümü doldurmak için yıldız ekleyin.";
      }

      return `${selectedDateLabel} tarihinde favori bulunmuyor.`;
    }

    if (mode === "live") {
      return `${selectedDateLabel} tarihinde canlı maç bulunamadı.`;
    }

    return `${selectedDateLabel} tarihinde maç bulunamadı.`;
  }, [favoritesCount, mode, selectedDateLabel]);

  const handleToggleLeague = useCallback(
    (groupKey: string) => {
      const isAutoOpen = autoOpenLeagueKeys.has(groupKey);
      const isOpen = effectiveExpandedLeagueKeys.has(groupKey);

      if (isAutoOpen) {
        setExpandedLeagueKeys((current) => {
          if (!current.has(groupKey)) {
            return current;
          }

          const next = new Set(current);
          next.delete(groupKey);
          return next;
        });

        setCollapsedLeagueKeys((current) => {
          const next = new Set(current);

          if (isOpen) {
            next.add(groupKey);
          } else {
            next.delete(groupKey);
          }

          return next;
        });

        return;
      }

      setExpandedLeagueKeys((current) => {
        const next = new Set(current);

        if (isOpen) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }

        return next;
      });
    },
    [autoOpenLeagueKeys, effectiveExpandedLeagueKeys],
  );

  const handleToggleFavoriteLeague = useCallback(
    (groupKey: string) => {
      if (defaultFavoriteLeagueKeys.has(groupKey)) {
        setDisabledDefaultLeagueKeys((current) => {
          const next = new Set(current);

          if (next.has(groupKey)) {
            next.delete(groupKey);
          } else {
            next.add(groupKey);
          }

          return next;
        });
        setManualFavoriteLeagueKeys((current) => {
          const next = new Set(current);
          next.delete(groupKey);
          return next;
        });
        return;
      }

      setManualFavoriteLeagueKeys((current) => {
        const next = new Set(current);

        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }

        return next;
      });
    },
    [defaultFavoriteLeagueKeys],
  );

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

  const syncRealtimePages = useEffectEvent(async () => {
    if (!isRealtimeDate || paginationRef.current.loading) {
      return;
    }

    const targetCount = Math.max(
      store.getStructureSnapshot().orderedIds.length,
      pageSize,
    );
    const nextMatches: MatchesSnapshotResponse["matches"] = [];
    let offset = 0;
    let generatedAt = new Date().toISOString();
    let total = 0;
    let hasMore = true;

    while (nextMatches.length < targetCount && hasMore) {
      const page = await fetchTodayMatchesPage({
        date: selectedDate,
        offset,
        limit: Math.min(realtimeSyncPageSize, targetCount - nextMatches.length),
        liveOnly,
      });

      if (offset === 0) {
        total = page.total;
      }

      generatedAt = page.generatedAt;
      nextMatches.push(...page.matches);
      hasMore = page.hasMore && page.matches.length > 0;
      offset = page.nextOffset ?? offset + page.matches.length;
    }

    setTransportError(null);
    setWakeRetry((current) => ({
      ...current,
      active: false,
      nextDelayMs: null,
      lastError: null,
    }));

    startTransition(() => {
      store.applySnapshot({
        matches: nextMatches,
        generatedAt,
        total,
      });
    });
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

    setManualFavoriteLeagueKeys(new Set(favorites.leagueKeys));
    setFavoriteMatchIds(new Set(favorites.matchIds));
    setDisabledDefaultLeagueKeys(new Set(favorites.disabledDefaultLeagueKeys));
  }, []);

  useEffect(() => {
    saveFavorites({
      leagueKeys: [...manualFavoriteLeagueKeys],
      matchIds: [...favoriteMatchIds],
      disabledDefaultLeagueKeys: [...disabledDefaultLeagueKeys],
    });
  }, [disabledDefaultLeagueKeys, favoriteMatchIds, manualFavoriteLeagueKeys]);

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
    if (!isRealtimeDate) {
      return;
    }

    const runSync = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void syncRealtimePages();
    };

    const interval = window.setInterval(runSync, realtimeSyncIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncRealtimePages();
      }
    };

    window.addEventListener("online", runSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", runSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isRealtimeDate, liveOnly, selectedDate, loadedMatchCount]);

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
          ? "Sunucu uyanıyor olabilir. Yeniden bağlanma denemeleri kontrollü şekilde sürüyor."
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
  }, [isRealtimeDate, store]);

  const lastUpdateMs = new Date(meta.generatedAt).getTime();
  const dataAgeMs = Number.isFinite(lastUpdateMs)
    ? Math.max(0, nowMs - lastUpdateMs)
    : 0;
  const dataDelayed =
    isRealtimeDate &&
    hasMatchesInStore &&
    connectionStatus !== "live" &&
    dataAgeMs >= delayedDataThresholdMs;

  const leftColumnContent =
    !hasMatchesInStore && pagination.loading ? (
      <section className="empty-card wake-card">
        <span className="wake-pulse" />
        <p>{selectedDateLabel} tarihindeki maçlar yükleniyor.</p>
        <p className="empty-subtext">
          Şimdilik yalnızca ilk ekran yükleniyor. Aşağı indikçe daha fazla maç
          ve logo yüklenecek.
        </p>
      </section>
    ) : !hasMatchesInStore && wakeRetry.active ? (
      <section className="empty-card wake-card">
        <span className="wake-pulse" />
        <p>Sunucu uyanıyor.</p>
        <p className="empty-subtext">
          ScoreXP güvenli aralıklarla yeniden deniyor ve {selectedDateLabel}{" "}
          tarihindeki maçları otomatik olarak yükleyecek.
        </p>
        {wakeRetry.lastError ? (
          <p className="empty-subtext">{wakeRetry.lastError}</p>
        ) : null}
      </section>
    ) : (
      <ProgressiveScoreboardList
        store={store}
        groups={visibleGroups}
        expandedLeagueKeys={effectiveExpandedLeagueKeys}
        activeFavoriteLeagueKeys={activeFavoriteLeagueKeys}
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
    );

  return (
    <main className="page-shell scoreboard-page-shell">
      {transportError ? (
        <section className="banner banner-warning">
          <p>{transportError}</p>
          {wakeRetry.active && wakeRetry.nextDelayMs ? (
            <p className="banner-subtext">
              {wakeRetry.attempt}. yeniden deneme {formatSeconds(wakeRetry.nextDelayMs)} sonra.
            </p>
          ) : null}
        </section>
      ) : null}

      {dataDelayed ? (
        <section className="banner banner-info">
          <p>
            Canlı veri geçici olarak gecikti. Sunucu yeniden bağlanırken
            eldeki son skorlar ekranda tutuluyor.
          </p>
          <p className="banner-subtext">
            Son başarılı güncelleme yaklaşık {formatSeconds(dataAgeMs)} önceydi.
          </p>
        </section>
      ) : null}

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
          {leftColumnContent}
        </div>
        <MatchDrawer store={store} selectedMatchId={activeMatchId} />
        <ChatDrawer store={store} selectedMatchId={activeMatchId} />
      </section>
    </main>
  );
}
