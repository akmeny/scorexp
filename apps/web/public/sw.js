const DB_NAME = "scorexp-sw-state";
const DB_VERSION = 1;
const STORE_NAME = "kv";
const FAVORITE_CONFIG_KEY = "favorite-monitor-config";
const FAVORITE_MONITOR_TAG = "scorexp-favorite-monitor";
const FAVORITE_MONITOR_STALE_MS = 120_000;
const notificationIcon = "/icons/icon-192.png";
const notificationBadge = "/icons/notification-badge.png";
const notificationImage = "/icons/icon-512.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SCOREXP_FAVORITES_CONFIG") return;
  event.waitUntil(updateFavoriteConfig(event.data.payload));
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePushEvent(event));
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== FAVORITE_MONITOR_TAG) return;
  event.waitUntil(runFavoriteMonitor("periodicsync"));
});

self.addEventListener("sync", (event) => {
  if (event.tag !== FAVORITE_MONITOR_TAG) return;
  event.waitUntil(runFavoriteMonitor("sync"));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const scorexpClient = clients.find((client) => "focus" in client && new URL(client.url).origin === self.location.origin);
      if (scorexpClient) return scorexpClient.focus();
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

async function handlePushEvent(event) {
  const payload = readPushPayload(event);
  await showPushNotification(payload, "push");
}

function readPushPayload(event) {
  if (!event.data) return {};

  try {
    return event.data.json();
  } catch {
    return {
      title: "ScoreXP",
      body: event.data.text()
    };
  }
}

async function showPushNotification(payload, source) {
  const hasVisibleClient = await hasVisibleScorexpClient();
  if (hasVisibleClient) return;

  const title = cleanString(payload?.title) || "ScoreXP";
  const body = cleanString(payload?.body) || "Favori maçında yeni gelişme var.";

  await self.registration.showNotification(title, {
    body,
    icon: cleanString(payload?.icon) || notificationIcon,
    badge: cleanString(payload?.badge) || notificationBadge,
    image: cleanString(payload?.image) || notificationImage,
    tag: cleanString(payload?.tag) || `scorexp:${Date.now()}`,
    renotify: payload?.renotify !== false,
    requireInteraction: Boolean(payload?.requireInteraction),
    timestamp: Number.isFinite(payload?.timestamp) ? payload.timestamp : Date.now(),
    vibrate: Array.isArray(payload?.vibrate) ? payload.vibrate : [90, 45, 90],
    silent: false,
    data: {
      ...(payload?.data && typeof payload.data === "object" ? payload.data : {}),
      source,
      url: cleanString(payload?.data?.url) || "/"
    },
    actions: normalizeActions(payload?.actions)
  });
}

async function updateFavoriteConfig(payload) {
  const previous = await readValue(FAVORITE_CONFIG_KEY);
  await saveValue(FAVORITE_CONFIG_KEY, normalizeFavoriteConfig(payload, previous));
}

async function runFavoriteMonitor(source) {
  const config = await readValue(FAVORITE_CONFIG_KEY);
  if (!config?.notificationsEnabled || config.notificationPermission !== "granted" || !config.favoriteIds?.length) return;
  if (!config.apiBase || !config.date || !config.timezone) return;

  const url = new URL("/api/v1/football/scoreboard", config.apiBase);
  url.searchParams.set("date", config.date);
  url.searchParams.set("timezone", config.timezone);
  url.searchParams.set("view", "all");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return;

  const snapshot = await response.json();
  const now = Date.now();
  const staleGap =
    config.lastCheckedAt !== null &&
    now - config.lastCheckedAt > Math.max(FAVORITE_MONITOR_STALE_MS, Number(config.refreshSeconds || 60) * 3000);
  const canNotify = config.lastCheckedAt !== null && !staleGap;
  const favoriteIds = new Set(config.favoriteIds);
  const previousSnapshots = config.snapshots && typeof config.snapshots === "object" ? config.snapshots : {};
  const nextSnapshots = {};
  const matches = flattenMatches(snapshot);

  for (const match of matches) {
    if (!favoriteIds.has(match.id)) continue;

    const nextSnapshot = favoriteSnapshot(match);
    const previousSnapshot = previousSnapshots[match.id];

    if (previousSnapshot && canNotify) {
      const events = favoriteMatchNotificationEvents(previousSnapshot, nextSnapshot, match);
      for (const item of events) {
        await showFavoriteNotification(item.title, item.body, match, source);
      }
    }

    nextSnapshots[match.id] = nextSnapshot;
  }

  await saveValue(FAVORITE_CONFIG_KEY, {
    ...config,
    snapshots: nextSnapshots,
    lastCheckedAt: now
  });
}

function normalizeFavoriteConfig(value, previous) {
  const snapshots = Object.fromEntries(Array.isArray(value?.snapshots) ? value.snapshots : []);

  return {
    apiBase: typeof value?.apiBase === "string" ? value.apiBase : "",
    date: typeof value?.date === "string" ? value.date : "",
    timezone: typeof value?.timezone === "string" ? value.timezone : "Europe/Istanbul",
    favoriteIds: Array.isArray(value?.favoriteIds) ? value.favoriteIds.filter((item) => typeof item === "string") : [],
    snapshots,
    notificationsEnabled: Boolean(value?.notificationsEnabled),
    notificationPermission: value?.notificationPermission ?? null,
    refreshSeconds: Number.isFinite(value?.refreshSeconds) ? value.refreshSeconds : 60,
    lastCheckedAt: Number.isFinite(previous?.lastCheckedAt) ? previous.lastCheckedAt : null,
    lastConfiguredAt: Date.now()
  };
}

function flattenMatches(snapshot) {
  if (!Array.isArray(snapshot?.leagues)) return [];
  return snapshot.leagues.flatMap((league) => (Array.isArray(league.matches) ? league.matches : []));
}

function favoriteSnapshot(match) {
  return {
    scoreKey: scoreSnapshot(match),
    redCardsHome: match.redCards?.home ?? 0,
    redCardsAway: match.redCards?.away ?? 0,
    statusGroup: match.status?.group ?? "unknown",
    statusDescription: match.status?.description ?? ""
  };
}

function favoriteMatchNotificationEvents(previous, current, match) {
  const events = [];
  const scoreSide = scoreIncreaseSide(previous.scoreKey, current.scoreKey);
  const cancelledGoalSide = scoreDecreaseSide(previous.scoreKey, current.scoreKey);

  for (const side of expandSides(scoreSide)) {
    const team = side === "home" ? match.homeTeam.name : match.awayTeam.name;
    events.push({
      title: "Gol",
      body: `${team} gol attı. Skor: ${formatNotificationScore(match)}`
    });
  }

  for (const side of expandSides(cancelledGoalSide)) {
    const team = side === "home" ? match.homeTeam.name : match.awayTeam.name;
    events.push({
      title: "Gol iptal",
      body: `${team} golü iptal edildi. Skor: ${formatNotificationScore(match)}`
    });
  }

  if (current.redCardsHome > previous.redCardsHome) {
    events.push({
      title: "Kırmızı kart",
      body: `${match.homeTeam.name} kırmızı kart gördü.`
    });
  }

  if (current.redCardsAway > previous.redCardsAway) {
    events.push({
      title: "Kırmızı kart",
      body: `${match.awayTeam.name} kırmızı kart gördü.`
    });
  }

  if (current.statusGroup === "live" && previous.statusGroup !== "live") {
    events.push({
      title: "Maç başladı",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} başladı.`
    });
  }

  if (isSecondHalf(current.statusDescription) && !isSecondHalf(previous.statusDescription)) {
    events.push({
      title: "İkinci yarı başladı",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} maçında ikinci yarı başladı.`
    });
  }

  if (current.statusGroup === "finished" && previous.statusGroup !== "finished") {
    events.push({
      title: "Maç bitti",
      body: `${match.homeTeam.name} - ${match.awayTeam.name} bitti. Skor: ${formatNotificationScore(match)}`
    });
  }

  return events;
}

async function showFavoriteNotification(title, body, match, source) {
  await showPushNotification(
    {
      title: `ScoreXP - ${title}`,
      body,
      icon: notificationIcon,
      badge: notificationBadge,
      image: notificationImage,
      tag: `scorexp-fav:${match.id}:${title}:${Date.now()}`,
      data: {
        matchId: match.id,
        source,
        url: "/"
      },
      actions: [{ action: "open", title: "Maçı aç" }]
    },
    source
  );
}

async function hasVisibleScorexpClient() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  return clients.some((client) => client.visibilityState === "visible" && new URL(client.url).origin === self.location.origin);
}

