// server.js
import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import dayjs from "dayjs";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const PORT = process.env.PORT || 3001;

// === API-Sports config ===
const API = {
  base: "https://v3.football.api-sports.io",
  key: process.env.API_SPORTS_KEY,
  headers() {
    return { "x-apisports-key": this.key };
  },
  params(extra = {}, withTZ = true) {
    return withTZ ? { timezone: "Europe/Istanbul", ...extra } : { ...extra };
  },
};

function ensureApiKey(res) {
  if (!API.key || String(API.key).trim() === "") {
    res.status(500).json({
      ok: false,
      error:
        "Missing API_SPORTS_KEY. Lütfen .env içine API_SPORTS_KEY koyup server'ı yeniden başlat.",
    });
    return false;
  }
  return true;
}

// -------------------------
// Server-side fixture state
// -------------------------
const fixtureState = new Map();
const now = () => Date.now();

function evSig(ev) {
  return [
    ev?.time?.elapsed ?? "",
    ev?.team?.id ?? "",
    ev?.type ?? "",
    ev?.detail ?? "",
    ev?.player?.id ?? "",
  ].join("|");
}

async function fetchFromApi(endpoint, params = {}, { withTZ = true } = {}) {
  const url = `${API.base}${endpoint}`;
  const finalParams = API.params(params, withTZ);
  console.log("FETCH ->", endpoint, finalParams);
  const { data } = await axios.get(url, {
    headers: API.headers(),
    params: finalParams,
  });
  return data?.response ?? [];
}

async function fetchFixtures({ dateISO, liveOnly = false }) {
  const params = liveOnly ? { live: "all" } : { date: dateISO };
  return await fetchFromApi("/fixtures", params, { withTZ: true });
}

async function fetchEvents(fixtureId) {
  return await fetchFromApi("/fixtures/events", { fixture: fixtureId }, { withTZ: false });
}

function applyEventsToState(fix, events) {
  const id = fix?.fixture?.id;
  if (!id) return;
  const st = fixtureState.get(id) || {
    lastGoals: { home: 0, away: 0 },
    reds: { home: 0, away: 0 },
    effects: {
      danger: { side: null, until: 0 },
      penalty: { side: null, until: 0, missed: false },
      var: { side: null, until: 0 },
      goalFlashUntil: 0,
    },
    lastEventsSig: new Set(),
    lastEventsFetchAt: 0,
  };

  const home = fix?.teams?.home || {};
  const away = fix?.teams?.away || {};
  const n = now();

  for (const ev of events) {
    const sig = evSig(ev);
    if (st.lastEventsSig.has(sig)) continue;
    st.lastEventsSig.add(sig);

    const t = (ev?.type || "").toLowerCase();
    const d = (ev?.detail || "").toLowerCase();
    const side =
      ev?.team?.id === home.id || ev?.team?.name === home.name
        ? "home"
        : ev?.team?.id === away.id || ev?.team?.name === away.name
        ? "away"
        : null;

    if (t === "card" && (d.includes("red") || d.includes("second yellow"))) {
      if (side) st.reds[side] = (st.reds[side] || 0) + 1;
    }

    if (t.includes("var") || d.includes("var")) {
      st.effects.var = {
        side: side || "both",
        until: Math.max(st.effects.var.until, n + 20000),
      };
    }

    if (t.includes("penalty") || d.includes("penalty")) {
      const missed = d.includes("miss") || d.includes("save");
      st.effects.penalty = { side: side || null, until: n + 10000, missed };
    }

    if (t === "goal") {
      if (side) st.effects.danger = { side, until: n + 10000 };
    }

    if (d.includes("disallowed") || d.includes("cancel")) {
      st.effects.danger = { side: null, until: 0 };
    }
  }

  fixtureState.set(id, st);
}

