> **Type:** development policy  
> **Scope:** Disposable local PostgreSQL data before Zany iHub has real users.  
> **Warning:** This permanently deletes local auth, workspace, resource, task, agent, and AI-chat records.

# Local database reset

During the pre-user development phase, local PostgreSQL data is disposable.
When a schema change does not need data-preserving verification, prefer a clean
database reset and validate that the full migration history can bootstrap from
zero.

From the repository root:

```sh
docker compose down
docker volume rm zany-ihub_postgres_data
docker compose up -d
```

This intentionally removes only `zany-ihub_postgres_data`. It preserves the
`zany-ihub_minio_data` object-storage volume. To erase object storage too, that
must be a separate, explicit decision.

After startup, verify:

```sh
docker compose ps
curl -fsS http://localhost:3000/health
```

This policy must be retired before onboarding real users or retaining any local
data that cannot be recreated.
