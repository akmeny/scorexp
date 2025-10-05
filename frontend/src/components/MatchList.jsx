import React, { useEffect, useMemo, useRef, useState } from "react";
import LeagueGroup from "./LeagueGroup";
import useSocket from "../useSocket";

export default function MatchList() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [fixturesById, setFixturesById] = useState(new Map());
  const [onlyLive, setOnlyLive] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [favs, setFavs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("scorexp-favs") || "[]");
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const abortRef = useRef(null);

  // --- Topbar event dinleyicileri
  useEffect(() => {
    const onSetDate = (e) => setDate(e.detail);
    const onSetLive = (e) => setOnlyLive(!!e.detail);
    const onSetFav = (e) => setOnlyFav(!!e.detail);

    window.addEventListener("scorexp:setDate", onSetDate);
    window.addEventListener("scorexp:setOnlyLive", onSetLive);
    window.addEventListener("scorexp:setOnlyFav", onSetFav);

    return () => {
      window.removeEventListener("scorexp:setDate", onSetDate);
      window.removeEventListener("scorexp:setOnlyLive", onSetLive);
      window.removeEventListener("scorexp:setOnlyFav", onSetFav);
    };
  }, []);

  // --- REST: belirtilen günün fixtürleri
  async function loadDay(d) {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const r = await fetch(`/api/fixtures?date=${d}`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const byId = new Map();
      for (const f of json.fixtures || []) {
        const id = f?.fixture?.id;
        if (id) byId.set(id, f);
      }
      setFixturesById(byId);
    } catch (e) {
      console.error("loadDay error", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDay(date);
  }, [date]);

  // --- Socket: tam liste
  useSocket("matchListFull", (payload) => {
    if (!payload || payload.date !== date) return;
    const byId = new Map();
    for (const f of payload.fixtures || []) {
      const id = f?.fixture?.id;
      if (id) byId.set(id, f);
    }
    setFixturesById(byId);
  });

  // --- Socket: 5s patch
  useSocket("livePatch", (payload) => {
    if (!payload || payload.date !== date) return;
    if (!Array.isArray(payload.fixtures)) return;
    setFixturesById((prev) => {
      const next = new Map(prev);
      for (const f of payload.fixtures) {
        const id = f?.fixture?.id;
        if (id) next.set(id, f);
      }
      return next;
    });
  });

  // --- Favori persist
  useEffect(() => {
    localStorage.setItem("scorexp-favs", JSON.stringify(favs));
  }, [favs]);

  // --- Listeleme
  const fixturesArr = useMemo(() => Array.from(fixturesById.values()), [fixturesById]);

  const filtered = useMemo(() => {
    let arr = fixturesArr;

    // Favoriler
    if (onlyFav) {
      arr = arr.filter((f) => favs.includes(f?.fixture?.id));
    }

    // Canlı (sadece gerçekten oynananlar + HT)
    if (onlyLive) {
      const liveStatuses = ["1H", "2H", "ET", "BT", "LIVE", "P", "HT"];
      arr = arr.filter((f) => {
        const s = f?.fixture?.status?.short;
        return liveStatuses.includes(s);
      });
    }

    return arr.sort((a, b) => {
      const t1 = a?.fixture?.timestamp || 0;
      const t2 = b?.fixture?.timestamp || 0;
      return t1 - t2;
    });
  }, [fixturesArr, onlyFav, favs, onlyLive]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const f of filtered) {
      const lg = f?.league || {};
      const key = `${lg.id || "0"}|${lg.country || ""}|${lg.name || ""}|${lg.flag || ""}`;
      if (!map.has(key)) map.set(key, { league: lg, items: [] });
      map.get(key).items.push(f);
    }
    return Array.from(map.values());
  }, [filtered]);

  if (loading) {
    return <div className="p-3 text-sm opacity-70">Yükleniyor…</div>;
  }

  if (filtered.length === 0) {
    return <div className="p-3 text-sm opacity-70">Kriterlere uygun maç bulunamadı.</div>;
  }

  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <LeagueGroup
          key={i}
          league={g.league}
          matches={g.items}
          favs={favs}
          setFavs={setFavs}
        />
      ))}
    </div>
  );
}