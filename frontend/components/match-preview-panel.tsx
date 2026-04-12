"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMatchById } from "@/lib/api";
import { formatMinute, getStatusTone } from "@/lib/format";
import { translateCountryName } from "@/lib/i18n";
import type {
  LiveMatch,
  MatchStatisticPair,
  MatchStatisticsSummary,
} from "@/lib/types";

interface MatchPreviewPanelProps {
  match: LiveMatch | null;
  removed?: boolean;
  matchId?: number | null;
}

interface StatisticRowDefinition {
  key: "possession" | "shots" | "corners";
  label: string;
}

const statisticRows: readonly StatisticRowDefinition[] = [
  {
    key: "possession",
    label: "Topa Sahip Olma",
  },
  {
    key: "shots",
    label: "Şut Sayısı",
  },
  {
    key: "corners",
    label: "Korner Sayısı",
  },
];

const emptyStatisticPair: MatchStatisticPair = {
  home: null,
  away: null,
  unit: "count",
};

function formatScore(score: number | null): string {
  return score === null ? "-" : String(score);
}

function formatStatisticValue(pair: MatchStatisticPair, value: number | null): string {
  if (value === null) {
    return "-";
  }

  if (pair.unit === "%") {
    return `${Math.round(value)}%`;
  }

  return String(Math.round(value));
}

function getStatisticWidths(pair: MatchStatisticPair): {
  home: number;
  away: number;
} {
  if (pair.home === null && pair.away === null) {
    return {
      home: 0,
      away: 0,
    };
  }

  if (pair.unit === "%") {
    return {
      home: Math.max(0, Math.min(100, pair.home ?? 0)),
      away: Math.max(0, Math.min(100, pair.away ?? 0)),
    };
  }

  const max = Math.max(pair.home ?? 0, pair.away ?? 0, 1);

  return {
    home: ((pair.home ?? 0) / max) * 100,
    away: ((pair.away ?? 0) / max) * 100,
  };
}

function hasStatistics(statistics: MatchStatisticsSummary | null): boolean {
  if (!statistics) {
    return false;
  }

  return statisticRows.some(({ key }) => {
    const pair = statistics[key];
    return pair.home !== null || pair.away !== null;
  });
}

export function MatchPreviewPanel({
  match,
  removed = false,
  matchId = null,
}: MatchPreviewPanelProps) {
  const [statistics, setStatistics] = useState<MatchStatisticsSummary | null>(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);

  useEffect(() => {
    if (!match || matchId === null) {
      setStatistics(null);
      setStatisticsLoading(false);
      return;
    }

    let cancelled = false;
    setStatisticsLoading(true);

    void fetchMatchById(matchId)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setStatistics(payload?.statistics ?? null);
        setStatisticsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setStatistics(null);
        setStatisticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [matchId, removed, match?.lastUpdatedAt]);

  return (
    <section className="detail-panel match-preview-panel">
      <header className="preview-panel-header">
        <p className="preview-panel-title">Maç Önizleme</p>
        {matchId ? (
          <Link href="/" scroll={false} className="secondary-link preview-close-link">
            Kapat
          </Link>
        ) : null}
      </header>

      {!match ? (
        <div className="detail-empty preview-empty">
          <p className="detail-empty-title">
            {removed
              ? "Bu maç artık bugünün ekranında yer almıyor."
              : "İncelemek için bir maç seçin."}
          </p>
          {matchId ? (
            <p className="detail-empty-subtext">
              Seçili karşılaşma görünüm dışına çıkmış olabilir veya artık aktif
              listede yer almıyor.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <section className="preview-meta-card">
            <div>
              <h2 className="detail-title">{match.leagueName}</h2>
              <p className="league-country">
                {translateCountryName(match.country, match.countryFlag)}
              </p>
            </div>
            <span className={`status-pill ${getStatusTone(match.statusShort)}`}>
              {formatMinute(match)}
            </span>
          </section>

          <section className="preview-scoreboard">
            <div className="preview-logo-shell">
              {match.homeTeam.logo ? (
                <img
                  src={match.homeTeam.logo}
                  alt=""
                  width={60}
                  height={60}
                  loading="lazy"
                  decoding="async"
                  className="preview-team-logo"
                />
              ) : (
                <span className="preview-team-logo team-logo-fallback" />
              )}
            </div>

            <div className="preview-score-stack">
              <div className="preview-score-cluster" aria-label="Güncel skor">
                <span>{formatScore(match.homeScore)}</span>
                <span className="score-separator">:</span>
                <span>{formatScore(match.awayScore)}</span>
              </div>
              <Link href={`/match/${match.matchId}`} className="preview-detail-link">
                Maç Detayına Git
              </Link>
            </div>

            <div className="preview-logo-shell">
              {match.awayTeam.logo ? (
                <img
                  src={match.awayTeam.logo}
                  alt=""
                  width={60}
                  height={60}
                  loading="lazy"
                  decoding="async"
                  className="preview-team-logo"
                />
              ) : (
                <span className="preview-team-logo team-logo-fallback" />
              )}
            </div>
          </section>

          <section className="preview-insight-card">
            <div className="preview-section-heading">
              <h3>Maç İstatistikleri</h3>
              {statisticsLoading ? <span>Yükleniyor</span> : null}
            </div>

            {hasStatistics(statistics) ? (
              <div className="preview-stat-list">
                {statisticRows.map(({ key, label }) => {
                  const pair = statistics?.[key] ?? emptyStatisticPair;
                  const widths = getStatisticWidths(pair);

                  return (
                    <div key={key} className="preview-stat-row">
                      <div className="preview-stat-head">
                        <span className="preview-stat-value">
                          {formatStatisticValue(pair, pair.home)}
                        </span>
                        <span className="preview-stat-label">{label}</span>
                        <span className="preview-stat-value is-away">
                          {formatStatisticValue(pair, pair.away)}
                        </span>
                      </div>
                      <div className="preview-stat-track" aria-hidden="true">
                        <div className="preview-stat-half is-home">
                          <span style={{ width: `${widths.home}%` }} />
                        </div>
                        <div className="preview-stat-half is-away">
                          <span style={{ width: `${widths.away}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="detail-empty-subtext">
                Bu maç için istatistik verisi henüz sağlayıcıdan gelmedi.
              </p>
            )}
          </section>

          <section className="preview-insight-card pressure-card">
            <div className="preview-section-heading">
              <h3>Baskımetre</h3>
              <span>Yakında</span>
            </div>
            <div className="pressure-meter" aria-hidden="true">
              <div className="pressure-lane is-home">
                <span />
              </div>
              <div className="pressure-center-pill">Veri Hazırlanıyor</div>
              <div className="pressure-lane is-away">
                <span />
              </div>
            </div>
            <p className="detail-empty-subtext">
              Baskı verisi sonraki aşamada bu alana bağlanacak.
            </p>
          </section>
        </>
      )}
    </section>
  );
}
