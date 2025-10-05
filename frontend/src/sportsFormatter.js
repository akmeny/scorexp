/**
 * Spor verilerini formatlamak için yardımcı fonksiyonlar.
 * Bu fonksiyonlar, API'den gelen maç verilerini UI bileşenlerine uygun hale getirir.
 */
export const mapMatchData = (rawMatch) => {
  // API alanlarını burada eşleyin. Örneğin:
  return {
    id: rawMatch.id,
    country: rawMatch.country || rawMatch.country_name || '',
    league: rawMatch.league || rawMatch.league_name || '',
    homeTeam: rawMatch.home_team || rawMatch.homeName || '',
    awayTeam: rawMatch.away_team || rawMatch.awayName || '',
    homeScore: rawMatch.home_score ?? null,
    awayScore: rawMatch.away_score ?? null,
    homeLogo: rawMatch.home_logo || '',
    awayLogo: rawMatch.away_logo || '',
    status: rawMatch.status || '',
    minute: rawMatch.minute || '',
    startTime: rawMatch.start_time || '',
  };
};