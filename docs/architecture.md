> **Type:** design  
> **Scope:** How the iHub monorepo is shaped, how auth and data flow, and the invariants agents must preserve.  
> **Read when:** Changing packages, auth, schema, Compose services, or storage.  
> **Does NOT cover:** Product intent or audience — see [product.md](product.md). Step-by-step local setup — see [../README.md](../README.md).  
> **Prerequisites:** [product.md](product.md) vocabulary  
> **Owns:** Package/service layout rules, auth session model, workspace/resource invariants, object-storage approach.

# Architecture — Zany iHub

## Layout

Consumption model decides the directory (not “category” labels):

| Path                 | Role                                                        |
| -------------------- | ----------------------------------------------------------- |
| `apps/web`           | Vite + React SPA (client deployable)                        |
| `services/api`       | Elysia API on Bun (long-running server)                     |
| `packages/db`        | Drizzle schema, migrations, DB client                       |
| `packages/zero`      | Browser-safe sync schema, queries, and mutators             |
| `packages/ui`        | Shared UI components                                        |
| `docker-compose.yml` | Local stack: Postgres, MinIO, migrate, API, Zero Cache, web |

Package manager and API runtime: **Bun**. Root scripts and Turbo: read `package.json` / `turbo.json`.

## Runtime (local)

Compose project `zany-ihub` runs Postgres, MinIO (+ bucket init), one-shot migrate, Zero Cache, API, and web. Host ports and Google redirect URI: see [../README.md](../README.md).

| Concern                   | Pattern                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| In-container DB URL       | Hostname `postgres` (Compose overrides `.env`)                                                                                       |
| In-container object store | Hostname `minio`, S3-compatible API                                                                                                  |
| Browser → API             | `localhost` URLs so cookies + Google OAuth redirect stay aligned                                                                     |
| Env contract              | Names in `.env.example`; fail-fast required vars in `readServerEnv()` in `services/api/src/env.ts` (grep `readServerEnv` if renamed) |

Browser-safe relational data is synchronized through Zero Cache. The web client uses authenticated custom queries and optimistic custom mutators from `packages/zero`; the API authenticates and replays those operations against Postgres. Secrets, invitation tokens, sessions, object-storage keys, uploads, downloads, and AI streaming remain API-only.

Zero Cache is deliberately a separate runtime from the API. It owns a durable
SQLite replica, PostgreSQL logical replication, client view records, and
long-lived sync connections. The API stays stateless and remains the single
authorization boundary for both ordinary HTTP routes and Zero's custom query
and mutation endpoints. Built-in CRUD mutations are disabled.

| Browser data path                     | Used for                                                                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero live queries and custom mutators | Workspaces, members, teams, resources, document/table content, extension rows, projects/tasks, bookmarks, agent and AI-chat configuration, whiteboard scenes/asset metadata, and human chat/messages |
| Authenticated API routes              | Auth, invitations, binary uploads/downloads, storage-aware resource deletion, AI model availability, and AI streaming                                                                                |
| Browser-local state                   | Ephemeral UI preferences such as the selected theme                                                                                                                                                  |

