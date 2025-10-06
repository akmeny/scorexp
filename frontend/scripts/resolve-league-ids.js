// frontend/scripts/resolve-league-ids.js
// Node 18+ (yerleşik fetch) varsayımı
import fs from "fs";

const BASE = process.env.API_BASE || "http://localhost:3001/api/leagues";

// Küçük yardımcılar
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// API-Sports /leagues -> name, country, type üzerinden sonuç döndürüyor.
// Burada hedef isim için birkaç aday desenle arayıp, bir "skor" mantığıyla
// en iyi eşleşeni seçiyoruz.
async function searchLeagues({ country, nameLike, type }) {
  const url = new URL(BASE);
  if (country) url.searchParams.set("country", country);
  if (nameLike) url.searchParams.set("name", nameLike);
  if (type) url.searchParams.set("type", type); // "League" | "Cup"
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.response) ? j.response : [];
}

function pickBestByName(response, aliases = []) {
  // response[i].league: { id, name, type, ... }, response[i].country: { name, code }
  const ali = aliases.map(norm);
  let best = null;
  let bestScore = -1;

  for (const item of response) {
    const nm = norm(item?.league?.name);
    let score = 0;
    for (const a of ali) {
      if (nm === a) score += 100;
      if (nm.includes(a)) score += 50;
      // ufak varyasyonlar
      if (nm.replace(/\s+/g, "") === a.replace(/\s+/g, "")) score += 20;
    }
    // Tür uyumu bonusu (League vs Cup)
    if (item?.league?.type && aliases.join(" ").includes("cup") && item.league.type === "Cup") score += 10;
    if (item?.league?.type && !aliases.join(" ").includes("cup") && item.league.type === "League") score += 10;

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

// Hedefler (tamamlama listesi)
// Not: Bazı global kupalar için ID’leri sabitliyoruz (bilinen değerler)
const TARGETS = [
  {
    key: "TR_SUPER_LIG",
    country: "Turkey",
    type: "League",
    aliases: ["super lig", "süper lig"],
  },
  {
    key: "TR_1_LIG",
    country: "Turkey",
    type: "League",
    aliases: ["1. lig", "tff 1. lig", "first league", "1 lig"],
  },
  {
    key: "TR_CUP",
    country: "Turkey",
    type: "Cup",
    aliases: ["turkish cup", "turkiye kupasi", "turkiye kupası", "ziraat", "cup"],
  },
  {
    key: "TR_SUPER_CUP",
    country: "Turkey",
    type: "Cup",
    aliases: ["super cup", "turkish super cup"],
  },

  // Avrupa kupaları — bilinen ID’ler fallback:
  {
    key: "UEFA_CL",
    fixedId: 2,
    country: null,
    type: "Cup",
    aliases: ["uefa champions league", "champions league"],
  },
  {
    key: "UEFA_EL",
    fixedId: 3,
    country: null,
    type: "Cup",
    aliases: ["uefa europa league", "europa league"],
  },
  {
    key: "UEFA_ECL",
    fixedId: 848,
    country: null,
    type: "Cup",
    aliases: ["uefa europa conference league", "conference league"],
  },

  // Milli takımlar & Dünya Kupası tarafı (isimler API-Sports’ta bu şekilde):
  {
    key: "WC",
    country: null,
    type: "Cup",
    aliases: ["world cup"],
  },
  {
    key: "WC_QUAL_EUROPE",
    country: null,
    type: "Cup",
    aliases: ["world cup - qualification europe", "world cup qualification europe"],
  },
  // EURO 2028 eleme/adlandırma zamanla değişebilir; leagues endpointinde farklı
  // isim varyasyonlarıyla geçer. Aşağıdaki aramalar esnek tutuldu.
  {
    key: "UEFA_EURO",
    country: null,
    type: "Cup",
    aliases: ["uefa european championship", "uefa euro", "uefa championship"],
  },
  {
    key: "UEFA_NATIONS_LEAGUE",
    country: null,
    type: "Cup",
    aliases: ["uefa nations league"],
  },

  // Büyük ligler:
  {
    key: "ENG_PREMIER_LEAGUE",
    country: "England",
    type: "League",
    aliases: ["premier league"],
  },
  {
    key: "DE_BUNDESLIGA",
    country: "Germany",
    type: "League",
    aliases: ["bundesliga"],
  },
  {
    key: "ES_LA_LIGA",
    country: "Spain",
    type: "League",
    aliases: ["la liga", "primera division", "primera división"],
  },
  {
    key: "FR_LIGUE_1",
    country: "France",
    type: "League",
    aliases: ["ligue 1"],
  },
  {
    key: "IT_SERIE_A",
    country: "Italy",
    type: "League",
    aliases: ["serie a"],
  },
  {
    key: "NL_EREDIVISIE",
    country: "Netherlands",
    type: "League",
    aliases: ["eredivisie"],
  },
  {
    key: "PT_PRIMEIRA",
    country: "Portugal",
    type: "League",
    aliases: ["primeira liga", "liga portugal", "liga betclic"],
  },
  {
    key: "AT_BUNDESLIGA",
    country: "Austria",
    type: "League",
    aliases: ["bundesliga"],
  },
];

async function resolveAll() {
  const out = [];
  for (const t of TARGETS) {
    try {
      let picked = null;
      if (t.fixedId) {
        // Bilinen ID’yi doğrulamaya çalış: isimle de arayıp en yakınını al
        const resp = await searchLeagues({
          country: t.country || undefined,
          nameLike: t.aliases?.[0] || undefined,
          type: t.type || undefined,
        });
        picked = resp.find((x) => x?.league?.id === t.fixedId) || pickBestByName(resp, t.aliases);
        if (!picked) {
          // yine de fixedId’yi güveniyoruz
          out.push({ key: t.key, id: t.fixedId, name: t.aliases[0] + " (fixed)" });
          console.log(`✔ ${t.key}: ${t.fixedId} (fixed)`);
          await sleep(100);
          continue;
        }
      } else {
        const resp = await searchLeagues({
          country: t.country || undefined,
          nameLike: t.aliases?.[0] || undefined,
          type: t.type || undefined,
        });
        picked = pickBestByName(resp, t.aliases);
      }

      if (picked?.league?.id) {
        out.push({ key: t.key, id: picked.league.id, name: picked.league.name });
        console.log(`✔ ${t.key}: ${picked.league.id} ${picked.league.name}`);
      } else {
        out.push({ key: t.key, id: null, name: null, note: "not-found" });
        console.log(`✖ ${t.key}: not found`);
      }
      await sleep(120); // çok hızlı gitmemek için
    } catch (e) {
      out.push({ key: t.key, id: null, name: null, error: e.message });
      console.log(`✖ ${t.key}: ${e.message}`);
    }
  }

  // DEFAULT_PINNED dizisini üret (sadece bulunan ID’ler)
  const defaultPinned = out
    .filter((x) => Number.isInteger(x.id))
    .map((x) => x.id);

  const payload = { resolved: out, DEFAULT_PINNED: defaultPinned };

  fs.writeFileSync("pinned-ids.json", JSON.stringify(payload, null, 2), "utf-8");
  console.log("\n📌 DEFAULT_PINNED =", JSON.stringify(defaultPinned));
  console.log("✅ pinned-ids.json written.");
}

resolveAll();