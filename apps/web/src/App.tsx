import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LeagueCard } from "./components/LeagueCard";
import { SiteHeader } from "./components/SiteHeader";
import { SortedMatchList } from "./components/SortedMatchList";
import { dateLabel, shiftDate, todayInTimezone } from "./lib/date";
import { useScoreboard } from "./hooks/useScoreboard";
import type { LeagueGroup, NormalizedMatch, ScoreboardView } from "./types";
import "./styles/app.css";

const timezone = "Europe/Istanbul";

export default function App() {
  const [date, setDate] = useState(() => todayInTimezone(timezone));
  const [view, setView] = useState<ScoreboardView>("all");
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [sortByTime, setSortByTime] = useState(false);
  const [groupOpenOverrides, setGroupOpenOverrides] = useState<Record<string, boolean>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavorites());
  const previousScoresRef = useRef<Map<string, string>>(new Map());
  const [goalHighlights, setGoalHighlights] = useState<Record<string, number>>({});
  const { data, loading, error, reload } = useScoreboard(date, timezone, "all");

  const groups = useMemo(() => {
    const source = data?.leagues ?? [];
    return filterGroups(source, {
      view,
      favoritesOnly: tab === "favorites",
      favoriteIds
    });
  }, [data?.leagues, favoriteIds, tab, view]);

  const allMatches = useMemo(() => {
    return (data?.leagues ?? []).flatMap((league) => league.matches);
  }, [data?.leagues]);

  const sortedMatches = useMemo(() => {
    return [...allMatches].sort((a, b) => a.timestamp - b.timestamp || a.homeTeam.name.localeCompare(b.homeTeam.name));
  }, [allMatches]);

  const highlightedIds = useMemo(() => {
    const now = Date.now();
    return new Set(Object.entries(goalHighlights).filter(([, expiresAt]) => expiresAt > now).map(([id]) => id));
  }, [goalHighlights]);

  const counts = data?.counts ?? { all: 0, live: 0, finished: 0, upcoming: 0, unknown: 0 };
  const defaultGroupOpen = view === "live" || tab === "favorites";

  useEffect(() => {
    if (!allMatches.length) return;

    const now = Date.now();
    const previousScores = previousScoresRef.current;
    const nextScores = new Map<string, string>();
    const nextHighlights: Record<string, number> = {};

    for (const match of allMatches) {
      const scoreKey = scoreSnapshot(match);
      const previous = previousScores.get(match.id);
      if (previous && didScoreIncrease(previous, scoreKey)) {
        nextHighlights[match.id] = now + 33_000;
      }
      nextScores.set(match.id, scoreKey);
    }

    previousScoresRef.current = nextScores;

    if (Object.keys(nextHighlights).length > 0) {
      setGoalHighlights((current) => ({ ...current, ...nextHighlights }));
    }
  }, [allMatches]);

  useEffect(() => {
    const hasHighlights = Object.keys(goalHighlights).length > 0;
    if (!hasHighlights) return;

    const timeout = window.setTimeout(() => {
      const now = Date.now();
      setGoalHighlights((current) =>
        Object.fromEntries(Object.entries(current).filter(([, expiresAt]) => expiresAt > now))
      );
    }, 1_000);

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

  const toggleGroup = (key: string) => {
    setGroupOpenOverrides((current) => {
      const isOpen = current[key] ?? defaultGroupOpen;
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

  return (
    <>
      <SiteHeader />
      <main className="appShell">
        <section className="scorePanel" aria-label="Canli skorlar">
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
              Saate Göre Sırala
            </button>
          </nav>

          <div className="datePicker">
            <button className="iconButton" type="button" aria-label="Onceki gun" onClick={() => setDate(shiftDate(date, -1))}>
              <ChevronLeft size={18} />
            </button>
            <button className="dateButton" type="button" onClick={() => setDate(todayInTimezone(timezone))}>
              <CalendarDays size={14} />
              {dateLabel(date, timezone)}
            </button>
            <button className="iconButton" type="button" aria-label="Sonraki gun" onClick={() => setDate(shiftDate(date, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        <div className="filters">
          <div className="chipRow">
            <button className={view === "live" && !sortByTime ? "chip active liveChip" : "chip liveChip"} type="button" onClick={() => selectView("live")}>
              Canlı ({counts.live})
            </button>
            <button className={view === "finished" && !sortByTime ? "chip active" : "chip"} type="button" onClick={() => selectView("finished")}>
              Bitti
            </button>
            <button className={view === "upcoming" && !sortByTime ? "chip active" : "chip"} type="button" onClick={() => selectView("upcoming")}>
              Yaklaşan
            </button>
            <button className={view === "all" ? "chip active" : "chip"} type="button" onClick={() => selectView("all")}>
              Tümü
            </button>
          </div>
        </div>

        {error ? <div className="errorBanner">{error}</div> : null}

        <div className="leagueStack">
          {loading && !data ? <LoadingRows /> : null}
          {!loading && !sortByTime && groups.length === 0 ? <EmptyState tab={tab} onReload={reload} /> : null}
          {!loading && sortByTime && sortedMatches.length === 0 ? <EmptyState tab={tab} onReload={reload} /> : null}
          {sortByTime ? (
            <SortedMatchList
              matches={sortedMatches}
              favoriteIds={favoriteIds}
              highlightedIds={highlightedIds}
              onToggleFavorite={toggleFavorite}
            />
          ) : (
            groups.map((group) => (
              <LeagueCard
                key={group.key}
                group={group}
                collapsed={!(groupOpenOverrides[group.key] ?? defaultGroupOpen)}
                favoriteIds={favoriteIds}
                highlightedIds={highlightedIds}
                onToggle={toggleGroup}
                onToggleFavorite={toggleFavorite}
              />
            ))
          )}
        </div>
        </section>
      </main>
    </>
  );
}

function filterGroups(
  groups: LeagueGroup[],
  options: { view: ScoreboardView; favoritesOnly: boolean; favoriteIds: Set<string> }
) {
  return groups
    .map((group) => {
      const visibleByStatus =
        options.view === "all" ? group.matches : group.matches.filter((match) => match.status.group === options.view);

      const matches = options.favoritesOnly
        ? visibleByStatus.filter((match) => options.favoriteIds.has(match.id))
        : visibleByStatus;

      return { ...group, matches };
    })
    .filter((group) => group.matches.length > 0);
}

function readFavorites() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("scorexp:favorites") ?? "[]"));
  } catch {
    return new Set<string>();
  }
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

function scoreSnapshot(match: NormalizedMatch) {
  return `${match.score.home ?? ""}:${match.score.away ?? ""}`;
}

function didScoreIncrease(previous: string, current: string) {
  const [previousHome, previousAway] = previous.split(":").map(toScoreNumber);
  const [currentHome, currentAway] = current.split(":").map(toScoreNumber);
  return currentHome > previousHome || currentAway > previousAway;
}

function toScoreNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function EmptyState({ tab, onReload }: { tab: string; onReload: () => void }) {
  return (
    <div className="emptyState">
      <Search size={22} />
      <strong>{tab === "favorites" ? "Favori maç yok" : "Maç bulunamadı"}</strong>
      <button type="button" onClick={onReload}>
        Yenile
      </button>
    </div>
  );
}
