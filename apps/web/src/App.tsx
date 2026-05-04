import {
  ArrowDownUp,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  ListFilter,
  Radio,
  Search,
  Star
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiPredictionModal } from "./components/AiPredictionModal";
import { InstallPrompt } from "./components/InstallPrompt";
import { LeagueCard } from "./components/LeagueCard";
import { MatchHighlightsFeed } from "./components/MatchHighlightsFeed";
import { MatchAtmosphereOverlay } from "./components/MatchAtmosphereOverlay";
import { MatchChatRoom } from "./components/MatchChatRoom";
import { MatchDetailPanel } from "./components/MatchDetailPanel";
import { SiteHeader } from "./components/SiteHeader";
import { SortedMatchList } from "./components/SortedMatchList";
import { dateLabel, shiftDate, todayInTimezone } from "./lib/date";
import { compareTr, localizeCountryName, normalizeName } from "./lib/localization";
import { useMatchDetail } from "./hooks/useMatchDetail";
import { useScoreboard } from "./hooks/useScoreboard";
import type { GoalHighlightSide, LeagueGroup, NormalizedMatch, ScoreboardView } from "./types";
import "./styles/app.css";

const timezone = "Europe/Istanbul";
const GOAL_HIGHLIGHT_MS = 32_000;
const LIVE_FINISHED_GRACE_MS = 60_000;
const notificationIcon = "/icons/icon-192.png";
const notificationBadge = "/icons/notification-badge.png";
const notificationImage = "/icons/icon-512.png";
const notificationSound = "/audio/notification.mp3";

let notificationAudioElement: HTMLAudioElement | null = null;

type GoalHighlightRecord = Record<string, { expiresAt: number; side: GoalHighlightSide }>;
type TimedMatchRecord = Record<string, number>;
type PinOverrides = Record<string, boolean>;
type FavoriteMatchSnapshot = {
  scoreKey: string;
  redCardsHome: number;
  redCardsAway: number;
  statusGroup: NormalizedMatch["status"]["group"];
  statusDescription: string;
};
type MatchRoute =
  | { kind: "list" }
  | { kind: "detail"; slug: string }
  | { kind: "atmosphere"; slug: string };

const atmosphereRouteSuffix = "-mac-atmosferi";

const defaultPinnedLeagues = [
  { countries: ["turkey", "turkiye", "türkiye"], leagues: ["super lig", "süper lig"] },
  { countries: ["turkey", "turkiye", "türkiye"], leagues: ["1 lig", "1. lig", "tff 1 lig"] },
  { countries: ["england", "ingiltere", "ingiltere"], leagues: ["premier league"] },
  { countries: ["germany", "almanya"], leagues: ["bundesliga"] },
  { countries: ["spain", "ispanya"], leagues: ["la liga", "laliga"] },
  { countries: ["france", "fransa"], leagues: ["ligue 1", "lig 1"] },
  { countries: ["italy", "italya"], leagues: ["serie a"] },
  { countries: ["europe", "avrupa", "world", "dunya"], leagues: ["uefa champions league", "champions league"] },
  { countries: ["europe", "avrupa", "world", "dunya"], leagues: ["uefa europa league", "europa league"] },
  { countries: ["europe", "avrupa", "world", "dunya"], leagues: ["uefa conference league", "conference league"] }
] as const;

