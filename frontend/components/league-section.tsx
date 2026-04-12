import { memo } from "react";
import type { LeagueGroup } from "@/lib/matches";
import type { LiveMatch } from "@/lib/types";
import { MatchRow } from "@/components/match-row";

interface LeagueSectionProps {
  group: LeagueGroup;
  matchesById: Record<string, LiveMatch>;
  selectedMatchId: number | null;
}

export const LeagueSection = memo(function LeagueSection({
  group,
  matchesById,
  selectedMatchId,
}: LeagueSectionProps) {
  return (
    <section className="league-section">
      <header className="league-header">
        <div>
          <h2 className="league-title">{group.leagueName}</h2>
          <p className="league-country">{group.country}</p>
        </div>
        <span className="league-count">{group.matchIds.length}</span>
      </header>

      <div className="match-list">
        {group.matchIds.map((matchId) => {
          const match = matchesById[String(matchId)];

          if (!match) {
            return null;
          }

          return (
            <MatchRow
              key={match.matchId}
              match={match}
              isSelected={selectedMatchId === match.matchId}
            />
          );
        })}
      </div>
    </section>
  );
});
