// frontend/src/components/MatchList.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import LeagueGroup from "./LeagueGroup";
import usePinnedLeagues from "../hooks/usePinnedLeagues";
import useLiveSocket from "../hooks/useLiveSocket";

/**
 * Liste, filtreler, pin sırası + DnD (added pinler için), SSE/polling
 */
export default function MatchList() {
  const location = useLocation();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [onlyLive, setOnlyLive] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [favs, setFavs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("scorexp-favs") || "[]"); } catch { return []; }
  });

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [fixtures, setFixtures] = useState([]);

  const eventsApiAvailableRef = useRef(true);
  const warnedOnceRef = useRef(false);

  // Detaydan dönüşte state restore
  useEffect(() => {
    const restore = location.state?.restore;
    if (restore) {
      const { date: d, onlyLive: ol, onlyFav: of } = restore || {};
      if (d) setDate(d);
      if (typeof ol !== "undefined") setOnlyLive(!!ol);
      if (typeof of !== "undefined") setOnlyFav(!!of);
    }
  }, [location.state]);

  // Topbar event’leri
  useEffect(() => {
    const onSetDate   = (e) => setDate(e.detail);
    const onOnlyLive  = (e) => setOnlyLive(!!e.detail);
    const onOnlyFav   = (e) => setOnlyFav(!!e.detail);
    window.addEventListener("scorexp:setDate", onSetDate);
    window.addEventListener("scorexp:setOnlyLive", onOnlyLive);
    window.addEventListener("scorexp:setOnlyFav", onOnlyFav);
    return () => {
      window.removeEventListener("scorexp:setDate", onSetDate);
      window.removeEventListener("scorexp:setOnlyLive", onOnlyLive);
      window.removeEventListener("scorexp:setOnlyFav", onOnlyFav);
    };
  }, []);

  // Toleranslı parser
  const parseFixturesResponse = (json) => {
    if (!json) return [];
    if (Array.isArray(json.fixtures)) return json.fixtures;
    if (Array.isArray(json.response)) return json.response;
    if (Array.isArray(json?.response?.fixtures)) return json.response.fixtures;
    if (Array.isArray(json?.data)) return json.data;
    return [];
  };

  // İlk yükleme
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setApiError(null);
        const res = await fetch(`/api/fixtures?date=${encodeURIComponent(date)}`);
        if (!res.ok) throw new Error(`fixtures http ${res.status}`);
        const json = await res.json().catch(() => ({}));
        const arr = parseFixturesResponse(json);
        if (!cancelled) setFixtures(arr);
      } catch (e) {
        if (!cancelled) { console.error("[scorexp] fixtures load error:", e); setApiError("Maçlar alınamadı."); setFixtures([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date]);

  // Soket güncellemesi → yerinde patch
  const onFixtureUpdate = useCallback((fid, payload) => {
    setFixtures((prev) => {
      let found = false;
      const next = prev.map((mm) => {
        const id = mm?.fixture?.id;
        if (id !== Number(fid) && id !== fid) return mm;
        found = true;
        const updated = { ...mm };
        if (payload?.goals) updated.goals = { ...(mm.goals || {}), ...payload.goals };
        const statusPatch = payload?.status || payload?.fixture?.status || null;
        if (statusPatch) {
          updated.fixture = {
            ...(mm.fixture || {}),
            status: { ...(mm.fixture?.status || {}), ...statusPatch },
          };
        }
        if (Array.isArray(payload?.events)) updated.events = payload.events;
        return updated;
      });
      if (!found && payload?.fixture && payload?.teams && payload?.goals) {
        next.push({ ...payload, fixture: { ...(payload.fixture || {}), id: Number(fid) || payload.fixture.id } });
      }
      return next;
    });
  }, []);

  // SSE açık (WS kapalı)
  const today = new Date().toISOString().slice(0, 10);
  const shouldLive = onlyLive || date === today;
  const liveMode = useLiveSocket({ enabled: shouldLive, onFixtureUpdate, tryWS: false });

  // Polling fallback (soket yoksa)
  useEffect(() => {
    if (!shouldLive) return;
    if (liveMode) return;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      try {
        const url = onlyLive ? `/api/fixtures?live=all` : `/api/fixtures?date=${encodeURIComponent(date)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`poll http ${res.status}`);
        let json = await res.json().catch(() => ({}));
        let arr = parseFixturesResponse(json);

        if (eventsApiAvailableRef.current && (onlyLive || date === today)) {
          const liveOnes = arr.filter((m) => {
            const s = m?.fixture?.status?.short;
            return ["1H", "2H", "ET", "LIVE", "HT"].includes(s);
          });

          const settled = await Promise.allSettled(
            liveOnes.map(async (mm) => {
              const fid = mm?.fixture?.id; if (!fid) return null;
              try {
                const r = await fetch(`/api/fixtures/events?fixture=${fid}`);
                if (!r.ok) {
                  if (r.status === 404 && eventsApiAvailableRef.current) {
                    eventsApiAvailableRef.current = false;
                    if (!warnedOnceRef.current) {
                      console.warn("[scorexp] /api/fixtures/events yok → event polling kapatıldı.");
                      warnedOnceRef.current = true;
                    }
                  }
                  return { fid, evs: [] };
                }
                const j = await r.json().catch(() => ({}));
                const evs = Array.isArray(j?.response) ? j.response : [];
                return { fid, evs };
              } catch { return { fid, evs: [] }; }
            })
          );

          const evById = new Map();
          for (const s of settled) {
            if (s.status === "fulfilled" && s.value && s.value.fid) {
              evById.set(s.value.fid, s.value.evs);
            }
          }
          if (evById.size > 0) {
            arr = arr.map((mm) => {
              const fid = mm?.fixture?.id;
              if (fid && evById.has(fid)) return { ...mm, events: evById.get(fid) };
              return mm;
            });
          }
        }

        if (!cancelled) setFixtures(arr);
      } catch (e) {
        if (!cancelled) console.debug("[scorexp] poll error:", e?.message || e);
      } finally {
        if (!cancelled) timer = setTimeout(tick, 5000);
      }
    };

    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [shouldLive, liveMode, onlyLive, date]);

  // Filtrelenmiş liste
  const filtered = useMemo(() => {
    let list = fixtures;
    if (onlyLive) {
      list = list.filter((m) => {
        const s = m?.fixture?.status?.short;
        return ["1H", "2H", "ET", "LIVE", "HT"].includes(s);
      });
    }
    if (onlyFav) {
      list = list.filter((m) => (m?.fixture?.id ? favs.includes(m.fixture.id) : false));
    }
    return list;
  }, [fixtures, onlyLive, onlyFav, favs]);

  // Lige göre grupla
  const { leagues, matchesByLeague } = useMemo(() => {
    const by = new Map();
    for (const m of filtered) {
      const lg = m?.league || {};
      const id = Number(lg?.id);
      if (!id) continue;
      if (!by.has(id)) {
        by.set(id, {
          league: { id, name: lg?.name, country: lg?.country, flag: lg?.flag, logo: lg?.logo },
          matches: [],
        });
      }
      by.get(id).matches.push(m);
    }
    const arr = Array.from(by.values());
    const mbl = {}; for (const g of arr) mbl[g.league.id] = g.matches;
    const ls = arr.map((g) => g.league);
    return { leagues: ls, matchesByLeague: mbl };
  }, [filtered]);

  // Pinned mantığı + DnD re-order
  const { isPinned, togglePin, orderLeagues, pins, reorderAddedPins } =
    usePinnedLeagues(leagues, matchesByLeague);
  const ordered = useMemo(() => orderLeagues(), [orderLeagues]);

  // DnD: sadece kullanıcının çentiklediği pinler (pins.added) sürüklenebilir
  const dragIdRef = useRef(null);

  const makeDragHandlers = (leagueId) => {
    const isAddedPinned = pins.added.includes(leagueId);
    if (!isAddedPinned) return {};
    return {
      canDrag: true,
      onDragStartLg: (e) => {
        dragIdRef.current = leagueId;
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", String(leagueId)); } catch {}
      },
      onDragOverLg: (e) => {
        if (dragIdRef.current == null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDropLg: (e) => {
        e.preventDefault();
        const fromId = dragIdRef.current ?? Number(e.dataTransfer.getData("text/plain"));
        dragIdRef.current = null;
        const toId = leagueId;
        if (fromId === toId) return;
        if (!pins.added.includes(fromId) || !pins.added.includes(toId)) return;

        const arr = pins.added.slice();
        const fromIdx = arr.indexOf(fromId);
        const toIdx = arr.indexOf(toId);
        if (fromIdx === -1 || toIdx === -1) return;

        arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, fromId);
        reorderAddedPins(arr);
      },
    };
  };

  // Geri dönüş state'i
  const browseState = useMemo(() => ({ date, onlyLive, onlyFav }), [date, onlyLive, onlyFav]);

  // favs depola
  useEffect(() => {
    try { localStorage.setItem("scorexp-favs", JSON.stringify(favs)); } catch {}
  }, [favs]);

  if (loading) return <div className="p-3">Yükleniyor...</div>;
  if (apiError) return <div className="p-3">{apiError}</div>;
  if (!Array.isArray(ordered) || ordered.length === 0) {
    return <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Bu kriterlerde maç bulunamadı.</div>;
  }

  return (
    <div className="space-y-2">
      {ordered.map((lg) => (
        <LeagueGroup
          key={lg.id}
          league={lg}
          matches={matchesByLeague[lg.id] || []}
          favs={favs}
          setFavs={setFavs}
          isPinned={isPinned}
          togglePin={togglePin}
          browseState={browseState}
          {...makeDragHandlers(lg.id)}
        />
      ))}
    </div>
  );
}