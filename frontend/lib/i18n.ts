import type { LiveMatch, MatchEventSummaryItem } from "@/lib/types";

const regionDisplayNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["tr"], {
        type: "region",
      })
    : null;

const countryNameOverrides: Record<string, string> = {
  africa: "Afrika",
  asia: "Asya",
  europe: "Avrupa",
  oceania: "Okyanusya",
  world: "Dünya",
  "north-america": "Kuzey Amerika",
  "south-america": "Güney Amerika",
  "central-america": "Orta Amerika",
  england: "İngiltere",
  scotland: "İskoçya",
  wales: "Galler",
  "northern-ireland": "Kuzey İrlanda",
  ireland: "İrlanda",
  "republic-of-ireland": "İrlanda Cumhuriyeti",
  "czech-republic": "Çekya",
  "south-korea": "Güney Kore",
  "north-korea": "Kuzey Kore",
  "saudi-arabia": "Suudi Arabistan",
  "united-arab-emirates": "Birleşik Arap Emirlikleri",
  "bosnia-and-herzegovina": "Bosna Hersek",
  bosnia: "Bosna Hersek",
  "ivory-coast": "Fildişi Sahili",
  "dr-congo": "Kongo Demokratik Cumhuriyeti",
  "cape-verde": "Yeşil Burun Adaları",
  "faroe-islands": "Faroe Adaları",
  "hong-kong": "Hong Kong",
  kosovo: "Kosova",
  macedonia: "Kuzey Makedonya",
  "new-zealand": "Yeni Zelanda",
  "south-africa": "Güney Afrika",
  "north-macedonia": "Kuzey Makedonya",
  usa: "ABD",
  "united-states": "ABD",
  "costa-rica": "Kosta Rika",
  "dominican-republic": "Dominik Cumhuriyeti",
  "el-salvador": "El Salvador",
  "equatorial-guinea": "Ekvator Ginesi",
  "new-caledonia": "Yeni Kaledonya",
  "puerto-rico": "Porto Riko",
  "san-marino": "San Marino",
  "sierra-leone": "Sierra Leone",
  "solomon-islands": "Solomon Adaları",
  "south-sudan": "Güney Sudan",
  "sri-lanka": "Sri Lanka",
  "trinidad-and-tobago": "Trinidad ve Tobago",
};

const regionCodeOverrides: Record<string, string> = {
  XK: "Kosova",
};

const providerTextTranslations: Record<string, string> = {
  goal: "Gol",
  "normal-goal": "Normal gol",
  "own-goal": "Kendi kalesine gol",
  penalty: "Penaltı",
  "missed-penalty": "Kaçan penaltı",
  "penalty-confirmed": "Penaltı onaylandı",
  "penalty-cancelled": "Penaltı iptal edildi",
  card: "Kart",
  "yellow-card": "Sarı kart",
  "red-card": "Kırmızı kart",
  "second-yellow-card": "İkinci sarı kart",
  substitution: "Oyuncu değişikliği",
  subst: "Oyuncu değişikliği",
  var: "VAR",
  "goal-disallowed": "Gol iptal edildi",
  "goal-cancelled": "Gol iptal edildi",
  "match-start": "Maç başladı",
  "match-ended": "Maç bitti",
  "injury-time": "Uzatma dakikaları",
  "half-time": "Devre arası",
  "full-time": "Maç bitti",
  "extra-time": "Uzatma",
  break: "Ara",
  cancelled: "İptal",
  postponed: "Ertelendi",
  abandoned: "Terk edildi",
  interrupted: "Durduruldu",
  suspended: "Askıya alındı",
  cancelledmatch: "İptal",
  kickoff: "Başlangıç",
  "no-events-yet": "Henüz olay yok",
  goalcancelled: "Gol iptal edildi",
  injury: "Sakatlık",
  "time-wasting": "Zaman geçirme",
  "yellow-red-card": "Sarı-kırmızı kart",
};

const statusLongTranslations: Record<string, string> = {
  NS: "Başlamadı",
  TBD: "Saat bekleniyor",
  "1H": "İlk yarı",
  HT: "Devre arası",
  "2H": "İkinci yarı",
  ET: "Uzatmalar",
  BT: "Ara",
  P: "Penaltı atışları",
  FT: "Maç bitti",
  AET: "Uzatmalarda bitti",
  PEN: "Penaltılarla bitti",
  INT: "Durduruldu",
  SUSP: "Askıya alındı",
  PST: "Ertelendi",
  CANC: "İptal edildi",
  ABD: "Terk edildi",
  AWD: "Hükmen sonuçlandı",
  WO: "Hükmen",
  LIVE: "Canlı",
};

