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
  "normal-goal": "Normal Gol",
  "own-goal": "Kendi Kalesine Gol",
  penalty: "Penaltı",
  "missed-penalty": "Kaçan Penaltı",
  card: "Kart",
  "yellow-card": "Sarı Kart",
  "red-card": "Kırmızı Kart",
  "second-yellow-card": "İkinci Sarı Kart",
  substitution: "Oyuncu Değişikliği",
  subst: "Oyuncu Değişikliği",
  var: "VAR",
  "goal-disallowed": "Gol İptal",
  "goal-cancelled": "Gol İptal",
  "penalty-confirmed": "Penaltı Onaylandı",
  "penalty-cancelled": "Penaltı İptal",
  "match-start": "Maç Başladı",
  "match-ended": "Maç Bitti",
  "injury-time": "Uzatma Dakikaları",
  "half-time": "Devre Arası",
  "full-time": "Maç Bitti",
  "extra-time": "Uzatma",
  break: "Ara",
  cancelled: "İptal",
  postponed: "Ertelendi",
  abandoned: "Terk Edildi",
  interrupted: "Durduruldu",
  suspended: "Askıya Alındı",
  cancelledmatch: "İptal",
  kickoff: "Başlangıç",
  "no-events-yet": "Henüz olay yok",
};

const statusLongTranslations: Record<string, string> = {
  NS: "Başlamadı",
  TBD: "Saat Bekleniyor",
  "1H": "İlk Yarı",
  HT: "Devre Arası",
  "2H": "İkinci Yarı",
  ET: "Uzatmalar",
  BT: "Ara",
  P: "Penaltı Atışları",
  FT: "Maç Bitti",
  AET: "Uzatmalarda Bitti",
  PEN: "Penaltılarla Bitti",
  INT: "Durduruldu",
  SUSP: "Askıya Alındı",
  PST: "Ertelendi",
  CANC: "İptal Edildi",
  ABD: "Terk Edildi",
  AWD: "Hükmen Sonuçlandı",
  WO: "Hükmen",
  LIVE: "Canlı",
};

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

export function translateStatusLong(
  statusShort: string,
  statusLong: string,
): string {
  return statusLongTranslations[statusShort] ?? translateProviderText(statusLong);
}

export function translateMatchStatus(match: Pick<LiveMatch, "statusShort" | "statusLong">): string {
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