async function pollLoop() {
  try {
    const todayISO = dayjs().format("YYYY-MM-DD");
    const liveFixtures = await fetchFixtures({
      dateISO: todayISO,
      liveOnly: true,
    });

    for (const f of liveFixtures) {
      const id = f?.fixture?.id;
      if (!id) continue;

      const st = fixtureState.get(id) || {
        lastGoals: { home: 0, away: 0 },
        reds: { home: 0, away: 0 },
        effects: {
          danger: { side: null, until: 0 },
          penalty: { side: null, until: 0, missed: false },
          var: { side: null, until: 0 },
          goalFlashUntil: 0,
        },
        lastEventsSig: new Set(),
        lastEventsFetchAt: 0,
      };

      const gH = Number(f?.goals?.home ?? 0);
      const gA = Number(f?.goals?.away ?? 0);

      if (gH !== st.lastGoals.home || gA !== st.lastGoals.away) {
        st.effects.goalFlashUntil = now() + 10000;
        st.lastGoals = { home: gH, away: gA };
      }

      fixtureState.set(id, st);
    }

    const budgetPerTick = 10;
    const toFetch = [...liveFixtures]
      .filter((f) => {
        const st = fixtureState.get(f?.fixture?.id);
        return !st || now() - (st.lastEventsFetchAt || 0) > 12000;
      })
      .slice(0, budgetPerTick);

    for (const f of toFetch) {
      const id = f?.fixture?.id;
      if (!id) continue;
      let events = [];
      try {
        events = await fetchEvents(id);
      } catch (e) {}
      applyEventsToState(f, events);
      const st = fixtureState.get(id);
      if (st) st.lastEventsFetchAt = now();
    }

    const todayAll = await fetchFixtures({
      dateISO: todayISO,
      liveOnly: false,
    });

    const enriched = todayAll.map((f) => {
      const id = f?.fixture?.id;
      const st = fixtureState.get(id);
      if (!st) return f;
      const fx = {
        ...f,
        _effects: {
          ...st.effects,
          reds: { ...st.reds },
        },
      };
      // 🔎 Debug log
      console.log("EMIT FIXTURE", fx.fixture.id, fx._effects);
      return fx;
    });

    // 🔥 Burayı değiştirdik
    io.emit("matchListFull", { date: todayISO, fixtures: enriched });
    io.emit("livePatch", { date: todayISO, fixtures: enriched });

  } catch (e) {
    console.error("pollLoop error:", e?.response?.status || e?.message || e);
  } finally {
    setTimeout(pollLoop, 5000);
  }
}

if (API.key) pollLoop();

// -------------------------
// REST: Fixtures
// -------------------------
app.get("/api/fixtures", async (req, res) => {
  if (!ensureApiKey(res)) return;

  const fixtureId = req.query.fixture;
  const dateISO = req.query.date || dayjs().format("YYYY-MM-DD");

  try {
    if (fixtureId) {
      const arr = await fetchFromApi("/fixtures", { id: fixtureId }, { withTZ: true });
      const enriched = Array.isArray(arr)
        ? arr.map((f) => {
            const st = fixtureState.get(f?.fixture?.id);
            return st
              ? { ...f, _effects: { ...st.effects, reds: { ...st.reds } } }
              : f;
          })
        : arr;
      return res.json({ ok: true, fixtures: enriched });
    }

    const arr = await fetchFixtures({ dateISO, liveOnly: false });
    const enriched = Array.isArray(arr)
      ? arr.map((f) => {
          const st = fixtureState.get(f?.fixture?.id);
          return st
            ? { ...f, _effects: { ...st.effects, reds: { ...st.reds } } }
            : f;
        })
      : arr;
    res.json({ ok: true, date: dateISO, fixtures: enriched });
  } catch (err) {
    res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { ok: false, error: err?.message });
  }
});

