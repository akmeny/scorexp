# ScoreXP

Canlı futbol skorları için React frontend + Fastify backend. Highlightly Football API backend tarafında saklanan anahtarla çağrılır; tarayıcı dış API'ye doğrudan istek atmaz.

## Mimari

- `apps/api`: Fastify API, Highlightly adapter, Redis/memory hot cache, durable finished-match store.
- `apps/web`: Vite + React canlı skor arayüzü.
- `docs/data-flow.md`: veri akışı ve yenileme politikası diyagramları.

## Veri Yenileme Modeli

- Canlı maçlar: provider TTL `180` saniye.
- Başlamamış maçlar: provider TTL `900` saniye.
- Bitmiş/geçmiş günler: durable store'a kilitlenir, provider'a tekrar gidilmez.
- Frontend: sayfayı yenilemez; `ETag`/checksum ile sessiz veri fetch yapar.

## Local Kurulum

```bash
npm install
npm run dev
```

Opsiyonel Redis:

```bash
docker compose up -d redis
```

Backend: `http://localhost:4000`  
Frontend: `http://localhost:5173`

## Environment

Root `.env` local geliştirme için oluşturulur ve git'e alınmaz. Örnek değerler `.env.example` içinde.

Frontend için:

```bash
cp apps/web/.env.example apps/web/.env
```

## Deploy

Backend Render için `render.yaml` ile tanımlandı. Üretimde Render Key Value hem hot cache hem de bitmiş maçların durable write-once store'u olarak `REDIS_URL` üzerinden bağlanır.

Frontend Vercel için `apps/web/vercel.json` hazır. Production API fallback adresi `https://scorexp-api.onrender.com`; farklı Render URL'i kullanılırsa Vercel'de `VITE_API_BASE_URL` set edilmelidir.

## API

```http
GET /api/health
GET /api/v1/football/scoreboard?date=2026-05-02&timezone=Europe/Istanbul&view=all
GET /api/v1/football/matches/:id/detail?timezone=Europe/Istanbul
GET /api/v1/football/flow
```
