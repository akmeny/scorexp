// frontend/src/components/MatchSummary.jsx
import React from "react";

export default function MatchSummary({ match, homeId, highlighted }) {
  if (!Array.isArray(match?.events) || match.events.length === 0) {
    return <div>Maç olayı bulunamadı.</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-base sm:text-lg mb-4">Maç Olayları</h3>
      <div className="relative">
        <div className="absolute left-1/2 transform -translate-x-1/2 h-full border-l-2 border-gray-300 dark:border-gray-600"></div>
        <div className="space-y-6 sm:space-y-8">
          {match.events.map((ev, idx) => {
            const isHome = ev.team?.id === homeId;
            const key = `${ev.type}-${idx}`;

            let baseClasses =
              "max-w-full sm:max-w-[70%] p-2 sm:p-3 rounded-lg shadow-md border text-xs sm:text-sm transition";
            let label = "";

            if (ev.type === "Goal") {
              baseClasses += " bg-green-100 border-green-500 dark:bg-green-900";
              label = "⚽ Gol";
            } else if (ev.type === "Penalty") {
              baseClasses += " bg-red-100 border-red-500 dark:bg-red-900";
              label = "⚡ Penaltı";
            } else if (ev.type === "Card" && ev.detail?.includes("Yellow")) {
              baseClasses += " border-2 border-yellow-500 dark:bg-yellow-900/40";
              label = "🟨 Sarı Kart";
            } else if (ev.type === "Card" && ev.detail?.includes("Red")) {
              baseClasses += " border-2 border-red-600 dark:bg-red-900/40";
              label = "🟥 Kırmızı Kart";
            } else if (ev.type === "subst") {
              baseClasses += " bg-blue-50 border-blue-300 dark:bg-blue-900/40";
              label = "🔄 Değişiklik";
            } else if (ev.type === "VAR") {
              baseClasses +=
                " bg-gray-100 border border-gray-400 dark:bg-gray-700 animate-pulse";
              label = "🕵️ VAR Kontrolü";
            }

            if (highlighted[key]) {
              if (ev.type === "Goal") baseClasses += " goal-highlight";
              if (ev.type === "Penalty") baseClasses += " penalty-highlight";
            }

            return (
              <div
                key={idx}
                className={`relative flex items-start ${
                  isHome ? "justify-start" : "justify-end"
                }`}
              >
                <div className={baseClasses}>
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src={ev.team?.logo}
                      alt={ev.team?.name}
                      className="w-5 h-5"
                    />
                    <span className="font-semibold">{ev.team?.name}</span>
                  </div>
                  <div className="mb-1">
                    <span>{label}</span>
                  </div>
                  <div className="text-xs opacity-80">
                    {ev.player?.name}
                    {ev.assist?.name ? ` → ${ev.assist?.name}` : ""}
                  </div>
                  <div className="text-[11px] opacity-60 mt-1">
                    {ev.time?.elapsed}' dk
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
