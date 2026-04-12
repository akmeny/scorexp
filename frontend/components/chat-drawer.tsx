"use client";

import { memo } from "react";
import { formatMinute, getStatusTone } from "@/lib/format";
import {
  LiveMatchStore,
  useLiveMatch,
} from "@/lib/live-match-store";

interface ChatDrawerProps {
  store: LiveMatchStore;
  selectedMatchId: number | null;
}

export const ChatDrawer = memo(function ChatDrawer({
  store,
  selectedMatchId,
}: ChatDrawerProps) {
  const match = useLiveMatch(store, selectedMatchId);

  return (
    <aside className="chat-drawer">
      <section className="detail-panel chat-panel">
        <header className="drawer-header">
          <div>
            <p className="eyebrow">Chat</p>
            <h2 className="drawer-title">
              {match
                ? `${match.homeTeam.name} vs ${match.awayTeam.name}`
                : "Match conversation"}
            </h2>
          </div>
          {match ? (
            <span className={`status-pill ${getStatusTone(match.statusShort)}`}>
              {formatMinute(match)}
            </span>
          ) : null}
        </header>

        <div className="chat-panel-body">
          <p className="detail-empty-title">
            {match ? "Chat room is ready." : "Choose a match to open chat."}
          </p>
          <p className="detail-empty-subtext">
            {match
              ? "This sticky panel is now reserved for the selected fixture's conversation stream."
              : "The right column is prepared as a sticky conversation window and will follow the same panel rhythm as the inspect view."}
          </p>
        </div>
      </section>
    </aside>
  );
});
