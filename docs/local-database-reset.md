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
docker volume rm zany-ihub_postgres_data zany-ihub_zero_cache_data
docker compose up -d
```

This removes PostgreSQL and Zero's derived replica together. A fresh upstream
database must not reuse the old logical-replication replica. It preserves the
`zany-ihub_minio_data` object-storage volume. To erase object storage too, that
must be a separate, explicit decision.

After startup, verify:

```sh
docker compose ps
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:4848/keepalive
```

This policy must be retired before onboarding real users or retaining any local
data that cannot be recreated.
