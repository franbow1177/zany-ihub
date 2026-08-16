> **Type:** design  
> **Scope:** How the iHub monorepo is shaped, how auth and data flow, and the invariants agents must preserve.  
> **Read when:** Changing packages, auth, schema, Compose services, or storage.  
> **Does NOT cover:** Product intent or audience — see [product.md](product.md). Step-by-step local setup — see [../README.md](../README.md).  
> **Prerequisites:** [product.md](product.md) vocabulary  
> **Owns:** Package/service layout rules, auth session model, workspace/resource invariants, object-storage approach.

# Architecture — Zany iHub

## Layout

Consumption model decides the directory (not “category” labels):

| Path                 | Role                                            |
| -------------------- | ----------------------------------------------- |
| `apps/web`           | Vite + React SPA (client deployable)            |
| `services/api`       | Elysia API on Bun (long-running server)         |
| `packages/db`        | Drizzle schema, migrations, DB client           |
| `packages/ui`        | Shared UI components                            |
| `docker-compose.yml` | Local stack: Postgres, MinIO, migrate, api, web |

Package manager and API runtime: **Bun**. Root scripts and Turbo: read `package.json` / `turbo.json`.

## Runtime (local)

Compose project `zany-ihub` runs Postgres, MinIO (+ bucket init), one-shot migrate, API, and web. Host ports and Google redirect URI: see [../README.md](../README.md).

| Concern                   | Pattern                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| In-container DB URL       | Hostname `postgres` (Compose overrides `.env`)                                                                                       |
| In-container object store | Hostname `minio`, S3-compatible API                                                                                                  |
| Browser → API             | `localhost` URLs so cookies + Google OAuth redirect stay aligned                                                                     |
| Env contract              | Names in `.env.example`; fail-fast required vars in `readServerEnv()` in `services/api/src/env.ts` (grep `readServerEnv` if renamed) |

## Auth

| Choice   | Detail                                                                           |
| -------- | -------------------------------------------------------------------------------- |
| Library  | better-auth                                                                      |
| Provider | Google OAuth only                                                                |
| Session  | Cookie-based; API `trustedOrigins` includes `WEB_ORIGIN`                         |
| Mount    | `/api/auth/*` on the Elysia app                                                  |
| Tables   | `user`, `session`, `account`, `verification` in `packages/db/src/schema/auth.ts` |

App roles do **not** live on `user`. Workspace access uses `workspace_member`.

Client: `createAuthClient` in `apps/web/src/lib/auth-client.ts` (grep `authClient` if renamed).

## Domain data

Canonical shapes: `packages/db/src/schema/` (grep table exports `workspace`, `workspaceMember`, `workspaceInvitation`, `resource`, `resourceFile`).

### Invariants

1. Creating a workspace inserts the creator as `owner` in the **same transaction**.
2. Access to a workspace or its resources requires a `workspace_member` row.
3. Only `owner` may create, renew, or revoke workspace invitations; invitations always produce `member`, never `owner`.
4. A pending invitation grants no access. Acceptance requires a signed-in Google account whose normalized email matches the invitation, and creates membership in the invitation-consumption transaction.
5. Invitation tokens are random, expiring, single-purpose credentials. Only their SHA-256 hashes are persisted, and renewal invalidates the previous token.
6. `resource.parentId`, when set, must reference a **folder** in the **same** workspace.
7. Deleting a folder that still has children is rejected (no cascade delete of children).
8. Moving a folder under its own descendant is rejected (cycle prevention).
9. `kind === "file"` implies a 1:1 `resource_file` row with the **same id**; bytes live in object storage keyed under the workspace/resource id (see `fileStorageKey()` in `services/api/src/lib/s3.ts`, grep `fileStorageKey` if renamed).
10. Content-bearing `whiteboard`, `project`, `bookmark`, `agent`, and `ai-chat` resources have a 1:1 extension row with the **same id**, inserted in the resource-creation transaction.
11. `description` and optional custom `icon` are shared resource metadata. Kind extension tables must not duplicate those fields.
12. Whiteboard scene JSON uses optimistic `revision` checks. Its binary assets live in object storage and are indexed by Excalidraw file ID in `resource_whiteboard_asset`.
13. Project tasks belong to `resource_project` and cascade with it; tasks are not resource-tree nodes.
14. Bookmark resource targets must be in the same workspace. External bookmark targets are absolute HTTP(S) URLs. Deleted internal targets leave a recoverable bookmark with a missing target.
15. AI chats persist AI SDK UI-message JSON. An agent selected by a chat must belong to the same workspace. AI SDK calls use OpenRouter's server-side `OPENROUTER_API_KEY`; provider credentials never reach the browser.

### Object storage

Local: **MinIO** (S3 API). Production path: same client + `S3_*` env pointed at R2 (or any S3-compatible store). File and whiteboard-asset uploads/downloads are proxied through the API so the browser does not need direct bucket CORS for v1.

## API surface

Route modules live under `services/api/src/routes/` — read those files for current paths and handlers. Do not mirror route lists in this doc.

Auth handler and CORS: `services/api/src/index.ts`.

## Web surface

Pages and router: `apps/web/src/` (`App.tsx`, `pages/`). URL shape for workspace/resource navigation is owned by the router there.

## Explicit asymmetries

| Absent                                 | Why                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| Zero / sync engine                     | Deferred; REST + cookies for now                                                       |
| Zanzibar / OpenFGA                     | Deferred; `workspace_member` is enough                                                 |
| Email/password auth                    | Out of scope                                                                           |
| Server persistence for `doc` / `table` | Editors exist, but their content is browser-local until server schemas and routes ship |
| Realtime whiteboard collaboration      | Whiteboards use debounced REST saves and optimistic revisions for now                  |
| `services/` besides `api`              | Single HTTP facade until caller/auth graphs diverge                                    |

## Related design notes

Historical brainstorm for the first auth/db slice: [superpowers/specs/2026-08-15-auth-db-workspace-design.md](superpowers/specs/2026-08-15-auth-db-workspace-design.md). Prefer **this** architecture doc when it disagrees (e.g. file storage via MinIO is current).
