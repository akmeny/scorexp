import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Daimi sabitlenecek ligler (senin listene göre; iki doğrulama düzeltmesi):
 * - UEFA_EURO -> id: 4
 * - AT_BUNDESLIGA (Austria) -> id: 169
 */
export const PIN_LEAGUES = {
  TR_SUPER_LIG:           { id: 203, name: "Süper Lig" },
  TR_1_LIG:               { id: 204, name: "1. Lig" },
  TR_CUP:                 { id: 335, name: "Cup" },
  TR_SUPER_CUP:           { id: 529, name: "Super Cup" },
  UEFA_CL:                { id: 2,   name: "UEFA Champions League" },
  UEFA_EL:                { id: 3,   name: "UEFA Europa League" },
  UEFA_ECL:               { id: 848, name: "UEFA Europa Conference League" },
  WC:                     { id: 1,   name: "World Cup" },
  WC_QUAL_EUROPE:         { id: 32,  name: "World Cup - Qualification Europe" },
  UEFA_EURO:              { id: 4,   name: "UEFA European Championship (EURO)" },
  UEFA_NATIONS_LEAGUE:    { id: 5,   name: "UEFA Nations League" },
  ENG_PREMIER_LEAGUE:     { id: 39,  name: "Premier League" },
  DE_BUNDESLIGA:          { id: 78,  name: "Bundesliga" },
  ES_LA_LIGA:             { id: 370, name: "Primera Division" },
  FR_LIGUE_1:             { id: 61,  name: "Ligue 1" },
  IT_SERIE_A:             { id: 71,  name: "Serie A" },
  NL_EREDIVISIE:          { id: 88,  name: "Eredivisie" },
  PT_PRIMEIRA:            { id: 94,  name: "Primeira Liga" },
  AT_BUNDESLIGA:          { id: 169, name: "Bundesliga" },
};

// Verdiğin sırayla, tekrarları temizleyerek
export const DEFAULT_PINNED = Array.from(
  new Set([
    PIN_LEAGUES.TR_SUPER_LIG.id,
    PIN_LEAGUES.TR_1_LIG.id,
    PIN_LEAGUES.TR_CUP.id,
    PIN_LEAGUES.TR_SUPER_CUP.id,
    PIN_LEAGUES.UEFA_CL.id,
    PIN_LEAGUES.UEFA_EL.id,
    PIN_LEAGUES.UEFA_ECL.id,
    PIN_LEAGUES.WC.id,
    PIN_LEAGUES.WC_QUAL_EUROPE.id,
    PIN_LEAGUES.UEFA_EURO.id,
    PIN_LEAGUES.UEFA_NATIONS_LEAGUE.id,
    PIN_LEAGUES.ENG_PREMIER_LEAGUE.id,
    PIN_LEAGUES.DE_BUNDESLIGA.id,
    PIN_LEAGUES.ES_LA_LIGA.id,
    PIN_LEAGUES.FR_LIGUE_1.id,
    PIN_LEAGUES.IT_SERIE_A.id,
    PIN_LEAGUES.NL_EREDIVISIE.id,
    PIN_LEAGUES.PT_PRIMEIRA.id,
    PIN_LEAGUES.AT_BUNDESLIGA.id,
  ])
);

// ---- Storage v3: önceki tüm anahtarları tek seferde temizle ----
const LS_KEY = "scorexp-pins-v3";
const LS_BOOT = "scorexp-pins-v3-init";

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function loadPins() {
  try {
    // İlk çalıştırmada v1/v2 ve olası eski anahtarları temizle
    if (!localStorage.getItem(LS_BOOT)) {
      ["scorexp-pins", "scorexp-pins-v1", "scorexp-pins-v2"].forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
      localStorage.setItem(LS_BOOT, "1");
    }
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { added: [], removedDefaults: [] };
    const obj = JSON.parse(raw);
    const added = Array.isArray(obj?.added) ? obj.added.map(toNum).filter(Number.isFinite) : [];
    const removedDefaults = Array.isArray(obj?.removedDefaults)
      ? obj.removedDefaults.map(toNum).filter((n) => Number.isFinite(n))
      : [];
    return { added, removedDefaults };
  } catch {
    return { added: [], removedDefaults: [] };
  }
}

function savePins(pins) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(pins)); } catch {}
}

