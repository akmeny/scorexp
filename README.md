# ScoreXP

ScoreXP is a real-data live football scores app with:

- `frontend/`: Next.js + TypeScript
- `backend/`: Fastify + Socket.IO + TypeScript
- live football data from API-Sports at `https://v3.football.api-sports.io`

The frontend never calls API-Sports directly. All provider access stays in the backend through `APISPORTS_KEY`.

## Folder structure

```text
scorexp/
|-- backend/
|   |-- src/
|   |   |-- config/
|   |   |-- lib/
|   |   |-- modules/
|   |   |   |-- matches/
|   |   |   `-- socket/
|   |   `-- types/
|   |-- .env
|   |-- .env.example
|   `-- package.json
|-- frontend/
|   |-- app/
|   |-- components/
|   |-- lib/
|   |-- .env.local
|   |-- .env.local.example
|   `-- package.json
|-- render.yaml
|-- package.json
`-- README.md
```

## Environment

Edit `backend/.env`:

```env
NODE_ENV=production
PORT=4000
APISPORTS_KEY=
APISPORTS_BASE_URL=https://v3.football.api-sports.io
FRONTEND_ORIGIN=https://scorexp.com,https://www.scorexp.com,https://scorexp-iota.vercel.app
POLL_INTERVAL_MS=15000
LOG_LEVEL=info
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.scorexp.com
NEXT_PUBLIC_SOCKET_URL=https://api.scorexp.com
NEXT_PUBLIC_LOG_LEVEL=info
```

Use the committed examples as templates:

- `backend/.env.example`
- `frontend/.env.local.example`

## Install

From the repo root:

```bash
npm run install:all
```

You can also install inside each folder with plain `npm install`.

## Run locally

Use two terminals from the repo root.

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev:frontend
```

Open `http://localhost:3000`.

## Production deployment

ScoreXP is prepared for free Git-backed deployment:

- Frontend: Vercel, using the `frontend/` app.
- Backend: Render, using the `backend/` app through `render.yaml`.
- Source of truth: GitHub. Codex edits locally, you commit and push, then Vercel and Render redeploy from Git.
- `frontend/vercel.json` locks the normal Vercel app settings when the Root Directory is `frontend`.
- Root `vercel.json` is a safety fallback for existing Vercel projects that were accidentally connected to the monorepo root; it still builds and serves the frontend app from `frontend/`.

Branch strategy:

- `main` is production.
- `dev` is preview/testing.
- Pushes to `dev` should create a Vercel preview deployment and redeploy the Render `scorexp-api-dev` testing backend.
- Pushes to `main` should deploy the production Vercel frontend and redeploy the Render `scorexp-api` production backend.

Official references:

- Vercel Git deployments and monorepo/root-directory settings: `https://vercel.com/docs`
- Vercel custom domains: `https://vercel.com/docs/domains`
- Render Blueprints and `render.yaml`: `https://render.com/docs/blueprint-spec`
- Render health checks: `https://render.com/docs/health-checks`
- Render custom domains: `https://render.com/docs/custom-domains`

### GitHub setup

Initialize and connect the repo. The local repo is expected to start on `main`:

```bash
git init -b main
git add .
git commit -m "Prepare ScoreXP deployment"
git remote add origin https://github.com/<github-user>/scorexp.git
git push -u origin main
```

If the repo is already initialized, skip `git init -b main`.

Create and push the preview/testing branch before connecting Render Blueprint services, because `render.yaml` defines a backend service for both `main` and `dev`:

```bash
git switch -c dev
git push -u origin dev
git switch main
```

Recommended day-to-day flow:

```bash
git switch dev
# Codex edits locally
npm run deploy:check
git add .
git commit -m "Describe the preview change"
git push origin dev
```

When `dev` is verified, promote it to production:

```bash
git switch main
git merge --ff-only dev
npm run deploy:check
git push origin main
```

If `main` has moved, use a pull request from `dev` to `main` instead of forcing the merge.

### Local deployment checks

Run this before pushing:

```bash
npm run deploy:check
```

That runs TypeScript checks and production builds for both apps.

### Vercel frontend setup

In Vercel:

- Import the GitHub repository.
- Project name: `scorexp`.
- Framework Preset: `Next.js`.
- Root Directory: `frontend`.
- Install Command: `npm ci`.
- Build Command: `npm run build`.
- Output Directory: leave default for Next.js.
- Production Branch: `main`.

The preferred Vercel setting is still Root Directory `frontend`. If an existing Vercel project was created with the repository root by mistake, the committed root `vercel.json` provides a fallback by running `npm --prefix frontend ci`, `npm --prefix frontend run build`, and using `frontend/.next` as the output directory. Fixing the dashboard Root Directory to `frontend` is cleaner, but the fallback prevents a wrong-root setup from building the backend or an empty project.

