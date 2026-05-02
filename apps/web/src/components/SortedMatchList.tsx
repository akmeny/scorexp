import { MatchRow } from "./MatchRow";
import type { GoalHighlightSide, NormalizedMatch } from "../types";

interface SortedMatchListProps {
  matches: NormalizedMatch[];
  selectedMatchId: string | null;
  favoriteIds: Set<string>;
  goalHighlights: Record<string, GoalHighlightSide>;
  onToggleFavorite: (id: string) => void;
  onSelectMatch: (match: NormalizedMatch) => void;
}

export function SortedMatchList({
  matches,
  selectedMatchId,
  favoriteIds,
  goalHighlights,
  onToggleFavorite,
  onSelectMatch
}: SortedMatchListProps) {
  return (
    <div className="sortedMatchList" aria-label="Saate göre sıralı maçlar">
      {matches.map((match) => (
        <MatchRow
          key={match.id}
          match={match}
          selected={selectedMatchId === match.id}
          favorite={favoriteIds.has(match.id)}
          goalHighlightSide={goalHighlights[match.id] ?? null}
          onToggleFavorite={onToggleFavorite}
          onSelect={onSelectMatch}
        />
      ))}
    </div>
  );
}
