import { ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
const GOAL_HIGHLIGHT_MS = 3_000;

type GoalHighlightRecord = Record<string, { expiresAt: number; side: GoalHighlightSide }>;
type PinOverrides = Record<string, boolean>;

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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const previousScoresRef = useRef<Map<string, string>>(new Map());
  const [goalHighlights, setGoalHighlights] = useState<GoalHighlightRecord>({});
  const { data, loading, error, reload } = useScoreboard(date, timezone, "all");
  const detailState = useMatchDetail(selectedMatch?.providerId ?? null, timezone);

  const groups = useMemo(() => {
    const source = data?.leagues ?? [];
    return filterGroups(source, {
      view,
      favoritesOnly: tab === "favorites",
      favoriteIds,
      pinnedLeagueOverrides
    });
  }, [data?.leagues, favoriteIds, pinnedLeagueOverrides, tab, view]);

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
  const defaultGroupOpen = view === "live" || tab === "favorites";

  useEffect(() => {
    const updateScrollButton = () => setShowScrollTop(window.scrollY > 120);
    updateScrollButton();
    window.addEventListener("scroll", updateScrollButton, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollButton);
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
    }
  }, [allMatches, selectedMatch]);

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

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("scorexp:favorites", JSON.stringify(Array.from(next)));
      return next;
    });
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
                Saate göre sırala
              </button>
            </nav>

            <div className="datePicker">
              <button className="iconButton" type="button" aria-label="Önceki gün" onClick={() => setDate(shiftDate(date, -1))}>
                <ChevronLeft size={18} />
              </button>
              <button className="dateButton" type="button" onClick={() => setDate(todayInTimezone(timezone))}>
                <CalendarDays size={14} />
                {dateLabel(date, timezone)}
              </button>
              <button className="iconButton" type="button" aria-label="Sonraki gün" onClick={() => setDate(shiftDate(date, 1))}>
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
                Canlı ({counts.live})
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
                    onSelectMatch={setSelectedMatch}
                  />
                );
              })
            )}
          </div>
        </section>
        {selectedMatch ? (
          <MatchDetailPanel
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
  }
) {
  return groups
    .map((group) => {
      const visibleByStatus =
        options.view === "all" ? group.matches : group.matches.filter((match) => match.status.group === options.view);

      const isPinned = isPinnedGroup(group, options.pinnedLeagueOverrides);
      const matches = options.favoritesOnly && !isPinned
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