export default function App() {
  const [date, setDate] = useState(() => todayInTimezone(timezone));
  const [view, setView] = useState<ScoreboardView>("all");
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [sortByTime, setSortByTime] = useState(false);
  const [groupOpenOverrides, setGroupOpenOverrides] = useState<Record<string, boolean>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavorites());
  const [pinnedLeagueOverrides, setPinnedLeagueOverrides] = useState<PinOverrides>(() => readPinnedLeagueOverrides());
  const [selectedMatch, setSelectedMatch] = useState<NormalizedMatch | null>(null);
  const [predictionMatch, setPredictionMatch] = useState<NormalizedMatch | null>(null);
  const [atmosphereOpen, setAtmosphereOpen] = useState(false);
  const [route, setRoute] = useState<MatchRoute>(() => readRouteFromLocation());
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const desktopLayout = useDesktopLayout();
  const previousScoresRef = useRef<Map<string, string>>(new Map());
  const previousStatusRef = useRef<Map<string, NormalizedMatch["status"]["group"]>>(new Map());
  const favoriteSnapshotsRef = useRef<Map<string, FavoriteMatchSnapshot>>(new Map());
  const hasAutoSelectedInitialMatchRef = useRef(false);
  const [goalHighlights, setGoalHighlights] = useState<GoalHighlightRecord>({});
  const [recentlyFinishedLiveMatches, setRecentlyFinishedLiveMatches] = useState<TimedMatchRecord>({});
  const { data, loading, error, reload } = useScoreboard(date, timezone, "all");
  const detailState = useMatchDetail(selectedMatch?.providerId ?? null, timezone);

  const activeRecentlyFinishedLiveIds = useMemo(() => {
    const now = Date.now();
    return new Set(
      Object.entries(recentlyFinishedLiveMatches)
        .filter(([, expiresAt]) => expiresAt > now)
        .map(([id]) => id)
    );
  }, [recentlyFinishedLiveMatches]);

  const groups = useMemo(() => {
    const source = data?.leagues ?? [];
    return filterGroups(source, {
      view,
      favoritesOnly: tab === "favorites",
      favoriteIds,
      pinnedLeagueOverrides,
      liveGraceIds: activeRecentlyFinishedLiveIds
    });
  }, [activeRecentlyFinishedLiveIds, data?.leagues, favoriteIds, pinnedLeagueOverrides, tab, view]);

  const allMatches = useMemo(() => {
    return (data?.leagues ?? []).flatMap((league) => league.matches);
  }, [data?.leagues]);

  const sortedMatches = useMemo(() => {
    return [...allMatches].sort((a, b) => a.timestamp - b.timestamp || compareTr(a.homeTeam.name, b.homeTeam.name));
  }, [allMatches]);

  const activeGoalHighlights = useMemo(() => {
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(goalHighlights)
        .filter(([, item]) => item.expiresAt > now)
        .map(([id, item]) => [id, item.side])
    ) as Record<string, GoalHighlightSide>;
  }, [goalHighlights]);

  const counts = data?.counts ?? { all: 0, live: 0, finished: 0, upcoming: 0, unknown: 0 };
  const visibleLiveCount = counts.live + activeRecentlyFinishedLiveIds.size;
  const today = todayInTimezone(timezone);
  const minDate = shiftDate(today, -7);
  const maxDate = shiftDate(today, 7);
  const canGoPreviousDay = date > minDate;
  const canGoNextDay = date < maxDate;
  const defaultGroupOpen = view === "live" || tab === "favorites";

  useEffect(() => {
    const updateScrollButton = () => setShowScrollTop(window.scrollY > 120);
    updateScrollButton();
    window.addEventListener("scroll", updateScrollButton, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollButton);
  }, []);

  useEffect(() => {
    const themeColor = "#090d0f";
    document.documentElement.style.backgroundColor = "#0c1113";
    document.body.style.backgroundColor = "#0c1113";

    const metas = [
      document.querySelector('meta[name="theme-color"]'),
      document.querySelector('meta[name="msapplication-navbutton-color"]'),
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ].filter((item): item is HTMLMetaElement => item instanceof HTMLMetaElement);

    for (const meta of metas) {
      meta.setAttribute("content", themeColor);
    }
  }, []);

  useEffect(() => {
    if (!allMatches.length) return;

    const now = Date.now();
    const previousScores = previousScoresRef.current;
    const nextScores = new Map<string, string>();
    const nextHighlights: GoalHighlightRecord = {};

    for (const match of allMatches) {
      const scoreKey = scoreSnapshot(match);
      const previous = previousScores.get(match.id);
      const side = previous ? scoreIncreaseSide(previous, scoreKey) : null;
      if (side && match.status.group === "live") {
        nextHighlights[match.id] = {
          expiresAt: now + GOAL_HIGHLIGHT_MS,
          side
        };
      }
      nextScores.set(match.id, scoreKey);
    }

    previousScoresRef.current = nextScores;

    if (Object.keys(nextHighlights).length > 0) {
      setGoalHighlights((current) => ({ ...current, ...nextHighlights }));
    }
  }, [allMatches]);

  useEffect(() => {
    if (!selectedMatch) return;
    const updated = allMatches.find((match) => match.id === selectedMatch.id);
    if (updated && updated !== selectedMatch) {
      setSelectedMatch(updated);
    } else if (!updated && allMatches.length > 0) {
      setSelectedMatch(null);
    }
  }, [allMatches, selectedMatch]);

  useEffect(() => {
    if (!selectedMatch) setAtmosphereOpen(false);
  }, [selectedMatch]);

  useEffect(() => {
    const isRoutePage = route.kind !== "list";
    document.documentElement.classList.toggle("scorexpRoutePage", isRoutePage);
    document.body.classList.toggle("scorexpRoutePage", isRoutePage);

    return () => {
      document.documentElement.classList.remove("scorexpRoutePage");
      document.body.classList.remove("scorexpRoutePage");
    };
  }, [route.kind]);

  useEffect(() => {
    const syncRoute = () => {
      setRoute(readRouteFromLocation());
    };

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    if (route.kind === "list") {
      setAtmosphereOpen(false);
      if (!desktopLayout) setSelectedMatch(null);
      return;
    }

    if (!allMatches.length) return;

    const routeMatch = findMatchByRouteSlug(allMatches, route.slug);
    if (!routeMatch) {
      const nextRoute: MatchRoute = { kind: "list" };
      setSelectedMatch(null);
      setAtmosphereOpen(false);
      setRoute(nextRoute);
      writeRouteToHistory(nextRoute, "replace");
      return;
    }

    setSelectedMatch(routeMatch);
    setAtmosphereOpen(route.kind === "atmosphere");
  }, [allMatches, desktopLayout, route]);

  useEffect(() => {
    if (predictionMatch) {
      const updated = allMatches.find((match) => match.id === predictionMatch.id);
      if (updated && updated !== predictionMatch) {
        setPredictionMatch(updated);
      }
    }
  }, [allMatches, predictionMatch]);

  useEffect(() => {
    if (hasAutoSelectedInitialMatchRef.current || route.kind !== "list" || !desktopLayout) return;

    const firstMatch = sortByTime ? sortedMatches[0] : groups[0]?.matches[0];
    if (!firstMatch) return;

    hasAutoSelectedInitialMatchRef.current = true;
    setSelectedMatch(firstMatch);
  }, [desktopLayout, groups, route.kind, sortByTime, sortedMatches]);

  useEffect(() => {
    const hasHighlights = Object.keys(goalHighlights).length > 0;
    if (!hasHighlights) return;

    const timeout = window.setTimeout(() => {
      const now = Date.now();
      setGoalHighlights((current) =>
        Object.fromEntries(Object.entries(current).filter(([, item]) => item.expiresAt > now))
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [goalHighlights]);

  useEffect(() => {
    if (!allMatches.length) return;

    const now = Date.now();
    const nextStatuses = new Map<string, NormalizedMatch["status"]["group"]>();
    const nextGrace: TimedMatchRecord = {};

    for (const match of allMatches) {
      const previousStatus = previousStatusRef.current.get(match.id);
      if (previousStatus === "live" && match.status.group === "finished") {
        nextGrace[match.id] = now + LIVE_FINISHED_GRACE_MS;
      }
      nextStatuses.set(match.id, match.status.group);
    }

    previousStatusRef.current = nextStatuses;

    if (Object.keys(nextGrace).length > 0) {
      setRecentlyFinishedLiveMatches((current) => ({ ...current, ...nextGrace }));
    }
  }, [allMatches]);

  useEffect(() => {
    if (Object.keys(recentlyFinishedLiveMatches).length === 0) return;

    const timeout = window.setTimeout(() => {
      const now = Date.now();
      setRecentlyFinishedLiveMatches((current) =>
        Object.fromEntries(Object.entries(current).filter(([, expiresAt]) => expiresAt > now))
      );
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [recentlyFinishedLiveMatches]);

  useEffect(() => {
    if (!allMatches.length) return;

    const previousSnapshots = favoriteSnapshotsRef.current;
    const nextSnapshots = new Map<string, FavoriteMatchSnapshot>();

    for (const match of allMatches) {
      if (!favoriteIds.has(match.id)) continue;

      const nextSnapshot = favoriteSnapshot(match);
      const previousSnapshot = previousSnapshots.get(match.id);

      if (previousSnapshot) {
        const events = favoriteMatchEvents(previousSnapshot, nextSnapshot, match);
        for (const event of events) {
          emitFavoriteNotification(event.title, event.body, match.id);
        }
      }

      nextSnapshots.set(match.id, nextSnapshot);
    }

    favoriteSnapshotsRef.current = nextSnapshots;
  }, [allMatches, favoriteIds]);

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        requestNotificationPermission();
        primeNotificationSound();
      }
      localStorage.setItem("scorexp:favorites", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const emitFavoriteNotification = (title: string, body: string, matchId: string) => {
    playNotificationSound();
    void showSystemNotification(title, body, matchId);
  };

  const togglePinnedLeague = (group: LeagueGroup) => {
    setPinnedLeagueOverrides((current) => {
      const isPinned = isPinnedGroup(group, current);
      const defaultPinned = isDefaultPinnedLeague(group);
      const nextValue = !isPinned;
      const next = { ...current };

      if (nextValue === defaultPinned) delete next[group.key];
      else next[group.key] = nextValue;

      localStorage.setItem("scorexp:pinnedLeagueOverrides", JSON.stringify(next));
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setGroupOpenOverrides((current) => {
      const group = groups.find((item) => item.key === key);
      const groupDefaultOpen = group ? defaultGroupOpen || isPinnedGroup(group, pinnedLeagueOverrides) : defaultGroupOpen;
      const isOpen = current[key] ?? groupDefaultOpen;
      return { ...current, [key]: !isOpen };
    });
  };

  const selectTab = (nextTab: "all" | "favorites") => {
    setTab(nextTab);
    setSortByTime(false);
    setGroupOpenOverrides({});
  };

  const selectView = (nextView: ScoreboardView) => {
    setView(nextView);
    setSortByTime(false);
    setGroupOpenOverrides({});
  };

  const toggleSortByTime = () => {
    setTab("all");
    setView("all");
    setGroupOpenOverrides({});
    setSortByTime((current) => !current);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToDate = (nextDate: string) => {
    setDate(clampDate(nextDate, minDate, maxDate));
  };

  const openMatchDetail = (match: NormalizedMatch) => {
    const nextRoute: MatchRoute = { kind: "detail", slug: matchRouteSlug(match) };
    setSelectedMatch(match);
    setAtmosphereOpen(false);
    setRoute(nextRoute);
    writeRouteToHistory(nextRoute, "push");
    scrollToDocumentTop();
  };

  const closeMatchDetail = () => {
    const nextRoute: MatchRoute = { kind: "list" };
    setSelectedMatch(null);
    setAtmosphereOpen(false);
    setRoute(nextRoute);
    writeRouteToHistory(nextRoute, "replace");
  };

  const openAtmosphere = () => {
    if (!selectedMatch) return;

    const nextRoute: MatchRoute = { kind: "atmosphere", slug: matchRouteSlug(selectedMatch) };
    setAtmosphereOpen(true);
    setRoute(nextRoute);
    writeRouteToHistory(nextRoute, "push");
    scrollToDocumentTop();
  };

  const closeAtmosphere = () => {
    const nextRoute: MatchRoute = selectedMatch ? { kind: "detail", slug: matchRouteSlug(selectedMatch) } : { kind: "list" };
    setAtmosphereOpen(false);
    setRoute(nextRoute);
    writeRouteToHistory(nextRoute, "replace");
  };

  const shouldRenderDetailPanel = Boolean(selectedMatch && (route.kind !== "list" || desktopLayout));
  const shouldRenderDesktopChat = Boolean(selectedMatch && desktopLayout && shouldRenderDetailPanel);
  const rootClassName = [
    "appRoot",
    route.kind !== "list" ? "routeMatchPage" : "",
    route.kind === "detail" ? "routeDetailPage" : "",
    route.kind === "atmosphere" ? "routeAtmospherePage" : "",
    shouldRenderDesktopChat ? "chatPanelVisible" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <SiteHeader footballCount={counts.all} onOpenHighlights={() => setHighlightsOpen(true)} />
      <main className="appShell">
        <section className="scorePanel" aria-label="Canlı skorlar">
          <header className="topNav dateOnly">
            <div className="datePicker">
              <button className="iconButton" type="button" aria-label="Önceki gün" disabled={!canGoPreviousDay} onClick={() => goToDate(shiftDate(date, -1))}>
                <ChevronLeft size={18} />
              </button>
              <button className="dateButton" type="button" onClick={() => goToDate(todayInTimezone(timezone))}>
                <CalendarDays size={14} />
                {dateLabel(date, timezone)}
              </button>
              <button className="iconButton" type="button" aria-label="Sonraki gün" disabled={!canGoNextDay} onClick={() => goToDate(shiftDate(date, 1))}>
                <ChevronRight size={18} />
              </button>
            </div>
          </header>

          <div className="filters">
            <div className="chipRow">
              <button
                className={view === "all" && tab === "all" && !sortByTime ? "chip active" : "chip"}
                type="button"
                onClick={() => {
                  selectTab("all");
                  selectView("all");
                }}
              >
                <ListFilter size={15} />
                <span>Tümü</span>
              </button>
              <button
                className={view === "live" && tab === "all" && !sortByTime ? "chip active liveChip" : "chip liveChip"}
                type="button"
                onClick={() => {
                  selectTab("all");
                  selectView("live");
                }}
              >
                <Radio size={15} />
                <span>Canlı</span>
                <strong>{visibleLiveCount}</strong>
              </button>
              <button
                className={tab === "favorites" && !sortByTime ? "chip active favoriteNavChip" : "chip favoriteNavChip"}
                type="button"
                onClick={() => {
                  selectView("all");
                  selectTab("favorites");
                }}
              >
                <Star size={15} />
                <span>Favoriler</span>
              </button>
              <button
                className={view === "finished" && tab === "all" && !sortByTime ? "chip active" : "chip"}
                type="button"
                onClick={() => {
                  selectTab("all");
                  selectView("finished");
                }}
              >
                <CircleCheck size={15} />
                <span>Bitti</span>
              </button>
              <button
                className={view === "upcoming" && tab === "all" && !sortByTime ? "chip active" : "chip"}
                type="button"
                onClick={() => {
                  selectTab("all");
                  selectView("upcoming");
                }}
              >
                <Clock3 size={15} />
                <span>Yaklaşan</span>
              </button>
              <button
                className={sortByTime ? "chip active sortNavChip" : "chip sortNavChip"}
                type="button"
                onClick={toggleSortByTime}
              >
                <ArrowDownUp size={15} />
                <span>Sırala</span>
              </button>
            </div>
          </div>

          <div className="leagueStack">
            {loading && !data ? <LoadingRows /> : null}
            {!loading && !sortByTime && groups.length === 0 ? <EmptyState tab={tab} hasError={Boolean(error && !data)} onReload={reload} /> : null}
            {!loading && sortByTime && sortedMatches.length === 0 ? <EmptyState tab={tab} hasError={Boolean(error && !data)} onReload={reload} /> : null}
            {sortByTime ? (
              <SortedMatchList
                matches={sortedMatches}
                selectedMatchId={selectedMatch?.id ?? null}
                favoriteIds={favoriteIds}
                goalHighlights={activeGoalHighlights}
                onToggleFavorite={toggleFavorite}
                onOpenPrediction={setPredictionMatch}
                onSelectMatch={openMatchDetail}
              />
            ) : (
              groups.map((group) => {
                const pinned = isPinnedGroup(group, pinnedLeagueOverrides);
                const groupDefaultOpen = defaultGroupOpen || pinned;

                return (
                  <LeagueCard
                    key={group.key}
                    group={group}
                    collapsed={!(groupOpenOverrides[group.key] ?? groupDefaultOpen)}
                    pinned={pinned}
                    showMatchCount={view !== "live"}
                    selectedMatchId={selectedMatch?.id ?? null}
                    favoriteIds={favoriteIds}
                    goalHighlights={activeGoalHighlights}
                    onToggle={toggleGroup}
                    onTogglePinned={togglePinnedLeague}
                    onToggleFavorite={toggleFavorite}
                    onOpenPrediction={setPredictionMatch}
                    onSelectMatch={openMatchDetail}
                  />
                );
              })
            )}
          </div>
        </section>
        {shouldRenderDetailPanel && selectedMatch ? (
          <MatchDetailPanel
            key={selectedMatch.id}
            match={selectedMatch}
            detail={detailState.data}
            loading={detailState.loading}
            refreshing={detailState.refreshing}
            error={detailState.error}
            onClose={closeMatchDetail}
            onReload={detailState.reload}
            onOpenAtmosphere={openAtmosphere}
            chatSlot={!desktopLayout ? <MatchChatRoom match={selectedMatch} variant="embedded" /> : undefined}
          />
        ) : null}
        {shouldRenderDesktopChat && selectedMatch ? (
          <MatchChatRoom key={`chat:${selectedMatch.id}`} match={selectedMatch} />
        ) : null}
      </main>

      {atmosphereOpen && selectedMatch ? (
        <MatchAtmosphereOverlay
          match={selectedMatch}
          detail={detailState.data}
          loading={detailState.loading}
          refreshing={detailState.refreshing}
          error={detailState.error}
          onRequestClose={closeAtmosphere}
          backLabel="Maç detayı"
          onReload={detailState.reload}
        />
      ) : null}

      {predictionMatch ? (
        <AiPredictionModal match={predictionMatch} timezone={timezone} onRequestClose={() => setPredictionMatch(null)} />
      ) : null}

      {highlightsOpen ? (
        <MatchHighlightsFeed date={date} timezone={timezone} onRequestClose={() => setHighlightsOpen(false)} />
      ) : null}

      <InstallPrompt />

      {showScrollTop ? (
        <button className="scrollTopButton" type="button" onClick={scrollToTop} aria-label="En üste git">
          <ArrowUp size={16} />
          <span>En üste git</span>
        </button>
      ) : null}
    </div>
  );
}

function filterGroups(
  groups: LeagueGroup[],
  options: {
    view: ScoreboardView;
    favoritesOnly: boolean;
    favoriteIds: Set<string>;
    pinnedLeagueOverrides: PinOverrides;
    liveGraceIds: Set<string>;
  }
) {
  return groups
    .map((group) => {
      const visibleByStatus =
        options.view === "all"
          ? group.matches
          : group.matches.filter((match) => match.status.group === options.view || (options.view === "live" && options.liveGraceIds.has(match.id)));

      const matches = options.favoritesOnly
        ? visibleByStatus.filter((match) => options.favoriteIds.has(match.id))
        : visibleByStatus;

      return { ...group, matches };
    })
    .filter((group) => group.matches.length > 0)
    .sort((a, b) => compareLeagueGroups(a, b, options.pinnedLeagueOverrides));
}

function readFavorites() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("scorexp:favorites") ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function readRouteFromLocation(): MatchRoute {
  if (typeof window === "undefined") return { kind: "list" };

  const url = new URL(window.location.href);
  const legacyAtmosphereId = url.searchParams.get("atmosphere");
  if (legacyAtmosphereId) return { kind: "atmosphere", slug: slugifyPathSegment(legacyAtmosphereId) };

  const path = slugifyPathSegment(decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, "")));
  if (!path) return { kind: "list" };
  if (path.endsWith(atmosphereRouteSuffix)) {
    return { kind: "atmosphere", slug: path.slice(0, -atmosphereRouteSuffix.length) };
  }

  return { kind: "detail", slug: path };
}

function writeRouteToHistory(route: MatchRoute, mode: "push" | "replace") {
  if (typeof window === "undefined") return;

  const nextUrl = routeToPath(route);
  if (nextUrl === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;

  const method = mode === "push" ? "pushState" : "replaceState";
  window.history[method]({ scorexpRoute: route }, "", nextUrl);
}

function routeToPath(route: MatchRoute) {
  if (route.kind === "list") return "/";
  if (route.kind === "atmosphere") return `/${route.slug}${atmosphereRouteSuffix}`;
  return `/${route.slug}`;
}

function matchRouteSlug(match: NormalizedMatch) {
  return `${slugifyPathSegment(match.homeTeam.name)}-${slugifyPathSegment(match.awayTeam.name)}`;
}

function findMatchByRouteSlug(matches: NormalizedMatch[], slug: string) {
  const normalizedSlug = slugifyPathSegment(slug);
  return (
    matches.find((match) => matchRouteSlug(match) === normalizedSlug) ??
    matches.find((match) => slugifyPathSegment(match.providerId) === normalizedSlug || slugifyPathSegment(match.id) === normalizedSlug) ??
    null
  );
}

function slugifyPathSegment(value: string) {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scrollToDocumentTop() {
  window.scrollTo({ top: 0, behavior: "auto" });
}

function readPinnedLeagueOverrides(): PinOverrides {
  try {
    const current = JSON.parse(localStorage.getItem("scorexp:pinnedLeagueOverrides") ?? "null") as unknown;
    if (current && typeof current === "object" && !Array.isArray(current)) {
      return current as PinOverrides;
    }

    const legacy = JSON.parse(localStorage.getItem("scorexp:pinnedLeagues") ?? "[]") as unknown;
    if (Array.isArray(legacy)) {
      return Object.fromEntries(legacy.filter((item): item is string => typeof item === "string").map((key) => [key, true]));
    }
  } catch {
    return {};
  }

  return {};
}

function LoadingRows() {
  return (
    <div className="loadingBlock">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="skeletonRow" key={index} />
      ))}
    </div>
  );
}

function compareLeagueGroups(a: LeagueGroup, b: LeagueGroup, overrides: PinOverrides) {
  const aPinned = isPinnedGroup(a, overrides);
  const bPinned = isPinnedGroup(b, overrides);
  if (aPinned !== bPinned) return aPinned ? -1 : 1;

  if (aPinned && bPinned) {
    const aPriority = defaultPinnedIndex(a);
    const bPriority = defaultPinnedIndex(b);
    if (aPriority !== bPriority) return aPriority - bPriority;
  }

  const countryDiff = compareTr(localizeCountryName(a.country.name), localizeCountryName(b.country.name));
  if (countryDiff !== 0) return countryDiff;
  return compareTr(a.league.name, b.league.name);
}

function isPinnedGroup(group: LeagueGroup, overrides: PinOverrides) {
  return overrides[group.key] ?? isDefaultPinnedLeague(group);
}

function isDefaultPinnedLeague(group: LeagueGroup) {
  return defaultPinnedIndex(group) !== Number.POSITIVE_INFINITY;
}

function defaultPinnedIndex(group: LeagueGroup) {
  const countryTokens = [group.country.name, localizeCountryName(group.country.name), group.country.code].map(normalizeName);
  const league = normalizeName(group.league.name);

  const index = defaultPinnedLeagues.findIndex((item) => {
    const hasCountry = item.countries.some((country) => countryTokens.includes(normalizeName(country)));
    const hasLeague = item.leagues.some((candidate) => leagueNameMatches(league, normalizeName(candidate)));
    return hasCountry && hasLeague;
  });

  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function leagueNameMatches(league: string, candidate: string) {
  if (["serie a", "bundesliga", "ligue 1", "lig 1", "super lig", "super lig", "1 lig", "1 lig"].includes(candidate)) {
    return league === candidate;
  }

  return league === candidate || league.includes(candidate);
}

function scoreSnapshot(match: NormalizedMatch) {
  return `${match.score.home ?? ""}:${match.score.away ?? ""}`;
}

function scoreIncreaseSide(previous: string, current: string): GoalHighlightSide | null {
  const [previousHome, previousAway] = previous.split(":").map(toScoreNumber);
  const [currentHome, currentAway] = current.split(":").map(toScoreNumber);
  const homeIncreased = currentHome > previousHome;
  const awayIncreased = currentAway > previousAway;

  if (homeIncreased && awayIncreased) return "both";
  if (homeIncreased) return "home";
  if (awayIncreased) return "away";
  return null;
}

function toScoreNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function useDesktopLayout() {
  const [desktop, setDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 981px)").matches;
  });

  useEffect(() => {
    const query = window.matchMedia("(min-width: 981px)");
    const update = () => setDesktop(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return desktop;
}

function clampDate(date: string, minDate: string, maxDate: string) {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
}

function favoriteSnapshot(match: NormalizedMatch): FavoriteMatchSnapshot {
  return {
    scoreKey: scoreSnapshot(match),
    redCardsHome: match.redCards?.home ?? 0,
    redCardsAway: match.redCards?.away ?? 0,
    statusGroup: match.status.group,
    statusDescription: match.status.description
  };
}

function favoriteMatchEvents(previous: FavoriteMatchSnapshot, current: FavoriteMatchSnapshot, match: NormalizedMatch) {
  const events: { title: string; body: string }[] = [];
  const scoreSide = scoreIncreaseSide(previous.scoreKey, current.scoreKey);

  for (const side of expandSides(scoreSide)) {
    const team = side === "home" ? match.homeTeam.name : match.awayTeam.name;
    events.push({
      title: "Gol",
      body: `${team} gol attı. Skor: ${formatNotificationScore(match)}`
    });
  }

  if (current.redCardsHome > previous.redCardsHome) {
    events.push({
      title: "Kırmızı kart",
      body: `${match.homeTeam.name} kırmızı kart gördü.`
    });
  }

  if (current.redCardsAway > previous.redCardsAway) {
    events.push({
      title: "Kırmızı kart",
      body: `${match.awayTeam.name} kırmızı kart gördü.`
    });
  }

  const previousDescription = previous.statusDescription.toLowerCase();
  const currentDescription = current.statusDescription.toLowerCase();

  if (currentDescription === "half time" && previousDescription !== "half time") {
    events.push({
      title: "Devre",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} maçında ilk yarı sona erdi.`
    });
  }

  if (currentDescription === "second half" && previousDescription !== "second half") {
    events.push({
      title: "İkinci yarı başladı",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} maçında ikinci yarı başladı.`
    });
  }

  if (current.statusGroup === "finished" && previous.statusGroup !== "finished") {
    events.push({
      title: "Maç bitti",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} bitti. Skor: ${formatNotificationScore(match)}`
    });
  }

  return events;
}

function expandSides(side: GoalHighlightSide | null) {
  if (side === "both") return ["home", "away"] as const;
  if (side === "home" || side === "away") return [side] as const;
  return [];
}

function formatNotificationScore(match: NormalizedMatch) {
  if (match.score.home === null || match.score.away === null) return "-";
  return `${match.score.home}-${match.score.away}`;
}

function requestNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  void Notification.requestPermission();
}

async function showSystemNotification(title: string, body: string, matchId: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  try {
    const options: NotificationOptions & {
      image?: string;
      renotify?: boolean;
      requireInteraction?: boolean;
      timestamp?: number;
      vibrate?: number[];
    } = {
      body,
      icon: notificationIcon,
      badge: notificationBadge,
      image: notificationImage,
      data: { matchId, url: "/" },
      tag: `scorexp:${matchId}:${Date.now()}`,
      renotify: true,
      requireInteraction: false,
      timestamp: Date.now(),
      vibrate: [80, 40, 80],
      silent: false
    };

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(`ScoreXP - ${title}`, options);
      return;
    }

    const notification = new Notification(`ScoreXP - ${title}`, options);
    window.setTimeout(() => notification.close(), 6_000);
  } catch {
    // Browser notification support varies by mobile browser; permission + service worker covers supported paths.
  }
}

function primeNotificationSound() {
  const audio = getNotificationAudioElement();
  if (!audio) return;

  audio.muted = true;
  audio.currentTime = 0;
  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    })
    .catch(() => {
      audio.muted = false;
    });
}

function playNotificationSound() {
  const audio = getNotificationAudioElement();
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  audio.muted = false;
  audio.volume = 1;
  void audio.play().catch(() => undefined);
}

function getNotificationAudioElement() {
  if (typeof window === "undefined") return null;

  notificationAudioElement ??= new Audio(notificationSound);
  notificationAudioElement.preload = "auto";
  notificationAudioElement.volume = 1;
  return notificationAudioElement;
}

function EmptyState({ tab, hasError, onReload }: { tab: string; hasError: boolean; onReload: () => void }) {
  return (
    <div className="emptyState">
      <Search size={22} />
      <strong>{hasError ? "Skorlar yüklenemedi" : tab === "favorites" ? "Favori maç yok" : "Maç bulunamadı"}</strong>
      <button type="button" onClick={onReload}>
        Yenile
      </button>
    </div>
  );
}
