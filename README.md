# Loadbyton

The freight bid marketplace for container haulage. A shipper posts a
requirement, vetted transport companies bid, the shipper awards and shares
customs documents with the winning carrier, then tracks the container to the
warehouse — all in one app. Three roles: Cargo/Shipper, Transport Company,
Admin/Operations.

Full-stack app: Express + SQLite (`node:sqlite`) API behind a vanilla-JS,
no-build-step frontend.

## Quick start

```bash
npm install
cp .env.example .env      # optional — JWT_SECRET is auto-generated if you skip this
npm start
```

Open **http://localhost:4100**. Every demo login on the landing page uses
password `demo1234`, or register a new company and approve it from the Admin
account.

## Scripts

- `npm start` — run the server.
- `npm run dev` — run with `node --watch` for auto-restart on file changes.

## Architecture

- **`src/db.js`** — SQLite schema and connection. Data directory defaults to
  `./data`, overridable via the `DATA_DIR` env var.
- **`src/seed.js`** — realistic starter data (carriers, requirements, bids,
  registrations, tickets), seeded once when the database is empty.
- **`src/routes/`** — REST API: auth/registration, requirements, bids &
  awards, chat messages, document uploads, admin operations, support tickets.
- **`public/`** — the frontend. `css/` is a small design-token system
  (tokens → base → components → layout); `js/` is ES modules with no build
  step — `api.js` (fetch client), `app.js` (router/auth/landing), and one
  view module per role under `js/views/`.

## Deploying to Railway

This repo deploys via GitHub Actions (`.github/workflows/deploy-railway.yml`)
on every push to `main`, using the Railway CLI.

**One-time setup** (do this in the Railway dashboard — these steps can't be
automated from here):

1. Create a Railway project and a service named `loadbyton` (or edit the
   `--service` flag in the workflow to match whatever you name it) pointed at
   this repo, or create an empty project — the workflow pushes the code
   itself via `railway up`.
2. Add a **Volume**, mounted at a path of your choice (e.g. `/data`), so the
   SQLite database and uploaded documents survive redeploys. Without a
   volume, every deploy wipes the database.
3. Set these environment variables on the service:
   - `DATA_DIR` — the volume's mount path (e.g. `/data`).
   - `JWT_SECRET` — a fixed random value (e.g. `openssl rand -hex 48`).
     Without this, a new secret is generated on every restart and all
     sessions are invalidated each deploy.
4. Generate a **Project Token** (Project Settings → Tokens) and add it as a
   GitHub Actions secret named `RAILWAY_TOKEN` in this repo's
   Settings → Secrets and variables → Actions.

`PORT` is provided by Railway automatically; the app already reads
`process.env.PORT`. A `railway.json` in the repo root sets the start command
and a `/health` healthcheck endpoint.

> **Note:** the deploy workflow's exact `railway up` flags (`--service`,
> `--detach`) are set from Railway's documented CLI conventions but haven't
> been run against a live Railway project — the first push to `main` after
> setup is the real test. If it fails, check the Action's logs against
> `railway up --help` and adjust the workflow accordingly.