const statisticLabelTranslations: Record<string, string> = {
  "ball-possession": "Topa sahip olma",
  "total-shots": "Toplam şut",
  "shots-on-goal": "İsabetli şut",
  "shots-off-goal": "İsabetsiz şut",
  "blocked-shots": "Engellenen şut",
  "shots-insidebox": "Ceza sahası içi şut",
  "shots-outsidebox": "Ceza sahası dışı şut",
  fouls: "Faul",
  "corner-kicks": "Korner",
  offsides: "Ofsayt",
  "goalkeeper-saves": "Kaleci kurtarışı",
  "total-passes": "Toplam pas",
  "passes-accurate": "İsabetli pas",
  "passes-": "Pas yüzdesi",
  "expected-goals": "Beklenen gol",
  "big-chances-created": "Net pozisyon",
  "big-chances-missed": "Kaçan net pozisyon",
  "yellow-cards": "Sarı kart",
  "red-cards": "Kırmızı kart",
  tackles: "Top kapma",
  interceptions: "Araya girme",
  "clear-cut-chances": "Açık gol pozisyonu",
};

const predictionComparisonTranslations: Record<string, string> = {
  form: "Form",
  att: "Hücum",
  def: "Savunma",
  poisson_distribution: "Poisson dağılımı",
  h2h: "İkili rekabet",
  goals: "Gol üretimi",
  total: "Toplam",
};

const looseTextReplacements: Array<[string, string]> = [
  ["Promotion", "Yükselme"],
  ["Relegation", "Düşme"],
  ["Relegation Round", "Düşme Turu"],
  ["Championship Round", "Şampiyonluk Turu"],
  ["Group Stage", "Grup Aşaması"],
  ["Knockout Stage", "Eleme Aşaması"],
  ["Qualification", "Eleme"],
  ["Qualifying", "Eleme"],
  ["Round of 16", "Son 16"],
  ["Quarter-finals", "Çeyrek final"],
  ["Semi-finals", "Yarı final"],
  ["Final", "Final"],
  ["Winner", "Galip"],
  ["Draw", "Beraberlik"],
  ["Home", "Ev"],
  ["Away", "Deplasman"],
  ["Goals", "Goller"],
  ["Shots", "Şutlar"],
];

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractFlagRegionCode(countryFlag: string): string | null {
  const match = /\/flags\/([a-z]{2})\.(?:svg|png|webp)$/i.exec(countryFlag);

  if (!match) {
    return null;
  }

  return match[1].toUpperCase();
}

export function translateCountryName(
  country: string,
  countryFlag = "",
): string {
  const override = countryNameOverrides[normalizeLookupKey(country)];

  if (override) {
    return override;
  }

  const regionCode = extractFlagRegionCode(countryFlag);

  if (regionCode) {
    const regionOverride = regionCodeOverrides[regionCode];

    if (regionOverride) {
      return regionOverride;
    }

    const translated = regionDisplayNames?.of(regionCode);

    if (translated) {
      return translated;
    }
  }

  return country;
}

export function translateProviderText(value: string): string {
  const translated = providerTextTranslations[normalizeLookupKey(value)];

  return translated ?? value;
}

export function translateLooseFootballText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  let nextValue = value;

  for (const [source, target] of looseTextReplacements) {
    nextValue = nextValue.replaceAll(source, target);
  }

  return nextValue;
}

export function translateStatisticLabel(value: string): string {
  const translated = statisticLabelTranslations[normalizeLookupKey(value)];
  return translated ?? value;
}

export function translatePredictionComparisonKey(value: string): string {
  return predictionComparisonTranslations[normalizeLookupKey(value)] ?? value;
}

export function translateStatusLong(
  statusShort: string,
  statusLong: string,
): string {
  return statusLongTranslations[statusShort] ?? translateProviderText(statusLong);
}

export function translateMatchStatus(
  match: Pick<LiveMatch, "statusShort" | "statusLong">,
): string {
  return translateStatusLong(match.statusShort, match.statusLong);
}

export function formatTranslatedEventLine(event: MatchEventSummaryItem): string {
  const minute = event.minute !== null ? `${event.minute}` : "-";
  const extra = event.extraMinute ? `+${event.extraMinute}` : "";
  const team = event.teamName ? `${event.teamName} ` : "";
  const player = event.playerName ? ` ${event.playerName}` : "";
  const type = translateProviderText(event.type);
  const detail = translateProviderText(event.detail);

  return `${minute}${extra}' ${team}${type}${player} - ${detail}`;
}
