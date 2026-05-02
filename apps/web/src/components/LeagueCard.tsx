import { ChevronDown, ChevronUp } from "lucide-react";
import { MatchRow } from "./MatchRow";
import { TeamLogo } from "./TeamLogo";
import type { LeagueGroup } from "../types";

interface LeagueCardProps {
  group: LeagueGroup;
  collapsed: boolean;
  favoriteIds: Set<string>;
  onToggle: (key: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function LeagueCard({
  group,
  collapsed,
  favoriteIds,
  onToggle,
  onToggleFavorite
}: LeagueCardProps) {
  return (
    <section className="leagueCard">
      <button className="leagueHeader" type="button" onClick={() => onToggle(group.key)}>
        <div className="leagueIdentity">
          <TeamLogo src={group.country.logo} label={group.country.name} size="md" />
          <div>
            <strong>{group.league.name}</strong>
            <span>{group.country.name}</span>
          </div>
        </div>
        <div className="leagueActions">
          <span>{group.matches.length}</span>
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </div>
      </button>

      {!collapsed ? (
        <div className="matchList">
          {group.matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              favorite={favoriteIds.has(match.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
