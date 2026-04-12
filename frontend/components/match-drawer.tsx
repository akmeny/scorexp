"use client";

import { memo } from "react";
import { MatchPreviewPanel } from "@/components/match-preview-panel";
import {
  LiveMatchStore,
  useLiveMatch,
} from "@/lib/live-match-store";

interface MatchDrawerProps {
  store: LiveMatchStore;
  selectedMatchId: number | null;
}

export const MatchDrawer = memo(function MatchDrawer({
  store,
  selectedMatchId,
}: MatchDrawerProps) {
  const match = useLiveMatch(store, selectedMatchId);

  if (!selectedMatchId) {
    return (
      <aside className="match-drawer is-empty">
        <MatchPreviewPanel match={null} />
      </aside>
    );
  }

  return (
    <aside className="match-drawer">
      <MatchPreviewPanel
        match={match}
        removed={Boolean(selectedMatchId && !match)}
        matchId={selectedMatchId}
      />
    </aside>
  );
});
