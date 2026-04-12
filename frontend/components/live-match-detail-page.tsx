"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import { MatchDetailContent, matchDetailTabLabels } from "@/components/match-detail-content";
import { fetchMatchDetailPageData } from "@/lib/api";
import { translateCountryName } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import type {
  MatchDetailPageResponse,
  MatchDetailTabKey,
  MatchUpdateEvent,
} from "@/lib/types";

const liveLikeStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"]);

function getRefreshIntervalMs(statusShort: string): number | null {
  if (liveLikeStatuses.has(statusShort)) {
    return 30_000;
  }

  if (["NS", "TBD"].includes(statusShort)) {
    return 2 * 60 * 1000;
  }

  return null;
}

function DetailTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`match-detail-tab ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function LiveMatchDetailPage({
  initialPayload,
}: {
  initialPayload: MatchDetailPageResponse;
}) {
  const [match, setMatch] = useState(initialPayload.match);
  const [detail, setDetail] = useState(initialPayload.detail);
  const [removed, setRemoved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [activeTab, setActiveTab] = useState<MatchDetailTabKey>(
    initialPayload.detail.availableTabs[0] ?? "summary",
  );

  const availableTabs = useMemo<MatchDetailTabKey[]>(
    () => (detail.availableTabs.length > 0 ? detail.availableTabs : ["summary"]),
    [detail.availableTabs],
  );

  const selectedCountry = useMemo(
    () => translateCountryName(match.country, match.countryFlag),
    [match.country, match.countryFlag],
  );

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? "summary");
    }
  }, [activeTab, availableTabs]);

  const refreshDetail = useEffectEvent(async () => {
    const payload = await fetchMatchDetailPageData(initialPayload.match.matchId);

    if (!payload?.match) {
      return;
    }

    startTransition(() => {
      setMatch(payload.match);
      setDetail(payload.detail);
      setRemoved(false);
    });
  });

  const handleUpdate = useEffectEvent((payload: MatchUpdateEvent) => {
    if (payload.matchId !== initialPayload.match.matchId) {
      return;
    }

    startTransition(() => {
      if (payload.type === "removed") {
        setRemoved(true);
        return;
      }

      if (payload.type === "added") {
        setMatch(payload.match);
        setRemoved(false);
        return;
      }

      setMatch((currentMatch) => ({
        ...currentMatch,
        ...payload.changes,
      }));
      setRemoved(false);
    });
  });

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnectionStatus("live");
      socket.emit("match:watch", initialPayload.match.matchId);
      void refreshDetail();
    };

    const onDisconnect = () => {
      setConnectionStatus("reconnecting");
    };

    const onConnectError = () => {
      setConnectionStatus("reconnecting");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("match:update", handleUpdate);
    socket.connect();

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.emit("match:unwatch", initialPayload.match.matchId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("match:update", handleUpdate);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const intervalMs = getRefreshIntervalMs(match.statusShort);

    if (intervalMs === null) {
      return;
    }

    const refresh = () => {
      if (document.visibilityState === "visible") {
        void refreshDetail();
      }
    };

    const interval = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [match.statusShort]);

  return (
    <main className="page-shell detail-page-shell">
      <section className="hero-card compact detail-page-hero">
        <div>
          <Link href="/" className="secondary-link">
            Canlı skorlara dön
          </Link>
          <h1 className="page-title small">
            {match.homeTeam.name} - {match.awayTeam.name}
          </h1>
          <p className="page-subtitle">
            {selectedCountry} • {match.leagueName}
          </p>
        </div>

        <span className={`status-pill ${connectionStatus === "live" ? "is-live" : "is-muted"}`}>
          {connectionStatus === "live" ? "Canlı güncelleme açık" : "Yeniden bağlanıyor"}
        </span>
      </section>

      {removed ? (
        <section className="banner banner-warning">
          <p>Bu maç artık canlı havuzda görünmüyor.</p>
          <p className="banner-subtext">
            Son alınan detaylar ekranda tutuluyor. Maç tekrar yayına girerse otomatik yenilenecek.
          </p>
        </section>
      ) : null}

      <section className="detail-tabs-shell">
        <div className="detail-tabs-row" role="tablist" aria-label="Maç detay sekmeleri">
          {availableTabs.map((tab) => (
            <DetailTabButton
              key={tab}
              active={activeTab === tab}
              label={matchDetailTabLabels[tab]}
              onClick={() => setActiveTab(tab)}
            />
          ))}
        </div>

        <section className="detail-tab-panel">
          <MatchDetailContent activeTab={activeTab} match={match} detail={detail} />
        </section>
      </section>
    </main>
  );
}
