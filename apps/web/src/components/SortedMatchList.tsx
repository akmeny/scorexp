import { MatchRow } from "./MatchRow";
import type { MatchGoalHighlight, NormalizedMatch } from "../types";

interface SortedMatchListProps {
  matches: NormalizedMatch[];
  selectedMatchId: string | null;
  favoriteIds: Set<string>;
  goalHighlights: Record<string, MatchGoalHighlight>;
  onToggleFavorite: (id: string) => void;
  onOpenPrediction: (match: NormalizedMatch) => void;
  onSelectMatch: (match: NormalizedMatch) => void;
}

export function SortedMatchList({
  matches,
  selectedMatchId,
  favoriteIds,
  goalHighlights,
  onToggleFavorite,
  onOpenPrediction,
  onSelectMatch
}: SortedMatchListProps) {
  return (
    <div className="sortedMatchList" aria-label="Zamana göre sıralı maçlar">
      {matches.map((match) => (
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
  );
}