Zero is the web app's relational cache and synchronization layer; do not add a
second server-state cache (for example TanStack Query) around Zero results.
Use ordinary component state for ephemeral UI drafts and API calls for the
intentional API-only operations above.

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
3. Only `owner` may create, renew, or revoke workspace invitations or change/remove workspace members; invitations always produce `member`, never `owner`, and every workspace must retain at least one owner.
4. A pending invitation grants no access. Acceptance requires a signed-in Google account whose normalized email matches the invitation, and creates membership in the invitation-consumption transaction.
5. Invitation tokens are random, expiring, single-purpose credentials. Only their SHA-256 hashes are persisted, and renewal invalidates the previous token.
6. `resource.parentId`, when set, must reference a **folder** in the **same** workspace.
7. Deleting a folder that still has children is rejected (no cascade delete of children).
8. Moving a folder under its own descendant is rejected (cycle prevention).
9. `kind === "file"` implies a 1:1 `resource_file` row with the **same id**; bytes live in object storage keyed under the workspace/resource id (see `fileStorageKey()` in `services/api/src/lib/s3.ts`, grep `fileStorageKey` if renamed).
10. Content-bearing `doc`, `table`, `whiteboard`, `project`, `bookmark`, `agent`, `ai-chat`, and `chat` resources have a 1:1 extension row with the **same id**, inserted in the resource-creation transaction.
11. `description` and optional custom `icon` are shared resource metadata. Kind extension tables must not duplicate those fields.
12. Whiteboard scene JSON uses optimistic `revision` checks. Its binary assets live in object storage and are indexed by Excalidraw file ID in `resource_whiteboard_asset`.
13. Project tasks belong to `resource_project` and cascade with it; tasks are not resource-tree nodes.
14. Bookmark resource targets must be in the same workspace. External bookmark targets are absolute HTTP(S) URLs. Deleted internal targets leave a recoverable bookmark with a missing target.
15. AI chats persist AI SDK UI-message JSON. An agent selected by a chat must belong to the same workspace. AI SDK calls use OpenRouter's server-side `OPENROUTER_API_KEY`; provider credentials never reach the browser.
16. Human chats store messages as normalized rows. Channels require the creator plus at least one explicitly selected same-workspace participant and are visible only to participants; DMs require exactly two same-workspace participants; threads inherit access from their same-workspace target.
17. A resource may have multiple attached threads. Thread attachment uses `resource_chat.target_resource_id`, never the folder-tree `resource.parent_id`; thread resource metadata remains editable without exposing a folder location.
18. DMs and threads remain hidden from ordinary workspace resource listings. Channel resources appear in participant navigation and may use a folder parent. Attached threads open as resource-backed tabs in an inline right workspace panel.
19. Consequential workspace mutations append a sanitized `audit_event` row in the same database transaction. Audit identifiers do not cascade with actors, targets, or workspaces, and audit rows are never updated or deleted through the application.
20. Teams are workspace-scoped organizational groups of existing members only. Team membership grants no access, owns no resources, and has no role in authorization or integrations; any workspace member may manage teams for now.
21. AI tools are constructed only after authenticating an AI-chat resource. Their reads and writes remain scoped to that chat's workspace and actor, kind-specific resource rows are created transactionally, and tool writes append the same audit events as equivalent user actions.

### Audit history

`audit_event` is the append-only, owner-visible history for security and
high-value collaboration changes. Zero mutators create events only during
server replay; API-only writes use the same domain transaction as their audit
insert. Do not store content bodies, invitation tokens, credentials, agent
prompts, AI messages, file bytes, or unrestricted row snapshots in audit JSON.
Read receipts, whiteboard autosaves, AI stream chunks, and timestamp-only
touches are intentionally excluded. Team edits are also excluded while teams
remain an isolated organizational model.

### Object storage

Local: **MinIO** (S3 API). Production path: same client + `S3_*` env pointed at R2 (or any S3-compatible store). File and whiteboard-asset uploads/downloads are proxied through the API so the browser does not need direct bucket CORS for v1.

## API surface

Route modules live under `services/api/src/routes/` — read those files for current paths and handlers. Zero custom queries and mutators live in `packages/zero`. Do not mirror route lists in this doc.

Auth handler and CORS: `services/api/src/index.ts`.

## Web surface

Pages and router: `apps/web/src/` (`App.tsx`, `pages/`). URL shape for workspace/resource navigation is owned by the router there.

Every page-level content view uses the shared `PageHeader`: the left side is an
icon and title only, while the right side is reserved for actions and badges.
Page headers do not render eyebrows, subtitles, or descriptions.

Resource headers are stricter: their right side contains one button, one split
button, or nothing. Passive save states, counts, and availability badges do
not belong in resource headers.

Resource pages choose one of three shell widths: `narrow` for documents and
human chats, `full` for whiteboards, projects, and tables, and `default` for
all other resource kinds. Width belongs to the shell rather than individual
resource headers, so each header and its content stay aligned.

The resource shell owns the page inset. Resource renderers stay flat and do
not add a generic outer card or another layer of page padding; cards are for
real nested items such as project columns.

## Explicit asymmetries

| Absent                                 | Why                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Zanzibar / OpenFGA                     | Deferred; `workspace_member` is enough                                                                                              |
| Email/password auth                    | Out of scope                                                                                                                        |
| Multi-user whiteboard conflict merging | Scenes sync live through Zero with optimistic revisions, but concurrent edits remain last accepted revision rather than CRDT-merged |
| `services/` besides `api`              | Single HTTP facade until caller/auth graphs diverge                                                                                 |

## Related design notes

Historical brainstorm for the first auth/db slice: [superpowers/specs/2026-08-15-auth-db-workspace-design.md](superpowers/specs/2026-08-15-auth-db-workspace-design.md). Prefer **this** architecture doc when it disagrees (e.g. file storage via MinIO is current).
