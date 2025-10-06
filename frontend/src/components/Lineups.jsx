// frontend/src/components/Lineups.jsx
import React from "react";

export default function Lineups({ lineups }) {
  if (!Array.isArray(lineups) || lineups.length === 0) {
    return <div>Kadro bilgisi bulunamadı.</div>;
  }

  return (
    <div className="space-y-6">
      {lineups.map((team, idx) => (
        <div
          key={idx}
          className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 shadow"
        >
          <div className="flex items-center gap-2 mb-3">
            <img
              src={team.team?.logo}
              alt={team.team?.name}
              className="w-6 h-6"
            />
            <h3 className="font-semibold">{team.team?.name}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {team.startXI?.map((p, i) => (
              <div
                key={i}
                className="text-sm bg-white dark:bg-gray-800 rounded px-2 py-1 flex items-center justify-between border"
              >
                <span>
                  {p.player?.number}. {p.player?.name}
                </span>
                <span className="opacity-60">{p.player?.pos || "-"}</span>
              </div>
            ))}
          </div>

          {Array.isArray(team.substitutes) && team.substitutes.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Yedekler</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {team.substitutes.map((p, i) => (
                  <div
                    key={i}
                    className="text-sm bg-gray-100 dark:bg-gray-600 rounded px-2 py-1 flex items-center justify-between"
                  >
                    <span>
                      {p.player?.number}. {p.player?.name}
                    </span>
                    <span className="opacity-60">{p.player?.pos || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
