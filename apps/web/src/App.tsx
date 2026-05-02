import { ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiPredictionModal } from "./components/AiPredictionModal";
import { InstallPrompt } from "./components/InstallPrompt";
import { LeagueCard } from "./components/LeagueCard";
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
const notificationIcon = "/icons/icon.svg";

let notificationAudioContext: AudioContext | null = null;

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
type FavoriteNotification = {
  id: string;
  title: string;
  body: string;
  matchId: string;
};

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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const previousScoresRef = useRef<Map<string, string>>(new Map());
  const previousStatusRef = useRef<Map<string, NormalizedMatch["status"]["group"]>>(new Map());
  const favoriteSnapshotsRef = useRef<Map<string, FavoriteMatchSnapshot>>(new Map());
  const notificationCounterRef = useRef(0);
  const hasAutoSelectedInitialMatchRef = useRef(false);
  const [goalHighlights, setGoalHighlights] = useState<GoalHighlightRecord>({});
  const [recentlyFinishedLiveMatches, setRecentlyFinishedLiveMatches] = useState<TimedMatchRecord>({});
  const [favoriteNotifications, setFavoriteNotifications] = useState<FavoriteNotification[]>([]);
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
    if (predictionMatch) {
      const updated = allMatches.find((match) => match.id === predictionMatch.id);
      if (updated && updated !== predictionMatch) {
        setPredictionMatch(updated);
      }
    }
  }, [allMatches, predictionMatch]);

  useEffect(() => {
    if (hasAutoSelectedInitialMatchRef.current || !isDesktopViewport()) return;

    const firstMatch = sortByTime ? sortedMatches[0] : groups[0]?.matches[0];
    if (!firstMatch) return;

    hasAutoSelectedInitialMatchRef.current = true;
    setSelectedMatch(firstMatch);
  }, [groups, sortByTime, sortedMatches]);

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

  useEffect(() => {
    if (favoriteNotifications.length === 0) return;

    const timeout = window.setTimeout(() => {
      const now = Date.now();
      setFavoriteNotifications((current) => current.filter((item) => Number(item.id.split(":")[0]) > now - 5_500));
    }, 1_000);

    return () => window.clearTimeout(timeout);
  }, [favoriteNotifications]);

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
    showBrowserNotification(title, body);

    const id = `${Date.now()}:${notificationCounterRef.current++}`;
    setFavoriteNotifications((current) => [{ id, title, body, matchId }, ...current].slice(0, 4));
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

  return (
    <>
      <SiteHeader footballCount={counts.all} />
      <main className="appShell">
        <section className="scorePanel" aria-label="Canlı skorlar">
          <header className="topNav">
            <nav className="tabs" aria-label="Skor sekmeleri">
              <button className={tab === "all" && !sortByTime ? "active" : ""} type="button" onClick={() => selectTab("all")}>
                Tümü
              </button>
              <button
                className={tab === "favorites" && !sortByTime ? "active" : ""}
                type="button"
                onClick={() => selectTab("favorites")}
              >
                Favoriler
              </button>
              <button className={sortByTime ? "active" : ""} type="button" onClick={toggleSortByTime}>
                Zamana göre sırala
              </button>
            </nav>

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
              <button className={view === "all" ? "chip active" : "chip"} type="button" onClick={() => selectView("all")}>
                Tümü
              </button>
              <button className={view === "live" && !sortByTime ? "chip active liveChip" : "chip liveChip"} type="button" onClick={() => selectView("live")}>
                Canlı ({visibleLiveCount})
              </button>
              <button className={view === "finished" && !sortByTime ? "chip active" : "chip"} type="button" onClick={() => selectView("finished")}>
                Bitti
              </button>
              <button className={view === "upcoming" && !sortByTime ? "chip active" : "chip"} type="button" onClick={() => selectView("upcoming")}>
                Yaklaşan
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
                onSelectMatch={setSelectedMatch}
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
                    onSelectMatch={setSelectedMatch}
                  />
                );
              })
            )}
          </div>
        </section>
        {selectedMatch ? (
          <MatchDetailPanel
            key={selectedMatch.id}
            match={selectedMatch}
            detail={detailState.data}
            loading={detailState.loading}
            refreshing={detailState.refreshing}
            error={detailState.error}
            onClose={() => setSelectedMatch(null)}
            onReload={detailState.reload}
          />
        ) : null}
      </main>

      {predictionMatch ? (
        <AiPredictionModal match={predictionMatch} timezone={timezone} onRequestClose={() => setPredictionMatch(null)} />
      ) : null}

      <InstallPrompt />

      {favoriteNotifications.length > 0 ? (
        <div className="favoriteNotificationStack" aria-live="polite">
          {favoriteNotifications.map((notification) => (
            <div className="favoriteNotificationToast" key={notification.id}>
              <img src="/icons/icon.svg" alt="" />
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showScrollTop ? (
        <button className="scrollTopButton" type="button" onClick={scrollToTop} aria-label="En üste git">
          <ArrowUp size={16} />
          <span>En üste git</span>
        </button>
      ) : null}
    </>
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

function isDesktopViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 981px) and (pointer: fine)").matches;
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

function showBrowserNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(`ScoreXP - ${title}`, {
      body,
      icon: notificationIcon,
      badge: notificationIcon,
      silent: true
    });
    window.setTimeout(() => notification.close(), 6_000);
  } catch {
    // Some mobile browsers only allow service-worker notifications; the in-app toast still covers the event.
  }
}

function primeNotificationSound() {
  const context = getNotificationAudioContext();
  void context?.resume();
}

function playNotificationSound() {
  const context = getNotificationAudioContext();
  if (!context) return;

  const start = context.currentTime;
  const gain = context.createGain();
  const first = context.createOscillator();
  const second = context.createOscillator();

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

  first.type = "sine";
  first.frequency.setValueAtTime(1320, start);
  first.frequency.exponentialRampToValueAtTime(1760, start + 0.11);

  second.type = "triangle";
  second.frequency.setValueAtTime(2640, start + 0.08);
  second.frequency.exponentialRampToValueAtTime(1980, start + 0.28);

  first.connect(gain);
  second.connect(gain);
  gain.connect(context.destination);

  first.start(start);
  first.stop(start + 0.28);
  second.start(start + 0.08);
  second.stop(start + 0.42);
}

function getNotificationAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  notificationAudioContext ??= new AudioContextConstructor();
  return notificationAudioContext;
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
