"use client";

import { RedCardBadge } from "@/components/match-live-badges";
import { formatKickoff, formatMinute, getStatusTone } from "@/lib/format";
import {
  translateCountryName,
  translateLooseFootballText,
  translateMatchStatus,
  translatePredictionComparisonKey,
  translateProviderText,
  translateStatisticLabel,
} from "@/lib/i18n";
import { useMatchPresentation } from "@/lib/live-match-presentation";
import type {
  MatchFormTeamSummary,
  LiveMatch,
  MatchDetailTabKey,
  MatchFullDetail,
  MatchRecentFormItem,
  MatchStandingsRow,
} from "@/lib/types";

export const matchDetailTabLabels: Record<MatchDetailTabKey, string> = {
  summary: "Özet",
  statistics: "İstatistik",
  events: "Olaylar",
  lineups: "Kadrolar",
  players: "Oyuncular",
  h2h: "H2H",
  form: "Form",
  standings: "Puan Durumu",
  tournament: "Turnuva",
  predictions: "Tahminler",
};

const compactDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatScore(score: number | null): string {
  return score === null ? "-" : String(score);
}

function formatCompactDate(iso: string): string {
  return compactDateFormatter.format(new Date(iso));
}

function parseNumericValue(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value.replace("%", "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function getBarWidths(home: string | null, away: string | null) {
  const homeNumber = parseNumericValue(home);
  const awayNumber = parseNumericValue(away);

  if (homeNumber === null && awayNumber === null) {
    return { home: "0%", away: "0%" };
  }

  if (homeNumber !== null && awayNumber !== null && homeNumber + awayNumber > 0) {
    return {
      home: `${(homeNumber / (homeNumber + awayNumber)) * 100}%`,
      away: `${(awayNumber / (homeNumber + awayNumber)) * 100}%`,
    };
  }

  return {
    home: homeNumber !== null ? "100%" : "0%",
    away: awayNumber !== null ? "100%" : "0%",
  };
}

function formatFormResult(result: MatchRecentFormItem["result"]): string {
  if (result === "W") return "G";
  if (result === "D") return "B";
  if (result === "L") return "M";
  return "?";
}

function hasPeriodScore(period: { home: number | null; away: number | null }) {
  return period.home !== null || period.away !== null;
}

function formatPeriodScore(period: { home: number | null; away: number | null }) {
  return hasPeriodScore(period) ? `${formatScore(period.home)} - ${formatScore(period.away)}` : "-";
}

function TeamLogo({
  logo,
  name,
  className,
  size,
}: {
  logo: string;
  name: string;
  className: string;
  size: number;
}) {
  if (!logo) {
    return <span className={`${className} team-logo-fallback`} aria-hidden="true" />;
  }

  return (
    <img
      src={logo}
      alt={`${name} logosu`}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="match-info-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SummaryTab({ match, detail }: { match: LiveMatch; detail: MatchFullDetail }) {
  const presentation = useMatchPresentation(match);
  const infoCards: Array<{ label: string; value: string | null }> = [
    { label: "Başlangıç", value: formatKickoff(match.startTime) },
    { label: "Durum", value: translateMatchStatus(match) },
    { label: "Sezon", value: detail.fixture?.season ? String(detail.fixture.season) : null },
    { label: "Tur", value: detail.fixture?.round ?? null },
    {
      label: "Stadyum",
      value: detail.fixture?.venueName
        ? `${detail.fixture.venueName}${detail.fixture.venueCity ? `, ${detail.fixture.venueCity}` : ""}`
        : null,
    },
    { label: "Hakem", value: detail.fixture?.referee ?? null },
    { label: "Saat Dilimi", value: detail.fixture?.timezone ?? null },
    { label: "Turnuva Türü", value: translateLooseFootballText(detail.fixture?.leagueType ?? null) },
  ];

  const tournamentNotes = [
    detail.tournament?.homeStandingDescription,
    detail.tournament?.awayStandingDescription,
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="match-detail-stack">
      <section className="match-detail-summary-card">
        <div className="match-detail-team-card">
          <div className="match-detail-team-media">
            <TeamLogo logo={match.homeTeam.logo} name={match.homeTeam.name} className="match-detail-team-logo" size={68} />
            <RedCardBadge count={match.homeRedCards} className="is-large" />
          </div>
          <div>
            <p className="match-detail-team-label">Ev sahibi</p>
            <h2>{match.homeTeam.name}</h2>
          </div>
        </div>

        <div className="match-detail-score-card">
          <div className="match-detail-main-score">
            <span>{formatScore(presentation.displayHomeScore)}</span>
            <span className="score-separator">:</span>
            <span>{formatScore(presentation.displayAwayScore)}</span>
          </div>
          <span className={`status-pill ${getStatusTone(match.statusShort)}`}>{formatMinute(match)}</span>
        </div>

        <div className="match-detail-team-card is-away">
          <div className="match-detail-team-media">
            <TeamLogo logo={match.awayTeam.logo} name={match.awayTeam.name} className="match-detail-team-logo" size={68} />
            <RedCardBadge count={match.awayRedCards} className="is-large" />
          </div>
          <div>
            <p className="match-detail-team-label">Deplasman</p>
            <h2>{match.awayTeam.name}</h2>
          </div>
        </div>
      </section>

      <section className="match-detail-info-grid">
        {infoCards.filter((card) => card.value).map((card) => (
          <InfoCard key={card.label} label={card.label} value={card.value!} />
        ))}
      </section>

      {detail.tournament ? (
        <section className="match-detail-info-grid">
          <InfoCard label="İlk Yarı" value={formatPeriodScore(detail.tournament.score.halftime)} />
          <InfoCard label="Normal Süre" value={formatPeriodScore(detail.tournament.score.fulltime)} />
          {hasPeriodScore(detail.tournament.score.extratime) ? (
            <InfoCard label="Uzatma" value={formatPeriodScore(detail.tournament.score.extratime)} />
          ) : null}
          {hasPeriodScore(detail.tournament.score.penalty) ? (
            <InfoCard label="Penaltılar" value={formatPeriodScore(detail.tournament.score.penalty)} />
          ) : null}
        </section>
      ) : null}

      {tournamentNotes.length > 0 ? (
        <article className="detail-data-card">
          <div className="detail-card-header">
            <h3>Turnuva bağlamı</h3>
          </div>
          <div className="detail-note-list">
            {tournamentNotes.map((note) => (
              <p key={note}>{translateLooseFootballText(note) ?? note}</p>
            ))}
          </div>
        </article>
      ) : null}

      {match.eventsSummary?.recent.length ? (
        <article className="detail-data-card">
          <div className="detail-card-header">
            <h3>Son olaylar</h3>
            <span>{match.eventsSummary.total} olay</span>
          </div>
          <ul className="compact-list is-events">
            {match.eventsSummary.recent.map((event, index) => (
              <li key={`${event.minute}-${event.type}-${index}`}>
                <span>
                  {event.minute ?? "-"}
                  {event.extraMinute ? `+${event.extraMinute}` : ""}
                  '
                </span>
                <strong>{translateProviderText(event.type)}{event.playerName ? ` - ${event.playerName}` : ""}</strong>
                <span>{translateProviderText(event.detail)}</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}

function StatisticsTab({ detail }: { detail: MatchFullDetail }) {
  return (
    <section className="match-detail-stack">
      {detail.statistics.map((row) => {
        const widths = getBarWidths(row.home, row.away);
        return (
          <article key={row.key} className="match-stat-row-card">
            <div className="match-stat-row-head">
              <strong>{row.home ?? "-"}</strong>
              <span>{translateStatisticLabel(row.label)}</span>
              <strong>{row.away ?? "-"}</strong>
            </div>
            <div className="match-stat-bars" aria-hidden="true">
              <div className="match-stat-bar is-home"><span style={{ width: widths.home }} /></div>
              <div className="match-stat-bar is-away"><span style={{ width: widths.away }} /></div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function EventsTab({ detail }: { detail: MatchFullDetail }) {
  return (
    <section className="match-detail-stack">
      {detail.events.map((event, index) => (
        <article key={`${event.minute}-${event.type}-${index}`} className="timeline-card">
          <div className="timeline-minute">
            {event.minute ?? "-"}
            {event.extraMinute ? `+${event.extraMinute}` : ""}
            '
          </div>
          <div className="timeline-body">
            <h3>{translateProviderText(event.detail)}</h3>
            <p>
              {translateProviderText(event.type)}
              {event.teamName ? ` • ${event.teamName}` : ""}
              {event.playerName ? ` • ${event.playerName}` : ""}
              {event.assistName ? ` • Asist: ${event.assistName}` : ""}
            </p>
            {event.comments ? <span>{translateProviderText(event.comments)}</span> : null}
          </div>
        </article>
      ))}
    </section>
  );
}

function LineupsTab({ detail }: { detail: MatchFullDetail }) {
  return (
    <section className="detail-two-column">
      {detail.lineups.map((lineup) => (
        <article key={lineup.teamId ?? lineup.teamName} className="detail-data-card">
          <div className="detail-card-header">
            <div className="detail-card-title-line">
              <TeamLogo logo={lineup.teamLogo} name={lineup.teamName} className="mini-team-logo" size={28} />
              <h3>{lineup.teamName}</h3>
            </div>
            {lineup.formation ? <span>{lineup.formation}</span> : null}
          </div>
          {lineup.coachName ? <p className="detail-subtle">Teknik direktör: {lineup.coachName}</p> : null}
          <div className="detail-list-block">
            <h4>İlk 11</h4>
            <ul className="compact-list">
              {lineup.startXI.map((player) => (
                <li key={`${player.id ?? player.name}-start`}>
                  <span>{player.number ?? "-"}</span>
                  <strong>{player.name}</strong>
                  <span>{player.position ?? player.grid ?? "-"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="detail-list-block">
            <h4>Yedekler</h4>
            <ul className="compact-list">
              {lineup.substitutes.map((player) => (
                <li key={`${player.id ?? player.name}-sub`}>
                  <span>{player.number ?? "-"}</span>
                  <strong>{player.name}</strong>
                  <span>{player.position ?? player.grid ?? "-"}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </section>
  );
}

function PlayersTab({ detail }: { detail: MatchFullDetail }) {
  return (
    <section className="detail-two-column">
      {detail.players.map((team) => (
        <article key={team.teamId ?? team.teamName} className="detail-data-card">
          <div className="detail-card-header">
            <div className="detail-card-title-line">
              <TeamLogo logo={team.teamLogo} name={team.teamName} className="mini-team-logo" size={28} />
              <h3>{team.teamName}</h3>
            </div>
            {team.updatedAt ? <span>{formatCompactDate(team.updatedAt)}</span> : null}
          </div>
          <div className="player-table">
            {team.players.map((player) => (
              <div key={player.playerId ?? `${team.teamName}-${player.name}`} className="player-row">
                <div className="player-row-main">
                  <strong>{player.name}</strong>
                  <span>
                    {player.position ?? "-"} • {player.minutes ?? 0} dk
                    {player.rating ? ` • Reyting ${player.rating}` : ""}
                    {player.captain ? " • K" : ""}
                  </span>
                </div>
                <div className="player-row-stats">
                  <span>Gol {player.goals ?? 0}</span>
                  <span>Asist {player.assists ?? 0}</span>
                  <span>Şut {player.shotsTotal ?? 0}</span>
                  <span>Ana pas {player.passesKey ?? 0}</span>
                  <span>Kart {player.yellowCards ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function H2HTab({ detail }: { detail: MatchFullDetail }) {
  return (
    <section className="match-detail-stack">
      {detail.headToHead.map((fixture) => (
        <article key={fixture.matchId} className="detail-data-card h2h-card">
          <div className="detail-card-header">
            <div>
              <h3>{fixture.leagueName}</h3>
              <p className="detail-subtle">{translateCountryName(fixture.country)}</p>
            </div>
            <span>{formatCompactDate(fixture.date)}</span>
          </div>
          <div className="h2h-score-line">
            <span>{fixture.homeTeamName}</span>
            <strong>
              {formatScore(fixture.homeScore)} - {formatScore(fixture.awayScore)}
            </strong>
            <span>{fixture.awayTeamName}</span>
          </div>
          <p className="detail-subtle">
            {fixture.round ? `${fixture.round} • ` : ""}
            {translateProviderText(fixture.statusLong)}
          </p>
        </article>
      ))}
    </section>
  );
}

function TeamFormBlock({ form }: { form: MatchFormTeamSummary }) {
  return (
    <article className="detail-data-card">
      <div className="detail-card-header">
        <div className="detail-card-title-line">
          <TeamLogo logo={form.teamLogo} name={form.teamName} className="mini-team-logo" size={28} />
          <h3>{form.teamName}</h3>
        </div>
      </div>

      <div className="form-chip-row">
        {form.last5.map((item) => (
          <span key={item.matchId} className={`form-chip is-${item.result.toLowerCase()}`}>
            {formatFormResult(item.result)}
          </span>
        ))}
      </div>

      <div className="detail-list-block">
        <h4>Son 10 maç</h4>
        <ul className="compact-list">
          {form.last10.map((item) => (
            <li key={item.matchId}>
              <span>{formatFormResult(item.result)}</span>
              <strong>{item.opponentName}</strong>
              <span>
                {formatScore(item.goalsFor)} - {formatScore(item.goalsAgainst)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {form.seasonStats ? (
        <div className="detail-mini-grid">
          <div><span>O</span><strong>{form.seasonStats.played ?? "-"}</strong></div>
          <div><span>G</span><strong>{form.seasonStats.wins ?? "-"}</strong></div>
          <div><span>B</span><strong>{form.seasonStats.draws ?? "-"}</strong></div>
          <div><span>M</span><strong>{form.seasonStats.losses ?? "-"}</strong></div>
          <div><span>AG</span><strong>{form.seasonStats.goalsFor ?? "-"}</strong></div>
          <div><span>YG</span><strong>{form.seasonStats.goalsAgainst ?? "-"}</strong></div>
          <div><span>Gol yemeden</span><strong>{form.seasonStats.cleanSheets ?? "-"}</strong></div>
          <div><span>Gol atamadan</span><strong>{form.seasonStats.failedToScore ?? "-"}</strong></div>
        </div>
      ) : null}
    </article>
  );
}

function FormTab({ detail }: { detail: MatchFullDetail }) {
  if (!detail.form) {
    return null;
  }

  return (
    <section className="detail-two-column">
      <TeamFormBlock form={detail.form.home} />
      <TeamFormBlock form={detail.form.away} />
    </section>
  );
}

function hasStandingDescription(row: MatchStandingsRow): boolean {
  return Boolean(row.description || row.status);
}

function StandingsTab({ detail }: { detail: MatchFullDetail }) {
  if (!detail.standings) {
    return null;
  }

  return (
    <section className="match-detail-stack">
      {detail.standings.groups.map((group) => (
        <article key={group.name} className="detail-data-card">
          <div className="detail-card-header">
            <h3>{group.name}</h3>
          </div>
          <div className="standings-table">
            <div className="standings-row is-head">
              <span>#</span>
              <span>Takım</span>
              <span>P</span>
              <span>O</span>
              <span>G</span>
              <span>B</span>
              <span>M</span>
              <span>AV</span>
            </div>
            {group.rows.map((row) => (
              <div
                key={`${group.name}-${row.teamId ?? row.teamName}`}
                className={`standings-row ${row.isCurrentMatchTeam ? "is-highlight" : ""}`}
              >
                <span>{row.rank ?? "-"}</span>
                <span className="standings-team-cell">
                  {row.teamLogo ? <img src={row.teamLogo} alt="" width={18} height={18} className="standings-team-logo" /> : null}
                  {row.teamName}
                </span>
                <span>{row.points ?? "-"}</span>
                <span>{row.played ?? "-"}</span>
                <span>{row.wins ?? "-"}</span>
                <span>{row.draws ?? "-"}</span>
                <span>{row.losses ?? "-"}</span>
                <span>{row.goalsDiff ?? "-"}</span>
                {hasStandingDescription(row) ? (
                  <span className="standings-description">
                    {translateLooseFootballText(row.description ?? row.status) ?? row.description ?? row.status}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function TournamentTab({ detail }: { detail: MatchFullDetail }) {
  if (!detail.tournament) {
    return null;
  }

  const cards: Array<{ label: string; value: string | null }> = [
    { label: "Turnuva türü", value: translateLooseFootballText(detail.tournament.leagueType) },
    { label: "Sezon", value: detail.tournament.season ? String(detail.tournament.season) : null },
    { label: "Tur", value: detail.tournament.round },
    {
      label: "Stadyum",
      value: detail.tournament.venueName
        ? `${detail.tournament.venueName}${detail.tournament.venueCity ? `, ${detail.tournament.venueCity}` : ""}`
        : null,
    },
    { label: "Hakem", value: detail.tournament.referee },
    { label: "Saat dilimi", value: detail.tournament.timezone },
    {
      label: "Ev sahibi durumu",
      value: translateLooseFootballText(detail.tournament.homeStandingDescription),
    },
    {
      label: "Deplasman durumu",
      value: translateLooseFootballText(detail.tournament.awayStandingDescription),
    },
  ];

  return (
    <section className="match-detail-info-grid">
      {cards.filter((card) => card.value).map((card) => (
        <InfoCard key={card.label} label={card.label} value={card.value!} />
      ))}
    </section>
  );
}

function PredictionsTab({ detail }: { detail: MatchFullDetail }) {
  if (!detail.predictions) {
    return null;
  }

  return (
    <section className="match-detail-stack">
      <article className="detail-data-card">
        <div className="detail-card-header">
          <h3>Tahmin özeti</h3>
        </div>
        <div className="detail-mini-grid">
          {detail.predictions.winnerName ? (
            <div><span>Favori</span><strong>{detail.predictions.winnerName}</strong></div>
          ) : null}
          {detail.predictions.winnerComment ? (
            <div>
              <span>Yorum</span>
              <strong>{translateLooseFootballText(detail.predictions.winnerComment) ?? detail.predictions.winnerComment}</strong>
            </div>
          ) : null}
          {detail.predictions.advice ? (
            <div>
              <span>Öneri</span>
              <strong>{translateLooseFootballText(detail.predictions.advice) ?? detail.predictions.advice}</strong>
            </div>
          ) : null}
          {detail.predictions.underOver ? (
            <div><span>Alt / Üst</span><strong>{detail.predictions.underOver}</strong></div>
          ) : null}
          {detail.predictions.goalsHome || detail.predictions.goalsAway ? (
            <div>
              <span>Beklenen goller</span>
              <strong>{detail.predictions.goalsHome ?? "-"} / {detail.predictions.goalsAway ?? "-"}</strong>
            </div>
          ) : null}
          {detail.predictions.homeLast5Form ? (
            <div><span>Ev sahibi son 5</span><strong>{detail.predictions.homeLast5Form}</strong></div>
          ) : null}
          {detail.predictions.awayLast5Form ? (
            <div><span>Deplasman son 5</span><strong>{detail.predictions.awayLast5Form}</strong></div>
          ) : null}
        </div>
      </article>

      {(detail.predictions.percentHome ||
        detail.predictions.percentDraw ||
        detail.predictions.percentAway) && (
        <article className="detail-data-card">
          <div className="detail-card-header">
            <h3>Olasılıklar</h3>
          </div>
          <div className="prediction-percent-grid">
            <div><span>Ev sahibi</span><strong>{detail.predictions.percentHome ?? "-"}</strong></div>
            <div><span>Beraberlik</span><strong>{detail.predictions.percentDraw ?? "-"}</strong></div>
            <div><span>Deplasman</span><strong>{detail.predictions.percentAway ?? "-"}</strong></div>
          </div>
        </article>
      )}

      {Object.keys(detail.predictions.comparison).length > 0 ? (
        <article className="detail-data-card">
          <div className="detail-card-header">
            <h3>Karşılaştırma</h3>
          </div>
          <div className="detail-mini-grid">
            {Object.entries(detail.predictions.comparison).map(([key, value]) => (
              <div key={key}>
                <span>{translatePredictionComparisonKey(key)}</span>
                <strong>{translateLooseFootballText(value) ?? value ?? "-"}</strong>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}

export function MatchDetailContent({
  activeTab,
  match,
  detail,
}: {
  activeTab: MatchDetailTabKey;
  match: LiveMatch;
  detail: MatchFullDetail;
}) {
  if (activeTab === "summary") return <SummaryTab match={match} detail={detail} />;
  if (activeTab === "statistics") return <StatisticsTab detail={detail} />;
  if (activeTab === "events") return <EventsTab detail={detail} />;
  if (activeTab === "lineups") return <LineupsTab detail={detail} />;
  if (activeTab === "players") return <PlayersTab detail={detail} />;
  if (activeTab === "h2h") return <H2HTab detail={detail} />;
  if (activeTab === "form") return <FormTab detail={detail} />;
  if (activeTab === "standings") return <StandingsTab detail={detail} />;
  if (activeTab === "tournament") return <TournamentTab detail={detail} />;
  if (activeTab === "predictions") return <PredictionsTab detail={detail} />;
  return null;
}
