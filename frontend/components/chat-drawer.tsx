"use client";

import { memo } from "react";
import { formatMinute, getStatusTone } from "@/lib/format";
import { translateCountryName } from "@/lib/i18n";
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
            <p className="eyebrow">Sohbet</p>
            <h2 className="drawer-title">
              {match
                ? `${match.homeTeam.name} - ${match.awayTeam.name}`
                : "Ma\u00E7 Sohbeti"}
            </h2>
            {match ? (
              <p className="league-country">
                {translateCountryName(match.country, match.countryFlag)}
              </p>
            ) : null}
          </div>
          {match ? (
            <span className={`status-pill ${getStatusTone(match.statusShort)}`}>
              {formatMinute(match)}
            </span>
          ) : null}
        </header>

        <div className="chat-panel-body">
          <p className="detail-empty-title">
            {match
              ? "Sohbet odas\u0131 haz\u0131r."
              : "Sohbeti a\u00E7mak i\u00E7in bir ma\u00E7 se\u00E7in."}
          </p>
          <p className="detail-empty-subtext">
            {match
              ? "Bu sabit panel art\u0131k se\u00E7ilen kar\u015F\u0131la\u015Fman\u0131n sohbet ak\u0131\u015F\u0131 i\u00E7in ayr\u0131ld\u0131."
              : "Sa\u011F s\u00FCtun, sabit bir sohbet penceresi olarak haz\u0131rland\u0131 ve inceleme paneliyle ayn\u0131 d\u00FCzen ritmini koruyor."}
          </p>
        </div>
      </section>
    </aside>
  );
});
