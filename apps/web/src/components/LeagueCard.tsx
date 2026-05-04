import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { MatchRow } from "./MatchRow";
import { TeamLogo } from "./TeamLogo";
import { localizeCountryName } from "../lib/localization";
import type { LeagueGroup, MatchGoalHighlight, NormalizedMatch } from "../types";

interface LeagueCardProps {
  group: LeagueGroup;
  collapsed: boolean;
  pinned: boolean;
  showMatchCount: boolean;
  selectedMatchId: string | null;
  favoriteIds: Set<string>;
  goalHighlights: Record<string, MatchGoalHighlight>;
  onToggle: (key: string) => void;
  onTogglePinned: (group: LeagueGroup) => void;
  onToggleFavorite: (id: string) => void;
  onOpenPrediction: (match: NormalizedMatch) => void;
  onSelectMatch: (match: NormalizedMatch) => void;
}

export function LeagueCard({
  group,
  collapsed,
  pinned,
  showMatchCount,
  selectedMatchId,
  favoriteIds,
  goalHighlights,
  onToggle,
  onTogglePinned,
  onToggleFavorite,
  onOpenPrediction,
  onSelectMatch
}: LeagueCardProps) {
  const countryName = localizeCountryName(group.country.name);

  return (
    <section className={`leagueCard ${pinned ? "pinned" : ""}`}>
      <div className="leagueHeader">
        <button className="leagueTitleButton" type="button" onClick={() => onToggle(group.key)}>
          <div className="leagueIdentity">
            <TeamLogo src={group.country.logo} label={countryName} size="md" />
            <div>
              <span>{countryName}</span>
              <strong>{group.league.name}</strong>
            </div>
          </div>
        </button>
        <div className="leagueActions">
          <button
            className={`leaguePinButton ${pinned ? "active" : ""}`}
            type="button"
            aria-label={pinned ? "Ligi sabitlemeden çıkar" : "Ligi sabitle"}
            aria-pressed={pinned}
            onClick={() => onTogglePinned(group)}
          >
            <Check size={14} />
          </button>
          {showMatchCount ? <span className="leagueMatchCount">{group.matches.length} maç</span> : null}
          <button className="leagueToggleButton" type="button" aria-label={collapsed ? "Ligi aç" : "Ligi kapat"} onClick={() => onToggle(group.key)}>
            {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="matchList">
          {group.matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              selected={selectedMatchId === match.id}
              favorite={favoriteIds.has(match.id)}
              goalHighlight={goalHighlights[match.id] ?? null}
              onToggleFavorite={onToggleFavorite}
              onOpenPrediction={onOpenPrediction}
              onSelect={onSelectMatch}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
