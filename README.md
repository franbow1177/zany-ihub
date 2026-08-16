# Zany iHub

Agent / AI context starts at [CLAUDE.md](CLAUDE.md) → [docs/product.md](docs/product.md) and [docs/architecture.md](docs/architecture.md).

## Local development (OrbStack / Docker)

Everything except Google OAuth runs in Compose containers (Postgres, migrate,
MinIO, API, Zero Cache, and web).

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
- Zero Cache health: http://localhost:4848/keepalive
- Postgres (from host): `localhost:5433` (maps to container `5432`)
- MinIO API: `localhost:9000` · Console: http://localhost:9001 (`minioadmin` / `minioadmin`)

Compose project name is `zany-ihub`. Host Postgres uses **5433** so it does not clash with other OrbStack Postgres instances on 5432.

Before real users exist, local PostgreSQL is intentionally disposable. See
[docs/local-database-reset.md](docs/local-database-reset.md) for the exact reset
policy and command.

Inside containers, the API talks to Postgres at `postgres:5432` and MinIO at `minio:9000` (Compose overrides those URLs).

Zero Cache runs as its own long-lived service on port `4848`. It maintains the
logical-replication replica and serves the web app's live relational queries.
The API remains the trusted query/mutation endpoint: it validates the forwarded
Better Auth cookie and workspace membership before touching Postgres.

File resources (`kind: file`) store bytes in the MinIO `zany-ihub` bucket via a 1:1 `resource_file` row. Swap MinIO for Cloudflare R2 later by changing `S3_*` env vars (same S3 API).

Agent and AI chat resources use AI SDK 7 through OpenRouter. Add one
`OPENROUTER_API_KEY` to `.env` to access the curated free, budget, and premium
models. New agents and chats default to OpenRouter's rate-limited free router;
the rest of the app runs without a key.

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

`BETTER_AUTH_URL`, `WEB_ORIGIN`, `VITE_API_URL`, and
`VITE_ZERO_CACHE_URL` must stay on `localhost` URLs so cookies, Zero, and the
Google redirect stay aligned.
