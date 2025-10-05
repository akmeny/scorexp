import React, { useMemo } from "react";

/**
 * stats shape (API-Sports):
 * [
 *   { team:{id,name,logo}, statistics:[{type, value}, ...] },
 *   { team:{...}, statistics:[...] }
 * ]
 */
export default function StatCompare({ stats, homeTeam, awayTeam }) {
  const { rows } = useMemo(() => {
    const left = stats?.[0]?.statistics || [];
    const right = stats?.[1]?.statistics || [];

    const map = new Map();
    const setVal = (side, t, v) => {
      const key = (t || "").trim();
      const entry = map.get(key) || { type: key, home: null, away: null };
      entry[side] = v;
      map.set(key, entry);
    };

    for (const s of left) setVal("home", s.type, s.value);
    for (const s of right) setVal("away", s.type, s.value);

    const normalize = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        if (v.endsWith("%")) return parseFloat(v.replace("%", "")); // already percent
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      }
      return null;
    };

    const rows = Array.from(map.values()).map((r) => {
      const h = normalize(r.home);
      const a = normalize(r.away);
      let share = 50;
      if (r.type.toLowerCase().includes("possession") || r.type.includes("%")) {
        // zaten yüzde gibi
        share = h != null ? h : 50;
      } else if (h != null && a != null && h + a > 0) {
        share = (h / (h + a)) * 100;
      }
      return { ...r, homeNorm: h, awayNorm: a, share };
    });

    // Daha anlamlı bir sıralama: önce şutlar, xG, pas, topa sahip olma
    const orderHint = [
      "Total Shots",
      "Shots on Goal",
      "Shots off Goal",
      "Blocked Shots",
      "expected_goals",
      "Goalkeeper Saves",
      "Ball Possession",
      "Total passes",
      "Passes accurate",
      "Passes %",
      "Corner Kicks",
      "Offsides",
      "Fouls",
      "Yellow Cards",
      "Red Cards",
    ];
    rows.sort((a, b) => {
      const ia = orderHint.findIndex((x) => x.toLowerCase() === a.type.toLowerCase());
      const ib = orderHint.findIndex((x) => x.toLowerCase() === b.type.toLowerCase());
      if (ia === -1 && ib === -1) return a.type.localeCompare(b.type);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return { rows };
  }, [stats]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <TeamBadge team={homeTeam} align="left" />
        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Maç İstatistikleri
        </div>
        <TeamBadge team={awayTeam} align="right" />
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <StatRow
            key={r.type}
            label={r.type}
            home={r.homeNorm}
            away={r.awayNorm}
            share={r.share}
            rawHome={r.homeNorm ?? r.home}
            rawAway={r.awayNorm ?? r.away}
          />
        ))}
      </div>
    </div>
  );
}

function TeamBadge({ team, align = "left" }) {
  if (!team) return null;
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <img src={team.logo} alt={team.name} className="w-7 h-7 rounded-full" />
      <span className="text-sm font-semibold">{team.name}</span>
    </div>
  );
}

function StatRow({ label, home, away, share, rawHome, rawAway }) {
  const left = Math.max(0, Math.min(100, share ?? 50));
  const right = 100 - left;

  const fmt = (v, guessPercent) => {
    if (v === null || v === undefined) return "-";
    if (guessPercent) return `${Math.round(v)}%`;
    if (typeof v === "number" && Number.isFinite(v)) {
      // 1.83 gibi xG'ler için 2 ondalık, diğerlerinde tam sayı
      return v % 1 !== 0 ? v.toFixed(2) : v;
    }
    return String(v);
  };

  const looksPercent =
    label.toLowerCase().includes("possession") || label.includes("%");

  return (
    <div className="p-2 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className="font-semibold">{fmt(rawHome ?? home, looksPercent)}</span>
        <span className="uppercase tracking-wide text-gray-500">{label}</span>
        <span className="font-semibold">{fmt(rawAway ?? away, looksPercent)}</span>
      </div>
      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-blue-600"
          style={{ width: `${left}%` }}
          title={`Home: ${fmt(home, looksPercent)}`}
        />
        <div
          className="absolute right-0 top-0 h-full bg-gray-400 dark:bg-gray-500"
          style={{ width: `${right}%` }}
          title={`Away: ${fmt(away, looksPercent)}`}
        />
      </div>
    </div>
  );
}
