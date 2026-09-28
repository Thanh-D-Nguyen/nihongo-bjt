# 09 — Oracle A1 Resource Budget v2 (Rebaselined)

Target:

```text
4 OCPU
~23–24 GB usable RAM
ARM64
single host
```

## Preferred steady-state architecture

| Component | Initial target |
|---|---:|
| Host + kernel + useful page cache | 2.5–3.5 GB |
| Go API | 0.2–0.8 GB |
| Next learner (KEEP_NEXT_RUNTIME) | 0.8–1.2 GB |
| Admin | 0 GB runtime if static (eval post-M6); ~0.5–0.8 GB if Next runtime retained |
| PostgreSQL | 2–3 GB |
| Redis | 0.2–0.6 GB |
| Meilisearch | 1.5–3 GB |
| Caddy | <0.25 GB |
| Docker/logging | 0.5–1 GB |
| MinIO | 0 |
| Keycloak | 0 |
| NestJS | 0 |
| Safety reserve/cache | >=5 GB desirable |

The final steady state may be around 7–11 GB before useful filesystem cache depending on search/index/load and whether Admin retains Next runtime.

Measure instead of assuming.

## Local media storage

Use the 150 GB data volume for persistent application state.

Canonical OCI data path:

```text
/srv/kotobawork/data/
├── postgres/
├── meilisearch/
├── media/
│   ├── public/
│   └── private/
├── uploads/
├── backups/
└── runtime/
```

Actual Docker volume strategy must avoid overlapping ownership/permissions.

Do not place critical data only in container writable layers.

## Go memory

Measure before forcing low limits.

Consider `GOMEMLIMIT` only after profiling.

Streaming upload handlers must be bounded (`MaxBytesReader` or equivalent) to prevent unbounded memory growth from large uploads.

## PostgreSQL

Tune:

```text
shared_buffers
work_mem
maintenance_work_mem
effective_cache_size
max_connections
autovacuum
checkpoint behavior
```

Use bounded `pgx` pools.

## Redis

Use for:

- rate limits;
- hot cache;
- temporary coordination;
- pub/sub/realtime if needed;
- queue infrastructure if later chosen for background jobs.

Do not make Redis the sole authoritative store for durable user/session/account data unless product design explicitly requires that behavior.

## Meilisearch

Keep. KotobaWork genuinely benefits from:

- typo tolerance;
- instant search;
- ranking/filtering;
- Japanese/vocabulary search UX.

PostgreSQL FTS/pg_trgm is only a possible future optimization experiment, not part of this migration.

## Static frontend

Admin static export is evaluated ONLY after M6 auth cutover proves Go cookie sessions work correctly. It is an optimization, not a prerequisite.

Learner Web retains Next.js runtime (KEEP_NEXT_RUNTIME). Do not attempt static export during this migration.

## Swap

Emergency swap may exist but normal steady state must not thrash.

## Acceptance

Representative workload must show:

- no OOM;
- no sustained swap;
- stable p95;
- healthy DB pool;
- healthy memory reserve;
- public media serving does not load Go unnecessarily;
- streaming upload throughput acceptable within Go memory budget;
- private media streaming does not cause excessive Go CPU/memory.