export default function usePinnedLeagues(leagues = [], matchesByLeague = {}) {
  const [pins, setPins] = useState(() => loadPins());

  // Her değişimde sanitize + persist
  useEffect(() => {
    const cleaned = {
      added: pins.added.map(toNum).filter(Number.isFinite),
      removedDefaults: pins.removedDefaults
        .map(toNum)
        .filter((n) => Number.isFinite(n) && DEFAULT_PINNED.includes(n)),
    };
    // Değişiklik varsa state’i düzelt; yoksa kaydet
    if (
      cleaned.added.length !== pins.added.length ||
      cleaned.removedDefaults.length !== pins.removedDefaults.length ||
      cleaned.added.some((v, i) => v !== pins.added[i]) ||
      cleaned.removedDefaults.some((v, i) => v !== pins.removedDefaults[i])
    ) {
      setPins(cleaned);
      return;
    }
    savePins(cleaned);
  }, [pins]);

  // Görünen ligler (bugün/ilgili tarihte maç gelenler)
  const visible = useMemo(() => {
    return leagues
      .map((l) => ({ ...l, id: toNum(l.id) })) // id’yi numaraya zorla
      .filter((l) => Number.isFinite(l.id));
  }, [leagues]);

  const visibleIdSet = useMemo(() => new Set(visible.map((l) => l.id)), [visible]);

  const isPinned = useCallback(
    (idRaw) => {
      const id = toNum(idRaw);
      if (!Number.isFinite(id)) return false;
      if (pins.added.includes(id)) return true; // kullanıcı çentiği
      if (DEFAULT_PINNED.includes(id) && !pins.removedDefaults.includes(id)) return true; // daimi
      return false;
    },
    [pins]
  );

  const togglePin = useCallback((idRaw) => {
    const id = toNum(idRaw);
    if (!Number.isFinite(id)) return;
    setPins((prev) => {
      const added = prev.added.slice();
      const removedDefaults = prev.removedDefaults.slice();
      const inAdded = added.includes(id);
      const inDefault = DEFAULT_PINNED.includes(id);
      const inRemoved = removedDefaults.includes(id);

      if (inDefault) {
        // Default’u aç/kapat
        return {
          added,
          removedDefaults: inRemoved
            ? removedDefaults.filter((x) => x !== id)
            : [...removedDefaults, id],
        };
      }
      // Kullanıcı pin’i aç/kapat
      return {
        added: inAdded ? added.filter((x) => x !== id) : [...added, id],
        removedDefaults,
      };
    });
  }, []);

  // Kullanıcının eklediği pinlerin sırasını güncelle (DnD)
  const reorderAddedPins = useCallback((orderedIds = []) => {
    setPins((prev) => {
      const orderedNums = orderedIds.map(toNum).filter((n) => prev.added.includes(n));
      const rest = prev.added.filter((n) => !orderedNums.includes(n));
      return { ...prev, added: [...orderedNums, ...rest] };
    });
  }, []);

  const orderLeagues = useCallback(() => {
    // 1) Kullanıcı pinleri (görünür olanlar) — kullanıcının verdiği sırayla
    const addedPinned = pins.added
      .map((id) => visible.find((l) => l.id === id))
      .filter(Boolean);

    const addedSet = new Set(addedPinned.map((l) => l.id));

    // 2) Default pinler (kullanıcı kaldırmadıysa) — DEFAULT_PINNED sırası
    const defPinned = DEFAULT_PINNED
      .filter((id) => !pins.removedDefaults.includes(id))
      .map((id) => visible.find((l) => l.id === id))
      .filter(Boolean)
      .filter((l) => !addedSet.has(l.id));

    const pinnedSet = new Set([...addedSet, ...defPinned.map((l) => l.id)]);

    // 3) Diğerleri — alfabetik
    const rest = visible
      .filter((l) => !pinnedSet.has(l.id))
      .sort((a, b) => {
        const ak = `${a.country || ""} ${a.name || ""}`.toLowerCase();
        const bk = `${b.country || ""} ${b.name || ""}`.toLowerCase();
        return ak < bk ? 1 : ak > bk ? -1 : 0; // (istersen ters/normal)
      });

    return [...addedPinned, ...defPinned, ...rest];
  }, [visible, pins]);

  return { isPinned, togglePin, orderLeagues, pins, DEFAULT_PINNED, reorderAddedPins, PIN_LEAGUES };
}