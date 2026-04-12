import {
  formatEventLine,
  formatKickoff,
  formatLastUpdated,
  formatMinute,
  getStatusTone,
} from "@/lib/format";
import { translateCountryName, translateMatchStatus } from "@/lib/i18n";
import type { LiveMatch } from "@/lib/types";

interface MatchDetailPanelProps {
  match: LiveMatch | null;
  removed?: boolean;
  matchId?: number | null;
}

function formatScore(score: number | null): string {
  return score === null ? "-" : String(score);
}

export function MatchDetailPanel({
  match,
  removed = false,
  matchId = null,
}: MatchDetailPanelProps) {
  if (!match) {
    return (
      <section className="detail-panel">
        <div className="detail-empty">
          <p className="detail-empty-title">
            {removed
              ? "Bu maç artık bugünün ekranında yer almıyor."
              : "İncelemek için bir maç seçin."}
          </p>
          {matchId ? (
            <p className="detail-empty-subtext">
              Maç kimliği {matchId}, mevcut filtrelerin dışına
              çıkmış olabilir veya artık bugünün ekranında
              yer almıyor.
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="detail-panel">
      <header className="detail-header">
        <div>
          <p className="eyebrow">Maç Detayı</p>
          <h2 className="detail-title">{match.leagueName}</h2>
          <p className="league-country">
            {translateCountryName(match.country, match.countryFlag)}
          </p>
        </div>
        <div className="detail-status">
          <span className={`status-pill ${getStatusTone(match.statusShort)}`}>
            {formatMinute(match)}
          </span>
          <span className="timestamp-label">
            Güncellendi {formatLastUpdated(match.lastUpdatedAt)}
          </span>
        </div>
      </header>

      <div className="detail-scoreboard">
        <div className="detail-team">
          {match.homeTeam.logo ? (
            <img
              src={match.homeTeam.logo}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="detail-logo"
            />
          ) : (
            <span className="detail-logo team-logo-fallback" />
          )}
          <span className="detail-team-name">{match.homeTeam.name}</span>
        </div>
        <div className="detail-score">
          <span>{formatScore(match.homeScore)}</span>
          <span className="score-separator">:</span>
          <span>{formatScore(match.awayScore)}</span>
        </div>
        <div className="detail-team align-right">
          {match.awayTeam.logo ? (
            <img
              src={match.awayTeam.logo}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="detail-logo"
            />
          ) : (
            <span className="detail-logo team-logo-fallback" />
          )}
          <span className="detail-team-name">{match.awayTeam.name}</span>
        </div>
      </div>

      <dl className="detail-facts">
        <div>
          <dt>Başlangıç</dt>
          <dd>{formatKickoff(match.startTime)}</dd>
        </div>
        <div>
          <dt>Durum</dt>
          <dd>{translateMatchStatus(match)}</dd>
        </div>
        <div>
          <dt>Lig Kimliği</dt>
          <dd>{match.leagueId}</dd>
        </div>
        <div>
          <dt>Maç Kimliği</dt>
          <dd>{match.matchId}</dd>
        </div>
      </dl>

      <section className="detail-events">
        <header className="detail-events-header">
          <h3>Olay Özeti</h3>
          {match.eventsSummary ? (
            <div className="event-totals">
              <span>{match.eventsSummary.total} olay</span>
              <span>{match.eventsSummary.goals} gol</span>
              <span>{match.eventsSummary.cards} kart</span>
            </div>
          ) : null}
        </header>

        {match.eventsSummary?.recent.length ? (
          <ul className="event-list">
            {match.eventsSummary.recent.map((event, index) => (
              <li key={`${event.minute}-${event.type}-${index}`} className="event-row">
                {formatEventLine(event)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-empty-subtext">
            Bu karşılaşma için henüz olay özeti
            önbelleğe alınmadı.
          </p>
        )}
      </section>
    </section>
  );
}
