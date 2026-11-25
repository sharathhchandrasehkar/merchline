# Deploying Merchline for free

Merchline runs on two free services:

| Piece | Service | Free plan notes |
|---|---|---|
| PostgreSQL | [Neon](https://neon.com) | 1 GB storage and 100 compute-hours a month per project; compute suspends after 5 minutes idle and wakes on the next query |
| API (Node) | [Render](https://render.com) web service | Sleeps after 15 minutes idle and takes about a minute to wake; 750 free hours a month |
| Web (Angular) | Render static site | Always on, served from a CDN |

Render's own free Postgres is deleted after 30 days, which is why the database lives on Neon.

## 1. Create the database on Neon

1. Sign up at neon.com and create a project named `merchline` in the region closest to your Render region.
2. On the project dashboard, click **Connect** and copy the connection string. It looks like
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.

You don't need to create tables. The API creates the schema and loads 3,000 synthetic styles (about 85 MB) the first time it starts.

## 2. Deploy the API and web app on Render

1. Push this repository to your GitHub account.
2. In Render, choose **New → Blueprint** and select the repository. Render reads `render.yaml` and proposes two services: `merchline-api` and `merchline-web`.
3. Fill in the values it asks for:
   - `DATABASE_URL`: the Neon connection string.
   - `ANTHROPIC_API_KEY`: optional. Leave it empty to use keyword mode, or paste a key from console.anthropic.com to let Claude read questions.
   - `CORS_ORIGIN`: leave it empty for now.
4. Click **Apply**. The first API boot seeds the database, which takes one to two minutes. Watch the logs for `[seed] done`.
5. When both services are live, copy the web app's URL (for example `https://merchline-web.onrender.com`), set it as `CORS_ORIGIN` on `merchline-api`, and save. The API redeploys.

The web build gets the API address automatically: the blueprint passes the API's host to `scripts/write-env.mjs`, which writes `env.js`.

## 3. Check it

- `https://<your-api>.onrender.com/api/health` should return `"seeded": true`.
- Open the web URL. If the API was asleep, a banner says it is waking up, and the page loads by itself when the API is ready.

## Changing the data size

Set `SEED_STYLES` on the API (for example `5000`, about 140 MB) and reseed by running this from your machine:

```bash
cd server
DATABASE_URL='<neon url>' npm run seed -- 5000
```

Keep it under about 25,000 styles to stay inside Neon's free storage.

## Without the blueprint

- **API:** a new Web Service with root directory `server`, build command `npm ci && npm run build`, start command `npm start`, health check `/api/health`, and the env vars above.
- **Web:** a new Static Site with root directory `web`, build command `npm ci && npm run build:prod`, publish directory `dist/web/browser`, env var `API_URL=https://<your-api>.onrender.com`, and a rewrite rule from `/*` to `/index.html`.

## Single service option

The API can also serve the built Angular app. Build `web` and set `WEB_DIST=../web/dist/web/browser` on the API, which leaves you with one service instead of two.