Vercel deployment behavior:

- Push to `dev`: Vercel creates a Preview Deployment for the `dev` branch.
- Push to `main`: Vercel creates a Production Deployment.
- Pull requests also get preview deployments, which is useful before merging `dev` into `main`.

Required Vercel environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.scorexp.com
NEXT_PUBLIC_SOCKET_URL=https://api.scorexp.com
NEXT_PUBLIC_LOG_LEVEL=info
```

For Vercel preview deployments from `dev`, set preview-scope env vars to the Render dev backend:

```env
NEXT_PUBLIC_API_BASE_URL=https://scorexp-api-dev.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://scorexp-api-dev.onrender.com
NEXT_PUBLIC_LOG_LEVEL=info
```

Before `api.scorexp.com` is connected, temporarily use the production Render service URL for production:

```env
NEXT_PUBLIC_API_BASE_URL=https://scorexp-api.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://scorexp-api.onrender.com
NEXT_PUBLIC_LOG_LEVEL=info
```

These frontend variables are public browser configuration. Do not put `APISPORTS_KEY` in Vercel.

If the Vercel environment variables are accidentally missing, the production frontend falls back to `https://api.scorexp.com` instead of `localhost`. You should still set the variables explicitly in Vercel so preview and production can point at different Render services.

To connect Vercel to GitHub:

1. In Vercel, choose Add New Project.
2. Import `https://github.com/<github-user>/scorexp`.
3. Authorize Vercel's GitHub app if prompted.
4. Set Root Directory to `frontend`.
5. Set Production Branch to `main`.
6. Add production and preview environment variables.
7. Deploy once from `main`; future pushes redeploy automatically.

### Render backend setup

Preferred path: use the committed `render.yaml` Blueprint.

1. Push both `main` and `dev` to GitHub.
2. Open `https://dashboard.render.com/blueprint/new?repo=https://github.com/<github-user>/scorexp`.
3. Let Render read `render.yaml`.
4. Confirm the free plan services `scorexp-api` and `scorexp-api-dev`.
5. Fill the secret/manual environment variables.
6. Apply the Blueprint.

The production backend service is configured by `render.yaml` with:

- Root Directory: `backend`.
- Branch: `main`.
- Build Command: `npm install && npm run build`.
- Start Command: `npm run start`.
- Health Check Path: `/health`.
- Plan: `free`.
- Auto deploy trigger: commits pushed to the connected branch.

The preview/testing backend service is also configured by `render.yaml`:

- Service name: `scorexp-api-dev`.
- Branch: `dev`.
- Build Command: `npm install && npm run build`.
- Start Command: `npm run start`.
- Health Check Path: `/health`.
- Plan: `free`.
- Poll interval: `30000` by default to reduce provider calls while testing.

Manual Render setup, if you do not use the Blueprint:

- Create two Web Services from the same GitHub repo.
- Production service: name `scorexp-api`, branch `main`, root directory `backend`.
- Preview service: name `scorexp-api-dev`, branch `dev`, root directory `backend`.
- Runtime: `Node`.
- Build Command: `npm install && npm run build`.
- Start Command: `npm run start`.
- Health Check Path: `/health`.
- Plan: `Free`.

Required Render production environment variables for `scorexp-api`:

```env
NODE_ENV=production
LOG_LEVEL=info
APISPORTS_KEY=<your_api_sports_key>
APISPORTS_BASE_URL=https://v3.football.api-sports.io
FRONTEND_ORIGIN=https://scorexp.com,https://www.scorexp.com,https://scorexp-iota.vercel.app
POLL_INTERVAL_MS=15000
```

Required Render preview/testing environment variables for `scorexp-api-dev`:

```env
NODE_ENV=production
LOG_LEVEL=info
APISPORTS_KEY=<your_api_sports_key>
APISPORTS_BASE_URL=https://v3.football.api-sports.io
FRONTEND_ORIGIN=https://<vercel-dev-preview-url>.vercel.app,http://localhost:3000
POLL_INTERVAL_MS=30000
```

Render provides `PORT` automatically. The backend reads `process.env.PORT` and binds to `0.0.0.0`, so no hardcoded production port is required.

To connect Render to GitHub:

1. In Render, choose New Blueprint or New Web Service.
2. Connect GitHub and authorize Render's GitHub app if prompted.
3. Select `https://github.com/<github-user>/scorexp`.
4. For Blueprint, let Render read `render.yaml` from the repo root.
5. Confirm that `scorexp-api` tracks `main` and `scorexp-api-dev` tracks `dev`.
6. Fill `sync: false` secrets, especially `APISPORTS_KEY` and `FRONTEND_ORIGIN`.
7. Apply the Blueprint or create the services.

