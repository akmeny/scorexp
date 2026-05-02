import { MatchRow } from "./MatchRow";
import type { NormalizedMatch } from "../types";

interface SortedMatchListProps {
  matches: NormalizedMatch[];
  selectedMatchId: string | null;
  favoriteIds: Set<string>;
  highlightedIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onSelectMatch: (match: NormalizedMatch) => void;
}

export function SortedMatchList({
  matches,
  selectedMatchId,
  favoriteIds,
  highlightedIds,
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
          goalHighlighted={highlightedIds.has(match.id)}
          onToggleFavorite={onToggleFavorite}
          onSelect={onSelectMatch}
        />
      ))}
    </div>
  );
}
