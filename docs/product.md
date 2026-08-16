> **Type:** vision  
> **Scope:** What Zany iHub is, who it is for, and the domain objects that frame product work.  
> **Read when:** Starting a feature, naming something, or deciding whether a request is in/out of product scope.  
> **Does NOT cover:** Runtime layout, auth wiring, storage, or how to run the stack — see [architecture.md](architecture.md) and [../README.md](../README.md).  
> **Prerequisites:** None  
> **Owns:** Product intent, core domain vocabulary, explicit non-goals.

# Product — Zany iHub

## Intent

Zany iHub is a **workspace hub** for organizing work as a tree of typed **resources**. People sign in, land in workspaces they belong to, and create or open resources (folders and content types) inside those workspaces.

The product name in the monorepo is `zany-ihub` / “Zany iHub”; treat “iHub” as the product surface.

## Audience

| Who                     | Need                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| Individual / small team | Own a workspace, invite members, keep files and docs in one place       |
| Collaborators           | Accept an email-bound invitation and join as `member` without ownership |

## Domain vocabulary

| Term           | Meaning                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workspace**  | Top-level container a user belongs to; unit of sharing and membership                                                                      |
| **Member**     | User linked to a workspace with a role (`owner` or `member` today)                                                                         |
| **Team**       | Named organizational group of workspace members; it grants no access and owns no resources or integrations                                 |
| **Invitation** | Expiring, email-bound request to join a workspace as `member`; it grants no access until accepted                                          |
| **Resource**   | Named node inside a workspace with shared `description` and optional custom `icon`; typed by `kind`                                        |
| **Kind**       | Discriminator on a resource — see schema enum `resource_kind` in `packages/db/src/schema/resource.ts` (grep `resourceKindEnum` if renamed) |
| **Folder**     | Resource kind that nests other resources via `parentId`                                                                                    |
| **File**       | Resource kind whose bytes live in object storage, metadata in `resource_file` (1:1 with `resource`)                                        |
| **Whiteboard** | Excalidraw-powered infinite canvas; scene metadata is stored in Postgres and binary assets in object storage                               |
| **Project**    | Resource kind that owns a lightweight task board without placing tasks in the resource tree                                                |
| **Bookmark**   | Link to another resource in the same workspace or an external HTTP(S) URL                                                                  |
| **Agent**      | Reusable model configuration with a persona and system instructions                                                                        |
| **AI chat**    | Persistent AI conversation that targets either a direct model or a workspace agent                                                         |
| **Chat**       | Human conversation resource specialized as a workspace channel, private DM, or discussion attached to another resource                     |
| **Channel**    | Named chat with explicitly selected workspace members that appears in those participants' resource tree                                    |
| **DM**         | Private chat between exactly two members of the same workspace                                                                             |
| **Thread**     | A named contextual discussion attached to another resource rather than to the folder tree                                                  |

Kinds are first-class in the model while their content surfaces ship incrementally. Document and table content is synchronized through the workspace database alongside files, whiteboards, projects, bookmarks, agents, and conversations.

## Product principles

1. **Workspace-scoped** — everything a user sees under a workspace is gated by membership.
2. **Invitations require consent** — an owner may invite an email, but membership begins only after that signed-in person accepts.
3. **Typed tree** — resources form a tree; folders are the only valid parents.
4. **Metadata first, content by kind** — the shared `resource` row owns identity, description, and icon; kind extensions (e.g. `resource_file`) hold payload specifics.
5. **Simple authz until it hurts** — start with `owner` / `member`; richer ReBAC (Zanzibar-style) is deferred, not denied.
6. **Tasks are project content** — tasks belong to a project and do not appear as independent resource-tree nodes.
7. **Stable internal links** — bookmarks reference resource IDs; UI paths are derived rather than persisted.
8. **Reusable AI behavior** — agents own identity and instructions; chats own conversation history, can switch between models and agents, and can use workspace-scoped tools to inspect, create, or perform explicitly requested edits to resources.
9. **Contextual conversation** — human messages are normalized rows synchronized by Zero; participant channels are navigable resources, while DMs use their dedicated area and resource threads appear as editable tabs in the workspace's inline discussion panel.
10. **Teams are organizational only** — teams group existing workspace members and do not participate in authorization or other domains.

## Non-goals (for now)

| Non-goal                                    | Note                                 |
| ------------------------------------------- | ------------------------------------ |
| Full Zanzibar / OpenFGA                     | Deferred; membership table is enough |
| Email/password auth                         | Google OAuth only                    |
| Multi-tenant billing / orgs above workspace | Not defined                          |
| Public anonymous sharing                    | Not defined                          |

## Where code lives (pointers only)

| Concern             | Look in             |
| ------------------- | ------------------- |
| Web UI / routes     | `apps/web/src/`     |
| HTTP API            | `services/api/src/` |
| Schema / migrations | `packages/db/`      |
| Shared UI kit       | `packages/ui/`      |
