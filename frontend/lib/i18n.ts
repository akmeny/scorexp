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
  world: "D\u00FCnya",
  "north-america": "Kuzey Amerika",
  "south-america": "G\u00FCney Amerika",
  "central-america": "Orta Amerika",
  england: "\u0130ngiltere",
  scotland: "\u0130sko\u00E7ya",
  wales: "Galler",
  "northern-ireland": "Kuzey \u0130rlanda",
  ireland: "\u0130rlanda",
  "republic-of-ireland": "\u0130rlanda Cumhuriyeti",
  "czech-republic": "\u00C7ekya",
  "south-korea": "G\u00FCney Kore",
  "north-korea": "Kuzey Kore",
  "saudi-arabia": "Suudi Arabistan",
  "united-arab-emirates": "Birle\u015Fik Arap Emirlikleri",
  "bosnia-and-herzegovina": "Bosna Hersek",
  bosnia: "Bosna Hersek",
  "ivory-coast": "Fildi\u015Fi Sahili",
  "dr-congo": "Kongo Demokratik Cumhuriyeti",
  "cape-verde": "Ye\u015Fil Burun Adalar\u0131",
  "faroe-islands": "Faroe Adalar\u0131",
  "hong-kong": "Hong Kong",
  kosovo: "Kosova",
  macedonia: "Kuzey Makedonya",
  "new-zealand": "Yeni Zelanda",
  "south-africa": "G\u00FCney Afrika",
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
  "solomon-islands": "Solomon Adalar\u0131",
  "south-sudan": "G\u00FCney Sudan",
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
  penalty: "Penalt\u0131",
  "missed-penalty": "Ka\u00E7an Penalt\u0131",
  card: "Kart",
  "yellow-card": "Sar\u0131 Kart",
  "red-card": "K\u0131rm\u0131z\u0131 Kart",
  "second-yellow-card": "\u0130kinci Sar\u0131 Kart",
  substitution: "Oyuncu De\u011Fi\u015Fikli\u011Fi",
  subst: "Oyuncu De\u011Fi\u015Fikli\u011Fi",
  var: "VAR",
  "goal-disallowed": "Gol \u0130ptal",
  "goal-cancelled": "Gol \u0130ptal",
  "penalty-confirmed": "Penalt\u0131 Onayland\u0131",
  "penalty-cancelled": "Penalt\u0131 \u0130ptal",
  "match-start": "Ma\u00E7 Ba\u015Flad\u0131",
  "match-ended": "Ma\u00E7 Bitti",
  "injury-time": "Uzatma Dakikalar\u0131",
  "half-time": "Devre Aras\u0131",
  "full-time": "Ma\u00E7 Bitti",
  "extra-time": "Uzatma",
  break: "Ara",
  cancelled: "\u0130ptal",
  postponed: "Ertelendi",
  abandoned: "Terk Edildi",
  interrupted: "Durduruldu",
  suspended: "Ask\u0131ya Al\u0131nd\u0131",
  cancelledmatch: "\u0130ptal",
  kickoff: "Ba\u015Flang\u0131\u00E7",
  "no-events-yet": "Hen\u00FCz olay yok",
};

const statusLongTranslations: Record<string, string> = {
  NS: "Ba\u015Flamad\u0131",
  TBD: "Saat Bekleniyor",
  "1H": "\u0130lk Yar\u0131",
  HT: "Devre Aras\u0131",
  "2H": "\u0130kinci Yar\u0131",
  ET: "Uzatmalar",
  BT: "Ara",
  P: "Penalt\u0131 At\u0131\u015Flar\u0131",
  FT: "Ma\u00E7 Bitti",
  AET: "Uzatmalarda Bitti",
  PEN: "Penalt\u0131larla Bitti",
  INT: "Durduruldu",
  SUSP: "Ask\u0131ya Al\u0131nd\u0131",
  PST: "Ertelendi",
  CANC: "\u0130ptal Edildi",
  ABD: "Terk Edildi",
  AWD: "H\u00FCkmen Sonu\u00E7land\u0131",
  WO: "H\u00FCkmen",
  LIVE: "Canl\u0131",
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
