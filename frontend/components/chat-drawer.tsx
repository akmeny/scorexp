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
                : "Maç Sohbeti"}
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
              ? "Sohbet odası hazır."
              : "Sohbeti açmak için bir maç seçin."}
          </p>
          <p className="detail-empty-subtext">
            {match
              ? "Bu sabit panel artık seçilen karşılaşmanın sohbet akışı için ayrıldı."
              : "Sağ sütun, sabit bir sohbet penceresi olarak hazırlandı ve inceleme paneliyle aynı düzen ritmini koruyor."}
          </p>
        </div>
      </section>
    </aside>
  );
});
