# CLAUDE.md — agent task router

Use this file to pick the right doc. Prefer docs for **why / invariants**; prefer **code** for what currently exists.

## Task → doc

| If you are… | Read |
|---|---|
| Unsure what the product is / domain words | [docs/product.md](docs/product.md) |
| Changing packages, auth, schema, Compose, storage, authz | [docs/architecture.md](docs/architecture.md) |
| Running locally / env / OAuth redirect / ports | [README.md](README.md) |
| Looking at the original auth/db brainstorm | [docs/superpowers/specs/2026-08-15-auth-db-workspace-design.md](docs/superpowers/specs/2026-08-15-auth-db-workspace-design.md) (superseded on storage/file by architecture.md) |

## Code entry points (not inventories)

| Need | Start here |
|---|---|
| Web app | `apps/web/src/` |
| API | `services/api/src/` |
| Schema / migrations | `packages/db/` |
| UI primitives | `packages/ui/src/` |
| Local stack definition | `docker-compose.yml` |

## Doc rules for this repo

- **Docs = how / why.** **Code = what exists.**
- Do not add route/file/entity inventories to docs — link to directories or grep symbols.
- New stable product intent → update `docs/product.md`. New cross-cutting invariant → update `docs/architecture.md`.
- Human setup steps stay in `README.md`.