### Custom domains

Frontend domain on Vercel:

1. In Vercel, open the `scorexp` project.
2. Add `scorexp.com` and optionally `www.scorexp.com`.
3. Follow the DNS records Vercel shows for your domain provider.
4. After DNS verifies, keep production frontend env vars pointed at `https://api.scorexp.com`.
5. Keep preview env vars pointed at `https://scorexp-api-dev.onrender.com` unless you add a separate preview API domain.

Backend domain on Render:

1. In Render, open the `scorexp-api` web service.
2. Add custom domain `api.scorexp.com`.
3. Add the DNS record Render shows, usually a `CNAME` for the `api` subdomain.
4. After DNS verifies, update Vercel env vars to `https://api.scorexp.com`.
5. Update Render `FRONTEND_ORIGIN` to include `https://scorexp.com` and any active Vercel preview/domain origins.

Suggested DNS ownership:

- `scorexp.com`: Vercel frontend.
- `www.scorexp.com`: Vercel frontend redirect or alias.
- `api.scorexp.com`: Render production backend.
- Optional preview API: keep `scorexp-api-dev.onrender.com` instead of creating another custom domain.

### Automatic deployment workflow

Preview/testing flow:

```bash
git switch dev
npm run deploy:check
git add .
git commit -m "Describe the change"
git push origin dev
```

After a `dev` push:

1. GitHub stores the new commit on `dev`.
2. GitHub Actions runs typecheck and build.
3. Vercel creates a Preview Deployment for the frontend.
4. Render redeploys `scorexp-api-dev` from `dev`.
5. The preview frontend should use `https://scorexp-api-dev.onrender.com`.

Production flow:

```bash
git switch main
git merge --ff-only dev
npm run deploy:check
git push origin main
```

After a `main` push:

1. GitHub stores the new commit on `main`.
2. GitHub Actions runs typecheck and build.
3. Vercel deploys production frontend from `frontend/`.
4. Render redeploys `scorexp-api` from `backend/`.
4. Render checks `GET /health`.
5. The live frontend talks only to the backend URL configured in Vercel.
6. The backend talks to API-Sports using only `APISPORTS_KEY` from Render.

### Deployment checklist

- GitHub repo exists and `origin` points to it.
- Branches `main` and `dev` both exist on GitHub.
- Vercel project is connected to the repo with Root Directory `frontend`.
- Vercel production branch is `main`.
- Vercel preview deployment exists after pushing to `dev`.
- Render `scorexp-api` is connected to branch `main`.
- Render `scorexp-api-dev` is connected to branch `dev`.
- Vercel production env vars are set.
- Vercel preview env vars are set.
- Render production env vars are set.
- Render preview/testing env vars are set.
- `npm run deploy:check` passes locally.
- GitHub Actions build passes on `main` and `dev`.
- Production `https://api.scorexp.com/health` returns a `2xx` response.
- Preview `https://scorexp-api-dev.onrender.com/health` returns a `2xx` response.
- Production frontend can reach `https://api.scorexp.com`.
- Preview frontend can reach `https://scorexp-api-dev.onrender.com`.
- Production Socket.IO connection works.
- Preview Socket.IO connection works.
- `APISPORTS_KEY` exists only in Render/backend `.env`, never in frontend env vars.

### Free-tier caveats and resilience

Render free web services can sleep after inactivity. The first request after a sleep can take noticeably longer than a normal API request while Render starts the instance again.

How ScoreXP handles this:

- The Vercel frontend first attempts the normal REST snapshot.
- If the backend is unreachable or returns a likely cold-start gateway error, the UI shows `Backend waking` instead of a broken empty state.
- The client retries the live snapshot with safe backoff: about 2.5s, 5s, 10s, 20s, then 30s between attempts.
- Socket.IO reconnects are also backed off with jitter and a 30s max delay, so sleeping backends are not hammered by tight reconnect loops.
- If existing match data is already on screen and the socket drops, ScoreXP keeps the latest known real scores visible and shows a delayed-data banner instead of clearing the list.
- No fake scores or mock events are generated during delays.

Production debugging:

- Backend logs use Fastify/Pino and respect `LOG_LEVEL`.
- Frontend logs are intentionally tiny console logs controlled by `NEXT_PUBLIC_LOG_LEVEL`.
- Recommended production values are `LOG_LEVEL=info` on Render and `NEXT_PUBLIC_LOG_LEVEL=info` on Vercel.
- For quieter frontend logs later, set `NEXT_PUBLIC_LOG_LEVEL=warn` in Vercel and redeploy.

Environment setup reminders:

