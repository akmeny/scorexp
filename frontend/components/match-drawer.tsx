"use client";

import Link from "next/link";
import { memo } from "react";
import { MatchDetailPanel } from "@/components/match-detail-panel";
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
        <MatchDetailPanel match={null} />
      </aside>
    );
  }

  return (
    <aside className="match-drawer">
      <header className="drawer-header">
        <span className="drawer-title">Ma\u00E7 Detay\u0131</span>
        <div className="drawer-actions">
          {match ? (
            <Link href={`/match/${match.matchId}`} className="secondary-link">
              Sayfay\u0131 A\u00E7
            </Link>
          ) : null}
          <Link href="/" scroll={false} className="secondary-link">
            Kapat
          </Link>
        </div>
      </header>
      <MatchDetailPanel
        match={match}
        removed={Boolean(selectedMatchId && !match)}
        matchId={selectedMatchId}
      />
    </aside>
  );
});
