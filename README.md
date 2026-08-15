# Zany iHub

Agent / AI context starts at [CLAUDE.md](CLAUDE.md) → [docs/product.md](docs/product.md) and [docs/architecture.md](docs/architecture.md).

## Local development (OrbStack / Docker)

Everything except Google OAuth runs in Compose containers (Postgres, migrate, API, web).

1. Copy env and fill Google OAuth + a long `BETTER_AUTH_SECRET`:

```sh
cp .env.example .env
```

2. Start the stack:

```sh
docker compose up --build
```

3. Open:

- Web: http://localhost:5173
- API health: http://localhost:3000/health
- Postgres (from host): `localhost:5433` (maps to container `5432`)
- MinIO API: `localhost:9000` · Console: http://localhost:9001 (`minioadmin` / `minioadmin`)

Compose project name is `zany-ihub`. Host Postgres uses **5433** so it does not clash with other OrbStack Postgres instances on 5432.

Inside containers, the API talks to Postgres at `postgres:5432` and MinIO at `minio:9000` (Compose overrides those URLs).

File resources (`kind: file`) store bytes in the MinIO `zany-ihub` bucket via a 1:1 `resource_file` row. Swap MinIO for Cloudflare R2 later by changing `S3_*` env vars (same S3 API).
### Optional host-side Bun

```sh
bun install
bun run db:migrate   # uses DATABASE_URL from .env (localhost:5433)
bun run dev          # turbo: API + web on the host instead of containers
```

## Google OAuth

Create a Google OAuth web client with this authorized redirect URI:

`http://localhost:3000/api/auth/callback/google`

Set in `.env`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

`BETTER_AUTH_URL`, `WEB_ORIGIN`, and `VITE_API_URL` must stay on `localhost` URLs so the browser and Google redirect stay aligned.
