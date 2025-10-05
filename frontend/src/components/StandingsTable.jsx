import React from "react";

export default function StandingsTable({ standings = [], highlightIds = [] }) {
  const isHL = (id) => highlightIds?.includes(id);

  const badge = (desc) => {
    if (!desc) return null;
    const d = String(desc).toLowerCase();
    if (d.includes("champions")) return <span className="text-[10px] px-2 py-[2px] rounded-full bg-emerald-100 text-emerald-800">UCL</span>;
    if (d.includes("europa")) return <span className="text-[10px] px-2 py-[2px] rounded-full bg-amber-100 text-amber-800">UEL</span>;
    if (d.includes("conference")) return <span className="text-[10px] px-2 py-[2px] rounded-full bg-cyan-100 text-cyan-800">UECL</span>;
    if (d.includes("relegation")) return <span className="text-[10px] px-2 py-[2px] rounded-full bg-rose-100 text-rose-800">REL</span>;
    return null;
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr className="text-left text-gray-600 dark:text-gray-200">
            <th className="px-2 py-2 w-6">#</th>
            <th className="px-2 py-2">Takım</th>
            <th className="px-2 py-2 w-6">O</th>
            <th className="px-2 py-2 w-6">G</th>
            <th className="px-2 py-2 w-6">B</th>
            <th className="px-2 py-2 w-6">M</th>
            <th className="px-2 py-2 w-14">AG:YG</th>
            <th className="px-2 py-2 w-8">AV</th>
            <th className="px-2 py-2 w-8">P</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const hl = isHL(row.team?.id);
            return (
              <tr
                key={row.team?.id}
                className={`border-t border-gray-100 dark:border-gray-700 ${
                  hl ? "bg-blue-50/60 dark:bg-blue-900/20" : ""
                }`}
              >
                <td className="px-2 py-2 text-center">{row.rank}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <img src={row.team?.logo} alt={row.team?.name} className="w-5 h-5 shrink-0" />
                    <span
                      className="truncate max-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis"
                      title={row.team?.name}
                    >
                      {row.team?.name}
                    </span>
                    {badge(row.description)}
                  </div>
                </td>
                <td className="px-2 py-2 text-center">{row.all?.played}</td>
                <td className="px-2 py-2 text-center">{row.all?.win}</td>
                <td className="px-2 py-2 text-center">{row.all?.draw}</td>
                <td className="px-2 py-2 text-center">{row.all?.lose}</td>
                <td className="px-2 py-2 text-center">
                  {row.all?.goals?.for}:{row.all?.goals?.against}
                </td>
                <td className="px-2 py-2 text-center">{row.goalsDiff}</td>
                <td className="px-2 py-2 font-semibold text-center">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}