// -------------------------
// REST: Statistics
// -------------------------
app.get("/api/statistics", async (req, res) => {
  if (!ensureApiKey(res)) return;
  const fixture = parseInt(req.query.fixture, 10);
  if (!fixture)
    return res.status(400).json({ ok: false, error: "fixture required" });

  try {
    let stats = await fetchFromApi("/fixtures/statistics", { fixture }, { withTZ: false });
    if (!stats || stats.length === 0) {
      const firstHalf = await fetchFromApi("/fixtures/statistics", { fixture, half: 1 }, { withTZ: false });
      const secondHalf = await fetchFromApi("/fixtures/statistics", { fixture, half: 2 }, { withTZ: false });
      stats = [...(firstHalf || []), ...(secondHalf || [])];
    }
    console.log("DEBUG /api/statistics:", Array.isArray(stats) ? stats.length : 0);
    res.json({ ok: true, response: stats });
  } catch (err) {
    res.status(err?.response?.status || 500).json({ ok: false, error: err?.message });
  }
});

// -------------------------
// REST: H2H
// -------------------------
app.get("/api/h2h", async (req, res) => {
  if (!ensureApiKey(res)) return;
  const h2h = req.query.h2h;
  if (!h2h) return res.status(400).json({ ok: false, error: "h2h required" });
  try {
    const resp = await fetchFromApi("/fixtures/headtohead", { h2h }, { withTZ: false });
    res.json({ ok: true, response: resp });
  } catch (err) {
    res.status(err?.response?.status || 500).json({ ok: false, error: err?.message });
  }
});

// -------------------------
// REST: Form
// -------------------------
app.get("/api/form", async (req, res) => {
  if (!ensureApiKey(res)) return;
  const team = parseInt(req.query.team, 10);
  const last = parseInt(req.query.last || "5", 10);
  if (!team)
    return res.status(400).json({ ok: false, error: "team required" });
  try {
    const resp = await fetchFromApi("/fixtures", { team, last }, { withTZ: true });
    res.json({ ok: true, response: resp });
  } catch (err) {
    res.status(err?.response?.status || 500).json({ ok: false, error: err?.message });
  }
});

// -------------------------
// REST: Standings
// -------------------------
app.get("/api/standings", async (req, res) => {
  if (!ensureApiKey(res)) return;
  const league = parseInt(req.query.league, 10);
  const season = parseInt(req.query.season, 10);
  if (!league || !season)
    return res.status(400).json({ ok: false, error: "league & season required" });

  try {
    const resp = await fetchFromApi("/standings", { league, season }, { withTZ: false });
    console.log("DEBUG /api/standings:", Array.isArray(resp) ? resp.length : 0);
    res.json({ ok: true, response: resp });
  } catch (err) {
    res.status(err?.response?.status || 500).json({ ok: false, error: err?.message });
  }
});

// -------------------------
// Socket.IO chat
// -------------------------
const globalChat = [];
const matchChats = new Map();
let onlineCount = 0;

io.on("connection", (socket) => {
  onlineCount++;
  io.emit("onlineCount", onlineCount);

  socket.emit("globalChatHistory", globalChat.slice(-50));

  socket.on("joinMatch", (matchId) => {
    socket.join(`match:${matchId}`);
    const hist = matchChats.get(matchId) || [];
    socket.emit("matchChatHistory", hist.slice(-100));
  });

  socket.on("sendGlobalMessage", (msg) => {
    const clean = {
      userId: msg?.userId || "guest",
      text: String(msg?.text || "").slice(0, 500),
      ts: Date.now(),
      special: !!msg?.special,
    };
    globalChat.push(clean);
    io.emit("newGlobalMessage", clean);
  });

  socket.on("sendMatchMessage", ({ matchId, text, userId, special }) => {
    const room = `match:${matchId}`;
    const arr = matchChats.get(matchId) || [];
    const clean = {
      userId: userId || "guest",
      text: String(text || "").slice(0, 500),
      ts: Date.now(),
      special: !!special,
    };
    arr.push(clean);
    matchChats.set(matchId, arr);
    io.to(room).emit("newMatchMessage", clean);
  });

  socket.on("disconnect", () => {
    onlineCount = Math.max(0, onlineCount - 1);
    io.emit("onlineCount", onlineCount);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Backend + Socket.IO running: http://localhost:${PORT}`);
  console.log("API key present:", !!API.key);
});