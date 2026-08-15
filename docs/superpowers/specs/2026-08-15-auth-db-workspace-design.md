# Auth, Postgres, and workspace resources

**Type:** design  
**Date:** 2026-08-15  
**Status:** approved for planning

## Intent

Add a Bun-based API with Postgres, Drizzle, and better-auth (Google), plus domain tables for workspaces, members, and typed resources. The Vite app signs in via Google and can exercise workspace CRUD enough to prove the stack.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Package manager / API runtime | Bun | Aligns with Elysia; replace pnpm for the monorepo |
| HTTP framework | Elysia in `services/api` | Bun-native DX; auth + domain routes in one service |
| Schema + migrations | `packages/db` (Drizzle + Postgres) | Shared schema without bloating the API package |
| Auth | better-auth, Google OAuth only | Session cookies; no email/password in this phase |
| Workspace access | `owner` \| `member` on `workspace_member` | Simple; no Zanzibar / OpenFGA yet |
| Sync | None | Zero deferred |
| Resource payload | Metadata only | No blobs / doc body / table cells yet |

## Layout

```
apps/web          Vite SPA — better-auth client, Google sign-in
services/api      Elysia — /api/auth/* + workspace/resource routes
packages/db       Drizzle schema, migrations, db client
packages/ui       existing UI kit (unchanged role)
docker-compose    Postgres 16
```

Consumption: clients deploy from `apps/`; long-running API lives in `services/`; schema is a workspace library in `packages/`.

## Data model

### Auth tables

better-auth owns `user`, `session`, `account`, `verification`. Generate via better-auth + Drizzle adapter (`provider: "pg"`). Do not add app-level roles on `user`; workspace roles live on membership.

### Domain tables

**workspace** — `id`, `name`, `slug` (unique), timestamps.

**workspace_member** — `workspace_id`, `user_id`, `role` (`owner` \| `member`), unique `(workspace_id, user_id)`. Creating a workspace must insert the creator as `owner` in the same transaction.

**resource** — `id`, `workspace_id`, `parent_id` (nullable self-FK), `kind` (`folder` \| `file` \| `doc` \| `table`), `name`, `created_by` → `user.id`, timestamps.

### Invariants

1. Every workspace has at least one `owner` at creation time.
2. A user may access a workspace or its resources only if they have a `workspace_member` row.
3. Only `owner` may add members.
4. Resources are scoped to exactly one workspace; `parent_id`, when set, must reference a `folder` in the same workspace.
5. Deleting a folder that still has children is rejected (no cascade in this phase).
6. Resource rows store metadata only; kind-specific content is out of scope.

## Auth flow

1. Web calls better-auth client `signIn.social({ provider: "google" })`.
2. API mounts better-auth handler under `/api/auth/*`.
3. Session is cookie-based; API `trustedOrigins` includes the web origin.
4. Domain routes require a valid session; otherwise 401.

Required env (names are authoritative; values are local/secrets): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WEB_ORIGIN`.

## API surface

Domain routes live on the Elysia app beside auth. Exact path strings and handlers live in `services/api` once implemented. Behavior contract:

| Action | Authz | Notes |
|---|---|---|
| Create workspace | signed-in | Caller becomes `owner` |
| List / get workspaces | member | Only workspaces the user belongs to |
| Add / list members | add: `owner`; list: member | Identify invitee by user id or email |
| List / create resources | member | Optional filter by `parentId` |
| Rename / move resource | member | Move = update `parentId` under same workspace |
| Delete resource | member | Folder with children → error |

## Local runtime

- Postgres via Docker Compose (port 5432, named volume).
- Dev: start Postgres → install with Bun → migrate → run API + web (Turbo).
- `.env.example` documents required vars; `.env` is gitignored.

## Non-goals

- Zero sync
- Zanzibar / OpenFGA / SpiceDB
- Email/password auth
- File storage, doc bodies, table cell data
- Production deploy / hosting
- Rich web UI beyond sign-in + minimal workspace proof

## Follow-ups (explicitly later)

- ReBAC / Zanzibar-style authz when roles outgrow owner/member
- Zero sync when client offline/realtime is required
- Kind-specific content tables or blob storage for `file` / `doc` / `table`
