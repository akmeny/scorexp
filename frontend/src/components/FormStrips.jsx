import React, { useMemo } from "react";

/**
 * homeFixtures / awayFixtures: API-Sports fixtures list
 * teamId'lere göre W/D/L hesaplar.
 */
export default function FormStrips({
  homeFixtures = [],
  awayFixtures = [],
  homeTeamId,
  awayTeamId,
  homeTeam,
  awayTeam,
}) {
  const homeSeq = useMemo(
    () => computeSeq(homeFixtures, homeTeamId),
    [homeFixtures, homeTeamId]
  );
  const awaySeq = useMemo(
    () => computeSeq(awayFixtures, awayTeamId),
    [awayFixtures, awayTeamId]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormCard team={homeTeam} seq={homeSeq} />
      <FormCard team={awayTeam} seq={awaySeq} />
    </div>
  );
}

function FormCard({ team, seq = [] }) {
  return (
    <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <img src={team?.logo} alt={team?.name} className="w-6 h-6" />
        <h4 className="font-semibold">{team?.name} · Son {seq.length} maç</h4>
      </div>
      <div className="flex items-center gap-1">
        {seq.map((s, i) => (
          <div
            key={i}
            title={`${s.date} · ${s.vs} · ${s.score} · ${s.result}`}
            className={`w-6 h-6 rounded-md grid place-items-center text-[10px] font-bold text-white ${color(s.result)}`}
          >
            {s.result}
          </div>
        ))}
      </div>
    </div>
  );
}

function color(r) {
  return r === "W" ? "bg-emerald-600" : r === "D" ? "bg-gray-400" : "bg-rose-600";
}

function computeSeq(fixtures = [], teamId) {
  const take = fixtures.slice(0, 10); // gösterimde 10 güzel duruyor
  return take.map((f) => {
    const home = f.teams?.home;
    const away = f.teams?.away;
    const isHome = Number(home?.id) === Number(teamId);
    const winnerHome = home?.winner === true;
    const winnerAway = away?.winner === true;
    const draw = home?.winner === null && away?.winner === null;
    const result = draw ? "D" : (isHome ? (winnerHome ? "W" : "L") : (winnerAway ? "W" : "L"));
    const score = `${f.goals?.home ?? 0}-${f.goals?.away ?? 0}`;
    const opp = isHome ? away?.name : home?.name;

    let date = "";
    try {
      date = new Date(f.fixture?.date).toLocaleDateString();
    } catch {
      date = f.fixture?.date || "";
    }

    return { result, score, vs: opp, date };
  });
}