- `APISPORTS_KEY` belongs only in Render env vars or local `backend/.env`.
- `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SOCKET_URL` are public frontend config and should point to the Render backend URL.
- Production frontend should point to `https://api.scorexp.com` after the Render custom domain is active.
- Preview frontend should point to `https://scorexp-api-dev.onrender.com` unless you create a separate preview API domain.
- `FRONTEND_ORIGIN` on Render must include every browser origin that will call the backend, including production domain, `www` domain, and any Vercel preview origin you actively use.

## Available endpoints

Backend HTTP:

- `GET /health`
- `GET /api/matches/live`
- `GET /api/matches/:id`

Socket events:

- `matches:snapshot`
- `matches:diff`
- `match:update`

Client socket helpers used by the detail page:

- `match:watch`
- `match:unwatch`

## API-Sports endpoints used

The backend uses:

- `GET /fixtures?live=all`
- `GET /fixtures?date=YYYY-MM-DD`
- `GET /fixtures/events?fixture=<fixtureId>`

### Why these endpoints

- `fixtures?live=all` is the fast path for active matches.
- `fixtures?date=YYYY-MM-DD` is the slower fallback refresh used to smooth live-feed gaps and confirm half-time or full-time transitions.
- `fixtures/events` is fetched selectively for only a small number of changed or transition-priority matches.

## Polling strategy

The backend is optimized to reduce provider traffic while keeping the app feeling live.

### Adaptive live polling

- No live matches: the backend polls the live endpoint more slowly.
- Active live matches: the backend polls the live endpoint faster.
- Near half-time and full-time windows: the backend uses a moderate interval instead of the fastest cadence.
- Low remaining provider quota: the backend automatically backs off.

### Split fetch strategy

- Fast path: `fixtures?live=all`
- Slow path: `fixtures?date=YYYY-MM-DD`

The slow path is not called every cycle. It runs on a much longer interval and is used only to:

- keep tracked matches visible if the live feed briefly drops them during transitions
- improve removal reasons and final statuses for matches that just left the live endpoint
- avoid hammering the provider with broad fixture refreshes on every loop

### Event fetch strategy

Event summaries are not refreshed for every live fixture on every poll.

Instead, the backend prioritizes event refreshes for matches where:

- the score changed
- the status changed
- the minute changed and the cached event summary is stale
- the match is close to half-time or full-time

If provider quota gets tight, the event refresh budget shrinks automatically.

## Dedupe and compact diffs

The backend computes provider response fingerprints and keeps per-match freshness state.

### Provider dedupe

- live responses are hashed and counted when unchanged
- fallback responses are hashed and counted when unchanged
- per-match live and fallback unchanged streaks are tracked in freshness metadata

### Compact socket diffs

The backend no longer broadcasts full updated match objects to everyone.

- `added`: full normalized matches
- `updated`: compact per-match patches with only changed top-level fields
- `removed`: compact removal payloads

### Socket flood protection

- diffs are queued briefly and merged inside a short batch window before broadcast
- repeated updates for the same match in the same window collapse into one patch
- `match:update` is emitted only to clients watching a specific match room, instead of globally to every socket

## Per-match freshness metadata

The backend tracks freshness metadata per live match, including:

- last live provider sighting
- last fallback provider sighting
- last event summary refresh
- last provider change time
- source visibility: `live`, `fallback`, or `live+fallback`
- unchanged streak counters for live and fallback responses

`GET /api/matches/:id` returns the live match plus its freshness metadata.

## Metrics

`GET /health` includes operational metrics for tuning the polling strategy:

- provider request count
- live request count
- fallback request count
- event request count
- changed match count
- live and fallback dedupe counts
- diff payload size
- socket broadcast count
- socket broadcast frequency over the last minute
- a sample of per-match freshness metadata

## Data flow

1. The backend polls `fixtures?live=all`.
2. The backend optionally performs a slower `fixtures?date=YYYY-MM-DD` fallback refresh.
3. Relevant provider responses are normalized into the internal match model.
4. Select fixtures get event-summary enrichment from `fixtures/events`.
5. The new normalized state is reconciled against the in-memory store.
6. Only added matches, compact updates, and removals are queued for sockets.
7. Socket broadcasts are batched in a short window before clients receive them.
8. The frontend fetches an initial REST snapshot and then applies compact socket diffs.

## Notes

- If `APISPORTS_KEY` is empty, the backend still starts, but polling is disabled and `/health` returns a degraded status.
- `GET /api/matches/live` still returns the full current live snapshot for first paint.
- `match:update` is used by the match detail page after it joins a match-specific room.

## Verification

Verified locally:

- `backend`: `npm run typecheck`, `npm run build`
- `frontend`: `npm run typecheck`, `npm run build`
