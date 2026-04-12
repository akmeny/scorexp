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
              ? "Bu ma\u00E7 art\u0131k bug\u00FCn\u00FCn ekran\u0131nda yer alm\u0131yor."
              : "\u0130ncelemek i\u00E7in bir ma\u00E7 se\u00E7in."}
          </p>
          {matchId ? (
            <p className="detail-empty-subtext">
              Ma\u00E7 kimli\u011Fi {matchId}, mevcut filtrelerin d\u0131\u015F\u0131na
              \u00E7\u0131km\u0131\u015F olabilir veya art\u0131k bug\u00FCn ekran\u0131nda
              yer alm\u0131yor.
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
          <p className="eyebrow">Ma\u00E7 Detay\u0131</p>
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
            G\u00FCncellendi {formatLastUpdated(match.lastUpdatedAt)}
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
          <dt>Ba\u015Flang\u0131\u00E7</dt>
          <dd>{formatKickoff(match.startTime)}</dd>
        </div>
        <div>
          <dt>Durum</dt>
          <dd>{translateMatchStatus(match)}</dd>
        </div>
        <div>
          <dt>Lig Kimli\u011Fi</dt>
          <dd>{match.leagueId}</dd>
        </div>
        <div>
          <dt>Ma\u00E7 Kimli\u011Fi</dt>
          <dd>{match.matchId}</dd>
        </div>
      </dl>

      <section className="detail-events">
        <header className="detail-events-header">
          <h3>Olay \u00D6zeti</h3>
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
            Bu kar\u015F\u0131la\u015Fma i\u00E7in hen\u00FCz olay \u00F6zeti
            \u00F6nbelle\u011Fe al\u0131nmad\u0131.
          </p>
        )}
      </section>
    </section>
  );
}
