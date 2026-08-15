# Zany iHub

## Local development

Install the workspace dependencies with Bun:

```sh
bun install
```

Copy the example environment file and fill in a long random auth secret and
Google OAuth credentials:

```sh
cp .env.example .env
```

The default local URLs are:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Postgres: `postgres://postgres:postgres@localhost:5432/zany_ihub`

Start Postgres, apply migrations, and run the API and web app:

```sh
docker compose up -d
bun run db:migrate
bun run dev
```

## Google OAuth

Create a Google OAuth web client and configure this authorized redirect URI:

`http://localhost:3000/api/auth/callback/google`

Set these values in `.env`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

`BETTER_AUTH_URL`, `WEB_ORIGIN`, and `VITE_API_URL` must match the API and web
origins used by your local environment. Google sign-in cannot complete until
valid Google OAuth credentials are configured.
