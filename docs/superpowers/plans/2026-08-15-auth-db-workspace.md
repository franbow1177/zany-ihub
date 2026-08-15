# Auth, DB, and Workspace Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the monorepo to Bun, add Postgres + Drizzle + better-auth (Google) on an Elysia API, and ship workspace/member/resource schema with minimal web sign-in proof.

**Architecture:** `packages/db` owns Drizzle schema/migrations; `services/api` runs Elysia + better-auth and domain routes; `apps/web` uses the better-auth React client against the API. Local Postgres runs via Docker Compose.

**Tech Stack:** Bun, Elysia, Drizzle ORM, PostgreSQL 16, better-auth, Vite/React, Turbo

**Spec:** `docs/superpowers/specs/2026-08-15-auth-db-workspace-design.md`

## Global Constraints

- Package manager and API runtime: **Bun** (replace pnpm)
- Auth: **Google OAuth only** (no email/password)
- Workspace roles: **`owner` | `member` only**
- Resource kinds: **`folder` | `file` | `doc` | `table`** (metadata only)
- Out of scope: Zero sync, Zanzibar, file/doc/table content, production deploy
- Folder delete: **reject if children exist** (no cascade)
- `parent_id`, when set, must reference a **folder** in the **same** workspace
- Creating a workspace must insert creator as `owner` in the **same transaction**
- Env names: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WEB_ORIGIN`
- Default ports: API `3000`, web Vite `5173`, Postgres `5432`

## File Structure

| Path | Responsibility |
|---|---|
| `docker-compose.yml` | Local Postgres 16 |
| `.env.example` | Document required env vars |
| `package.json` | Bun workspaces + root scripts |
| `packages/db/` | Drizzle client, schema, migrations |
| `packages/db/src/schema/auth.ts` | better-auth tables |
| `packages/db/src/schema/workspace.ts` | workspace + member |
| `packages/db/src/schema/resource.ts` | resource tree |
| `services/api/src/auth.ts` | better-auth server config |
| `services/api/src/index.ts` | Elysia app mount + CORS |
| `services/api/src/lib/session.ts` | Resolve session from request |
| `services/api/src/routes/workspaces.ts` | Workspace + member routes |
| `services/api/src/routes/resources.ts` | Resource routes |
| `apps/web/src/lib/auth-client.ts` | better-auth React client |
| `apps/web/src/App.tsx` | Google sign-in + list/create workspaces |
| `apps/web/vite.config.ts` | Proxy `/api` → API optional; prefer explicit `baseURL` |

---

### Task 1: Bun workspaces + Postgres + env

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `services/api/package.json` (stub scripts only — filled in Task 3)
- Modify: `package.json` (workspaces, scripts, remove pnpm `packageManager`)
- Modify: `.gitignore` (allow `.env.example`)
- Delete: `pnpm-workspace.yaml`
- Delete: `pnpm-lock.yaml` (after successful `bun install`)

**Interfaces:**
- Produces: Bun can install the workspace; `docker compose up -d` yields Postgres at `localhost:5432` with DB `zany_ihub`

- [ ] **Step 1: Update root `package.json` for Bun workspaces**

```json
{
  "name": "zanbase-ihub",
  "version": "0.0.1",
  "private": true,
  "workspaces": ["apps/*", "packages/*", "services/*"],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "format": "turbo format",
    "typecheck": "turbo typecheck",
    "db:generate": "bun run --filter @workspace/db generate",
    "db:migrate": "bun run --filter @workspace/db migrate",
    "db:studio": "bun run --filter @workspace/db studio"
  },
  "devDependencies": {
    "prettier": "^3.8.3",
    "prettier-plugin-tailwindcss": "^0.8.0",
    "turbo": "^2.9.18",
    "typescript": "~6"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Remove the `"packageManager": "pnpm@…"` field. Keep existing prettier/turbo/typescript versions unless install forces bumps.

- [ ] **Step 2: Add `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: zany_ihub
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d zany_ihub"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
```

- [ ] **Step 3: Add `.env.example` and fix `.gitignore`**

`.env.example`:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zany_ihub
BETTER_AUTH_SECRET=replace-with-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
WEB_ORIGIN=http://localhost:5173
```

In `.gitignore`, change env section to:

```gitignore
.env*
!.env.example
```

- [ ] **Step 4: Stub `services/api/package.json` so the workspace includes the folder**

```json
{
  "name": "@workspace/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `services/api/src/index.ts` with a temporary health route so `dev` does not crash before Task 3:

```ts
import { Elysia } from "elysia";

new Elysia()
  .get("/health", () => ({ ok: true }))
  .listen(3000);

console.log("api listening on :3000");
```

(Install `elysia` in Task 3; if install order is awkward, delay this stub body until Task 3 and keep only `package.json` + empty `src/.gitkeep` here.)

- [ ] **Step 5: Install with Bun and start Postgres**

```bash
rm -f pnpm-workspace.yaml pnpm-lock.yaml
bun install
docker compose up -d
docker compose ps
```

Expected: lockfile `bun.lock` present; Postgres healthy.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock docker-compose.yml .env.example .gitignore services/api
git add -u pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: migrate to Bun workspaces and add Postgres compose"
```

---

### Task 2: `packages/db` — Drizzle schema (auth + domain)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/schema/auth.ts`
- Create: `packages/db/src/schema/workspace.ts`
- Create: `packages/db/src/schema/resource.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/schema/resource.test.ts`
- Create: migrations under `packages/db/drizzle/` via drizzle-kit

**Interfaces:**
- Produces: `@workspace/db` exports `{ db, schema }` and table symbols `user`, `session`, `account`, `verification`, `workspace`, `workspaceMember`, `resource`
- Produces: `resourceKindEnum` values `"folder" | "file" | "doc" | "table"`
- Produces: `workspaceRoleEnum` values `"owner" | "member"`

- [ ] **Step 1: Scaffold `packages/db/package.json`**

```json
{
  "name": "@workspace/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "studio": "drizzle-kit studio",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0",
    "typescript": "~6"
  }
}
```

Pin to whatever latest compatible versions `bun add` resolves at implement time.

- [ ] **Step 2: Write failing test for resource kind + parent invariant helpers**

Create `packages/db/src/lib/resource-rules.ts` (logic used by API later) and test first:

`packages/db/src/lib/resource-rules.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { assertParentIsFolder, RESOURCE_KINDS } from "./resource-rules";

describe("resource rules", () => {
  test("exposes the four kinds", () => {
    expect(RESOURCE_KINDS).toEqual(["folder", "file", "doc", "table"]);
  });

  test("allows null parent", () => {
    expect(() => assertParentIsFolder(null)).not.toThrow();
  });

  test("rejects non-folder parent", () => {
    expect(() => assertParentIsFolder({ kind: "doc" })).toThrow();
  });

  test("allows folder parent", () => {
    expect(() => assertParentIsFolder({ kind: "folder" })).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
cd packages/db && bun test
```

Expected: fail — module not found.

- [ ] **Step 4: Implement `resource-rules.ts` + schemas**

`packages/db/src/lib/resource-rules.ts`:

```ts
export const RESOURCE_KINDS = ["folder", "file", "doc", "table"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export function assertParentIsFolder(
  parent: { kind: string } | null,
): void {
  if (parent === null) return;
  if (parent.kind !== "folder") {
    throw new Error("parent must be a folder");
  }
}
```

`packages/db/src/schema/auth.ts` — standard better-auth Postgres Drizzle tables (`user`, `session`, `account`, `verification`) matching better-auth CLI output. Prefer generating with:

```bash
bunx @better-auth/cli@latest generate --config ../../services/api/src/auth.ts --output ./src/schema/auth.ts
```

…after Task 3’s `auth.ts` exists. **If generating early:** hand-write the canonical better-auth pg tables (text ids, timestamps, FKs with `onDelete: "cascade"` on session/account → user). Do **not** add a global `user.role` column.

`packages/db/src/schema/workspace.ts`:

```ts
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const workspaceRoleEnum = pgEnum("workspace_role", ["owner", "member"]);

export const workspace = pgTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("workspace_member_ws_user_uidx").on(t.workspaceId, t.userId)],
);
```

`packages/db/src/schema/resource.ts`:

```ts
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workspace } from "./workspace";

export const resourceKindEnum = pgEnum("resource_kind", [
  "folder",
  "file",
  "doc",
  "table",
]);

export const resource = pgTable("resource", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  kind: resourceKindEnum("kind").notNull(),
  name: text("name").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

Add self-FK for `parentId` → `resource.id` in the same table using Drizzle’s `.references(() => resource.id, { onDelete: "restrict" })` if the circular reference is expressible; otherwise enforce parent existence in the API and add the FK in a follow-up migration. Prefer API + DB FK when drizzle allows.

`packages/db/src/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const client = postgres(url);
export const db = drizzle(client, { schema });
```

`packages/db/src/schema/index.ts` re-exports all tables/enums.  
`packages/db/src/index.ts` exports `db` and `schema`.

`packages/db/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 5: Re-run tests — expect pass**

```bash
cd packages/db && bun test
```

- [ ] **Step 6: Generate and apply migrations**

```bash
# from repo root, with .env loaded or DATABASE_URL exported
export $(grep -v '^#' .env.example | xargs) # or copy to .env first
bun run db:generate
bun run db:migrate
```

Expected: tables exist in Postgres.

- [ ] **Step 7: Commit**

```bash
git add packages/db
git commit -m "feat(db): add drizzle schema for auth, workspaces, and resources"
```

---

### Task 3: Elysia API + better-auth (Google)

**Files:**
- Create: `services/api/src/auth.ts`
- Create: `services/api/src/lib/session.ts`
- Modify: `services/api/src/index.ts`
- Modify: `services/api/package.json`
- Create: `services/api/tsconfig.json`
- Create: `services/api/src/auth-mount.test.ts`

**Interfaces:**
- Consumes: `db` + auth tables from `@workspace/db`
- Produces: `auth` (betterAuth instance), `getSessionUser(request): Promise<{ id: string; email: string; name: string } | null>`
- Produces: API listening on `:3000` with `/api/auth/*` and `/health`

- [ ] **Step 1: Add dependencies**

```bash
cd services/api
bun add elysia @elysiajs/cors better-auth @workspace/db
bun add -d typescript @types/bun
```

- [ ] **Step 2: Write failing test that `/health` returns ok**

`services/api/src/health.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

describe("health", () => {
  test("GET /health", async () => {
    const res = await fetch("http://localhost:3000/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

Note: this is a live-server smoke test. Prefer exporting the Elysia `app` without `.listen()` for unit tests:

```ts
// index.ts exports `app`; listen only when main
export const app = new Elysia()...
if (import.meta.main) app.listen(3000);
```

Then:

```ts
import { describe, expect, test } from "bun:test";
import { app } from "./index";

describe("health", () => {
  test("GET /health", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Run test — expect fail** (until app export exists)

```bash
cd services/api && bun test src/health.test.ts
```

- [ ] **Step 4: Implement auth + app**

`services/api/src/auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@workspace/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.WEB_ORIGIN!],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
```

`services/api/src/lib/session.ts`:

```ts
import { auth } from "../auth";

export async function getSessionUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
```

`services/api/src/index.ts`:

```ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./auth";

export const app = new Elysia()
  .use(
    cors({
      origin: process.env.WEB_ORIGIN!,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
  .get("/health", () => ({ ok: true }))
  .all("/api/auth/*", async ({ request }) => {
    return auth.handler(request);
  });

if (import.meta.main) {
  app.listen(3000);
  console.log("api listening on :3000");
}
```

If better-auth’s recommended Elysia mount (`.mount(auth.handler)`) works with base path `/api/auth`, prefer the documented mount and keep CORS first.

Ensure `DATABASE_URL` and auth env vars are loaded (Bun auto-loads `.env` from cwd — run API from repo root or `services/api` with a copied `.env`).

- [ ] **Step 5: Run health test — expect pass**

```bash
cd services/api && bun test src/health.test.ts
```

- [ ] **Step 6: Manual Google config note**

Document in README: create Google OAuth client with redirect URI  
`http://localhost:3000/api/auth/callback/google`  
and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.

- [ ] **Step 7: Commit**

```bash
git add services/api
git commit -m "feat(api): add Elysia app with better-auth Google provider"
```

---

### Task 4: Workspace + member routes

**Files:**
- Create: `services/api/src/routes/workspaces.ts`
- Create: `services/api/src/routes/workspaces.test.ts`
- Create: `services/api/src/lib/ids.ts`
- Create: `services/api/src/lib/slug.ts`
- Modify: `services/api/src/index.ts` (`.use(workspaceRoutes)`)

**Interfaces:**
- Consumes: `getSessionUser`, `db`, `workspace`, `workspaceMember`, `user`
- Produces routes:
  - `POST /workspaces` body `{ name: string }` → `{ id, name, slug }`
  - `GET /workspaces` → array of workspaces for session user
  - `GET /workspaces/:id` → workspace if member else 404/403
  - `POST /workspaces/:id/members` body `{ email: string, role?: "member" }` → member (owner only; default role `member`; never allow setting `owner` via this endpoint in v1)
  - `GET /workspaces/:id/members` → members list

- [ ] **Step 1: Write failing route tests using `app.handle` + mocked session**

Prefer a test helper that inserts a user row directly and builds a fake session cookie **or** injects a test-only plugin. Simplest reliable approach for v1:

1. Insert `user` via drizzle in test setup.
2. Create a better-auth session token in `session` table.
3. Pass `Cookie` header on requests.

Alternatively, export an `authDerive` that tests can override. Pick **DB-backed session cookie** for realism.

`services/api/src/routes/workspaces.test.ts` (outline — implement fully):

```ts
import { describe, expect, test, beforeAll } from "bun:test";
import { app } from "../index";
import { db, schema } from "@workspace/db";
// helpers: createTestUser(), createSessionCookie(userId)

describe("workspaces", () => {
  test("POST /workspaces creates workspace and owner membership", async () => {
    const cookie = await createSessionCookie(/* userA */);
    const res = await app.handle(
      new Request("http://localhost/workspaces", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({ name: "Acme" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Acme");
    expect(body.slug).toBeTruthy();
    // assert workspace_member role owner for userA
  });

  test("POST /workspaces/:id/members requires owner", async () => {
    // userB is member only → 403
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd services/api && bun test src/routes/workspaces.test.ts
```

- [ ] **Step 3: Implement helpers + routes**

`services/api/src/lib/ids.ts`:

```ts
export function newId() {
  return crypto.randomUUID();
}
```

`services/api/src/lib/slug.ts`:

```ts
export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "workspace"}-${crypto.randomUUID().slice(0, 8)}`;
}
```

`services/api/src/routes/workspaces.ts` — Elysia plugin:

- Guard: if `getSessionUser` null → 401
- `POST /workspaces`: transaction insert workspace + owner member
- `GET /workspaces`: join `workspace_member` where `userId = session.id`
- `GET /workspaces/:id`: membership required
- `POST /workspaces/:id/members`: load membership; if role !== `owner` → 403; find user by email; insert member
- `GET /workspaces/:id/members`: membership required

Wire into `app` with `.use(workspaceRoutes)`.

- [ ] **Step 4: Run tests — expect pass**

```bash
cd services/api && bun test src/routes/workspaces.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/api
git commit -m "feat(api): add workspace and member routes"
```

---

### Task 5: Resource routes

**Files:**
- Create: `services/api/src/routes/resources.ts`
- Create: `services/api/src/routes/resources.test.ts`
- Modify: `services/api/src/index.ts`

**Interfaces:**
- Consumes: `getSessionUser`, `db`, `resource`, `assertParentIsFolder`
- Produces:
  - `GET /workspaces/:id/resources?parentId=`
  - `POST /workspaces/:id/resources` body `{ name, kind, parentId? }`
  - `PATCH /resources/:id` body `{ name?, parentId? }`
  - `DELETE /resources/:id` (409 if folder has children)

- [ ] **Step 1: Write failing tests**

Cover:
1. Create folder at root
2. Create doc under folder
3. Reject parent that is not a folder
4. Reject delete folder with child
5. Non-member cannot list resources (403)

- [ ] **Step 2: Run — expect fail**

```bash
cd services/api && bun test src/routes/resources.test.ts
```

- [ ] **Step 3: Implement `resources.ts`**

On create/move:
1. Verify membership for workspace
2. If `parentId` set: load parent; same `workspaceId`; `assertParentIsFolder(parent)`
3. Insert/update

On delete:
1. Verify membership
2. If kind === `folder`, count children where `parentId = id`; if > 0 → 409
3. Delete row

- [ ] **Step 4: Run — expect pass**

```bash
cd services/api && bun test src/routes/resources.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/api packages/db
git commit -m "feat(api): add workspace resource CRUD"
```

---

### Task 6: Web Google sign-in + minimal workspaces UI

**Files:**
- Create: `apps/web/src/lib/auth-client.ts`
- Modify: `apps/web/package.json` (add `better-auth`)
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/vite.config.ts` (optional proxy; prefer explicit API URL)
- Modify: `README.md`

**Interfaces:**
- Consumes: API at `import.meta.env.VITE_API_URL` (default `http://localhost:3000`)
- Produces: signed-in session via cookies; UI to sign in with Google, list workspaces, create workspace by name

- [ ] **Step 1: Add auth client**

```bash
cd apps/web && bun add better-auth
```

`apps/web/src/lib/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
});
```

Add to `.env.example`:

```bash
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 2: Update `App.tsx`**

Behavior:
- `authClient.useSession()`
- If logged out: Button “Sign in with Google” → `authClient.signIn.social({ provider: "google", callbackURL: window.location.origin })`
- If logged in: show user name/email, Sign out, workspace list fetched from `GET ${API}/workspaces` with `credentials: "include"`, form to `POST /workspaces`

Use existing `@workspace/ui` Button.

- [ ] **Step 3: Manual verification checklist**

```bash
docker compose up -d
bun run db:migrate
bun run dev
```

1. Open `http://localhost:5173`
2. Sign in with Google
3. Create a workspace
4. Confirm it appears in the list
5. (Optional via curl/httpie) create a folder resource with session cookie

- [ ] **Step 4: Update README**

Replace template blurb with:
- Bun install
- Docker Postgres
- Env vars + Google redirect URI
- `bun run db:migrate` + `bun run dev`

- [ ] **Step 5: Commit**

```bash
git add apps/web README.md .env.example
git commit -m "feat(web): Google sign-in and minimal workspace UI"
```

---

### Task 7: Wire Turbo + final verification

**Files:**
- Modify: `turbo.json` if `services/api` needs env passthrough
- Modify: root `package.json` scripts if filters need adjustment

- [ ] **Step 1: Ensure `bun run dev` starts `web` + `api`**

Both packages must have `"dev"` scripts. Turbo will run them in parallel.

- [ ] **Step 2: Run typecheck across workspaces**

```bash
bun run typecheck
```

Expected: pass (fix any path/export issues).

- [ ] **Step 3: Run all package tests**

```bash
bun run --filter @workspace/db test
bun run --filter @workspace/api test
```

Expected: pass.

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -u
git commit -m "chore: wire turbo dev and fix typecheck"
```

---

## Spec coverage checklist

| Spec item | Task |
|---|---|
| Bun migration | 1 |
| Docker Postgres | 1 |
| `packages/db` Drizzle | 2 |
| better-auth tables | 2–3 |
| workspace + member + resource schema | 2 |
| Elysia + Google auth | 3 |
| Workspace/member API + owner rules | 4 |
| Resource API + parent/delete invariants | 5 |
| Web Google sign-in + minimal workspaces | 6 |
| Non-goals respected (no Zero/Zanzibar/content) | all |

## Self-review notes

- No Zero, Zanzibar, or kind-specific content tables in any task.
- Auth env names match the spec exactly.
- Folder-with-children delete returns 409 in Task 5.
- Owner assignment on workspace create is transactional in Task 4.
