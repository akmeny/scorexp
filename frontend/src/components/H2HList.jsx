import React from "react";

export default function H2HList({ items = [] }) {
  const fmt = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-2">
      {items.map((f) => {
        const home = f.teams?.home;
        const away = f.teams?.away;
        const score = `${f.goals?.home ?? 0} - ${f.goals?.away ?? 0}`;
        const homeWin = home?.winner === true;
        const awayWin = away?.winner === true;
        const draw = home?.winner === null && away?.winner === null;

        return (
          <div
            key={f.fixture?.id}
            className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/60"
          >
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{fmt(f.fixture?.date)}</span>
              <span>{f.league?.name} · {f.league?.season}</span>
            </div>
            <div className="mt-1 grid grid-cols-3 items-center">
              <TeamMini team={home} align="right" win={homeWin} draw={draw} />
              <div className="text-center font-semibold">{score}</div>
              <TeamMini team={away} align="left" win={awayWin} draw={draw} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamMini({ team, align = "left", win, draw }) {
  const status =
    draw ? "text-amber-600"
    : win ? "text-emerald-600"
    : "text-rose-600";

  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : ""}`}>
      {align === "left" && <img src={team?.logo} alt="" className="w-5 h-5" />}
      <span className={`text-sm ${status}`}>{team?.name}</span>
      {align === "right" && <img src={team?.logo} alt="" className="w-5 h-5" />}
    </div>
  );
}
