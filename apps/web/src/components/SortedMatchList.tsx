import { MatchRow } from "./MatchRow";
import type { NormalizedMatch } from "../types";

interface SortedMatchListProps {
  matches: NormalizedMatch[];
  favoriteIds: Set<string>;
  highlightedIds: Set<string>;
  onToggleFavorite: (id: string) => void;
}

export function SortedMatchList({ matches, favoriteIds, highlightedIds, onToggleFavorite }: SortedMatchListProps) {
  return (
    <div className="sortedMatchList" aria-label="Saate göre sıralı maçlar">
      {matches.map((match) => (
        <MatchRow
          key={match.id}
          match={match}
          favorite={favoriteIds.has(match.id)}
          goalHighlighted={highlightedIds.has(match.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
