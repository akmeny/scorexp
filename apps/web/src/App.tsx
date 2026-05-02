import { Activity, CalendarDays, ChevronLeft, ChevronRight, RotateCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LeagueCard } from "./components/LeagueCard";
import { dateLabel, shiftDate, todayInTimezone } from "./lib/date";
import { useScoreboard } from "./hooks/useScoreboard";
import type { LeagueGroup, ScoreboardView } from "./types";
import "./styles/app.css";

const timezone = "Europe/Istanbul";

export default function App() {
  const [date, setDate] = useState(() => todayInTimezone(timezone));
  const [view, setView] = useState<ScoreboardView>("all");
  const [tab, setTab] = useState<"all" | "favorites" | "matches">("all");
  const [showOdds, setShowOdds] = useState(false);
  const [showLowerLeagues, setShowLowerLeagues] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavorites());
  const { data, loading, refreshing, error, reload } = useScoreboard(date, timezone, view);

  const groups = useMemo(() => {
    const source = data?.leagues ?? [];
    return filterGroups(source, {
      favoritesOnly: tab === "favorites",
      favoriteIds,
      showLowerLeagues
    });
  }, [data?.leagues, favoriteIds, showLowerLeagues, tab]);

  const counts = data?.counts ?? { all: 0, live: 0, finished: 0, upcoming: 0, unknown: 0 };

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
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <main className="appShell">
      <section className="scorePanel" aria-label="Canli skorlar">
        <header className="topNav">
          <nav className="tabs" aria-label="Skor sekmeleri">
            <button className={tab === "all" ? "active" : ""} type="button" onClick={() => setTab("all")}>
              Tümü
            </button>
            <button
              className={tab === "favorites" ? "active" : ""}
              type="button"
              onClick={() => setTab("favorites")}
            >
              Favoriler
            </button>
            <button className={tab === "matches" ? "active" : ""} type="button" onClick={() => setTab("matches")}>
              Müsabakalar
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
            <button className={view === "live" ? "chip active liveChip" : "chip liveChip"} type="button" onClick={() => setView("live")}>
              Canlı ({counts.live})
            </button>
            <button className={view === "finished" ? "chip active" : "chip"} type="button" onClick={() => setView("finished")}>
              Bitti
            </button>
            <button className={view === "upcoming" ? "chip active" : "chip"} type="button" onClick={() => setView("upcoming")}>
              Yaklaşan
            </button>
            <button className={view === "all" ? "chip active" : "chip"} type="button" onClick={() => setView("all")}>
              Tümü
            </button>
          </div>

          <label className="toggleLabel">
            <span>Oranlar</span>
            <input type="checkbox" checked={showOdds} onChange={(event) => setShowOdds(event.target.checked)} />
          </label>
        </div>

        <div className="subFilter">
          <span>Alt lig maçlarını göster</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={showLowerLeagues}
              onChange={(event) => setShowLowerLeagues(event.target.checked)}
            />
            <span />
          </label>
        </div>

        <div className="statusLine">
          <span className={refreshing ? "syncSpin" : ""}>
            <RotateCw size={13} />
          </span>
          <span>{data ? `Son veri: ${new Date(data.sourceUpdatedAt).toLocaleTimeString("tr-TR")}` : "Veri hazirlaniyor"}</span>
          <span className="dividerDot" />
          <Activity size={13} />
          <span>{policyLabel(data?.refreshPolicy.reason)}</span>
        </div>

        {error ? <div className="errorBanner">{error}</div> : null}

        <div className="leagueStack">
          {loading && !data ? <LoadingRows /> : null}
          {!loading && groups.length === 0 ? <EmptyState tab={tab} onReload={reload} /> : null}
          {groups.map((group) => (
            <LeagueCard
              key={group.key}
              group={group}
              collapsed={collapsed.has(group.key)}
              favoriteIds={favoriteIds}
              showOdds={showOdds}
              onToggle={toggleGroup}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function filterGroups(
  groups: LeagueGroup[],
  options: { favoritesOnly: boolean; favoriteIds: Set<string>; showLowerLeagues: boolean }
) {
  return groups
    .map((group) => {
      const matches = options.favoritesOnly
        ? group.matches.filter((match) => options.favoriteIds.has(match.id))
        : group.matches;

      return { ...group, matches };
    })
    .filter((group) => group.matches.length > 0)
    .filter((group) => options.showLowerLeagues || group.isTopTier || group.counts.live > 0);
}

function readFavorites() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("scorexp:favorites") ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function policyLabel(reason?: string) {
  if (reason === "live") return "Canli akış";
  if (reason === "finished" || reason === "locked") return "Günlük arşiv";
  return "Planlı akış";
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