function scoreSnapshot(match) {
  return `${match.score?.home ?? ""}:${match.score?.away ?? ""}`;
}

function scoreIncreaseSide(previous, current) {
  const [previousHome, previousAway] = previous.split(":").map(toScoreNumber);
  const [currentHome, currentAway] = current.split(":").map(toScoreNumber);
  const homeIncreased = currentHome > previousHome;
  const awayIncreased = currentAway > previousAway;

  if (homeIncreased && awayIncreased) return "both";
  if (homeIncreased) return "home";
  if (awayIncreased) return "away";
  return null;
}

function scoreDecreaseSide(previous, current) {
  const [previousHome, previousAway] = previous.split(":").map(toScoreNumber);
  const [currentHome, currentAway] = current.split(":").map(toScoreNumber);
  const awayDecreased = currentAway < previousAway;
  const homeDecreased = currentHome < previousHome;

  if (homeDecreased && awayDecreased) return "both";
  if (homeDecreased) return "home";
  if (awayDecreased) return "away";
  return null;
}

function expandSides(side) {
  if (side === "both") return ["home", "away"];
  if (side === "home" || side === "away") return [side];
  return [];
}

function toScoreNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNotificationScore(match) {
  if (match.score?.home === null || match.score?.away === null) return "-";
  return `${match.score?.home ?? "-"}-${match.score?.away ?? "-"}`;
}

function isSecondHalf(description) {
  const value = String(description ?? "").toLocaleLowerCase("tr-TR");
  return value.includes("second half") || value.includes("2nd half") || value.includes("2. yar") || value.includes("ikinci yar");
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeActions(value) {
  if (!Array.isArray(value)) return [{ action: "open", title: "Maçı aç" }];
  return value
    .filter((item) => typeof item?.action === "string" && typeof item?.title === "string")
    .slice(0, 2)
    .map((item) => ({ action: item.action, title: item.title, icon: cleanString(item.icon) || undefined }));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readValue(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function saveValue(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
