import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { MatchRow } from "./MatchRow";
import { TeamLogo } from "./TeamLogo";
import type { LeagueGroup, NormalizedMatch } from "../types";

interface LeagueCardProps {
  group: LeagueGroup;
  collapsed: boolean;
  pinned: boolean;
  showMatchCount: boolean;
  selectedMatchId: string | null;
  favoriteIds: Set<string>;
  highlightedIds: Set<string>;
  onToggle: (key: string) => void;
  onTogglePinned: (key: string) => void;
  onToggleFavorite: (id: string) => void;
  onSelectMatch: (match: NormalizedMatch) => void;
}

export function LeagueCard({
  group,
  collapsed,
  pinned,
  showMatchCount,
  selectedMatchId,
  favoriteIds,
  highlightedIds,
  onToggle,
  onTogglePinned,
  onToggleFavorite,
  onSelectMatch
}: LeagueCardProps) {
  return (
    <section className={`leagueCard ${pinned ? "pinned" : ""}`}>
      <div className="leagueHeader">
        <button className="leagueTitleButton" type="button" onClick={() => onToggle(group.key)}>
          <div className="leagueIdentity">
            <TeamLogo src={group.country.logo} label={group.country.name} size="md" />
            <div>
              <strong>{group.league.name}</strong>
              <span>{group.country.name}</span>
            </div>
          </div>
        </button>
        <div className="leagueActions">
          <button
            className={`leaguePinButton ${pinned ? "active" : ""}`}
            type="button"
            aria-label={pinned ? "Ligi sabitlemeden çıkar" : "Ligi sabitle"}
            aria-pressed={pinned}
            onClick={() => onTogglePinned(group.key)}
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
              goalHighlighted={highlightedIds.has(match.id)}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelectMatch}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
