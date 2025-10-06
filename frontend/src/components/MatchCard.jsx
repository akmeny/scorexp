import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function MatchCard({ match }) {
  const navigate = useNavigate();
  const location = useLocation();
  if (!match) return null;

  const fromPath = location.state?.from || "/";
  const backState = location.state?.backState;

  const goBack = () => {
    // State’i navigasyonla geri taşı → liste sayfası mount olduğunda okuyup uygular
    navigate(fromPath, { replace: true, state: { restore: backState } });
  };

  const home = match.teams?.home;
  const away = match.teams?.away;
  const goals = match.goals || {};
  const fixture = match.fixture || {};
  const league = match.league || {};

  const status = fixture?.status?.short || "";
  const statusLong = fixture?.status?.long || "";
  const isHT = status === "HT";
  const isFT = ["FT", "AET", "PEN"].includes(status);
  const isLive = !isHT && !isFT && status !== "NS";

  const statusColor =
    isFT
      ? "bg-gray-500"
      : status === "1H" || status === "2H" || status === "LIVE"
      ? "bg-red-600 animate-pulse"
      : status === "NS"
      ? "bg-blue-600"
      : "bg-gray-400";

  const SafeImg = ({ src, alt, className }) => (
    <img
      src={src || ""}
      alt={alt || ""}
      className={className}
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
        e.currentTarget.style.width = "0px";
      }}
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <div
      className="
        p-4 rounded-2xl
        bg-white/70 dark:bg-gray-900/60
        backdrop-blur-md shadow-md
        border border-gray-200 dark:border-gray-700
      "
    >
      {/* Üst şerit */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={goBack}
            className="px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            title="Geri"
          >
            ←
          </button>
          <SafeImg src={league.logo} alt={league.name} className="w-5 h-5 rounded-sm" />
          <SafeImg src={league.flag} alt={league.country} className="w-5 h-5 rounded-sm" />
          <span className="truncate">
            {league.name}
            {league.season ? ` · ${league.season}` : ""}
          </span>
        </div>
        <span className="shrink-0">
          {fixture?.date
            ? new Date(fixture.date).toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : ""}
        </span>
      </div>

      {/* Takımlar ve skor */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SafeImg src={home?.logo} alt={home?.name} className="w-10 h-10" />
          <span className="text-base font-semibold truncate">{home?.name}</span>
        </div>
        <div className="flex flex-col items-center justify-center px-2 flex-none w-[80px]">
          {/* ✔️ Canlı bitene dek skor kırmızı */}
          <div className={`text-2xl font-bold tabular-nums ${isLive || isHT ? "text-red-600" : ""}`}>
            {goals.home ?? 0} : {goals.away ?? 0}
          </div>
          <span
            className={`text-[11px] px-2 py-[2px] rounded-full text-white ${statusColor}`}
            title={statusLong}
          >
            {status || "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-base font-semibold truncate text-right">{away?.name}</span>
          <SafeImg src={away?.logo} alt={away?.name} className="w-10 h-10" />
        </div>
      </div>

      {/* Alt bilgi */}
      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span className="truncate">
          {fixture?.venue?.name || ""} {fixture?.venue?.city ? `· ${fixture.venue.city}` : ""}
        </span>
        <span className="truncate">{fixture?.referee ? `Ref: ${fixture.referee}` : ""}</span>
      </div>
    </div>
  );
}