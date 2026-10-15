# Oracle production delivery

Current installation: Docker Compose project `oci` on Oracle ARM64. Application releases do not recreate PostgreSQL, Redis or Meilisearch. The separate legacy systemd installation is not this delivery target.

## Automatic release

Push to `main` runs the canonical `CI` workflow. Only its successful **push** result for this repository can trigger `Deploy Oracle production`. PR events and failed CI never deploy. The repository runner `kotobawork-oci` has labels `self-hosted,Linux,ARM64,kotobawork-oci`; external contributors require approval before Actions runs. Repository variable `OCI_PUBLIC_HOST` supplies the public TLS hostname. GCP automatic deployment is opt-in through `ENABLE_GCP_AUTO_DEPLOY=true`.

The workflow checks out the exact validated SHA and verifies CI again. `deploy/oci/deploy-release.sh` takes a host lock and checks that the SHA still equals current `main`, including immediately before migrations. An older CI completion therefore cannot downgrade a newer push. Manual dispatch on main uses the same gates.

Learner: `https://<OCI_PUBLIC_HOST>/vi`; Admin: `https://<OCI_PUBLIC_HOST>/admin/vi/login`. Caddy serves both applications and the API on the same TLS origin. Admin Next.js uses `/admin` as its base path. No API, database, Redis or search port is exposed publicly.

## Persistent state and release sequence

- Production secrets: `/srv/kotobawork/deploy/oci/.env.production`, mode 600. Preserve values; never copy them into Git, images or Actions output.
- Persistent data: `/srv/kotobawork/data`, a separately mounted data disk. Deployment refuses if it is not a mount point.
- Immutable source: `/srv/kotobawork/releases/<SHA>`, populated from `git archive` of the validated commit.
- Release images carry the SHA; the Go API embeds the same version. Prior running image IDs are pinned as rollback tags before building.
- Before any build, the script refuses (exit 3, no production change) when `content` has tables but no `_prisma_migrations` — the imported-database baseline below must be completed first.
- Build migrations/API/web/Admin while existing apps serve traffic. Dump PostgreSQL in custom format to `data/backups/releases/` and validate the archive before any migration. Run Prisma migrations followed by the existing Go SQL migrations, without seeds.
- Switch only API/web/Admin/Caddy. Explicitly validate and reload Caddy; changing a bind-mounted file alone does not activate routes. Probe API readiness, learner, Admin login and public HTTPS with bounded requests. Record successful SHA in `/srv/kotobawork/runtime/release-sha`.
- Readiness failure or INT/TERM restores prior application images and Caddy configuration, then reloads Caddy. Database changes remain forward-applied; only backward-compatible expansion is allowed. A database restore is a separate operator decision, never an automatic destructive rollback.

## Initial imported-database baseline

The pre-release Oracle database was imported without `_prisma_migrations`. Do not run historical migrations blindly on it, and do not reset it. Before enabling the first release:

1. Take and validate a private PostgreSQL snapshot. Restore it into a disposable PostgreSQL 17 instance.
2. Generate Prisma's forward diff from the restored database to the committed schema. Inspect every statement; reject destructive changes. Apply the reviewed additive SQL transactionally.
3. Require an empty Prisma schema diff before marking the historical migration directories as applied with `prisma migrate resolve --applied <directory>`. This records a verified imported-schema baseline, not execution of historical SQL.
4. Run `prisma migrate deploy` and the Go SQL migrations on the clone. Verify existing row counts and relevant data-dependent backfills/permission additions; schema equivalence alone does not prove historical data transformations ran.
5. Repeat only the reviewed sequence against production after fresh backup and passing release checks. Subsequent CI deployments use ordinary `migrate deploy`.

## Verification

Committed, replayable release gates (all run against the working tree being released):

- `python3 deploy/oci/deploy-release.test.py` — release control flow against isolated command fixtures (CI runs it).
- `python3 scripts/release/oci-image-check.py` — control-flow cases, Compose validation, linux/arm64 builds of all four images and runtime start-up of web/Admin as UID 1000 with every JavaScript asset served.
- `python3 scripts/release/search-check.py` — first index plus query against a disposable real Meilisearch.
- `node scripts/release/browser-release.mjs` — learner and Admin journeys in a real browser against a Caddy-fronted stack built from the same tree (`RELEASE_BASE_URL`, `RELEASE_LEARNER_FILE`, `RELEASE_ADMIN_FILE`).

`python3 deploy/oci/deploy-release.test.py` exercises the release control flow against isolated command fixtures. Validate Compose with required environment names set; never print `docker compose config` with real secrets. Run `bash -n deploy/oci/deploy-release.sh`. Canonical Go/frontend/harness suites and the CLOSED release task remain mandatory before pushing.

After deployment, confirm CI SHA = `runtime/release-sha` = API version; test public learner and Admin login through real UI, session persistence, anonymous guards, static assets, reading preference save/refresh, and backend permission coverage for the operator account. Keep generated credentials only in an ignored mode-600 local file and deliver that file privately to the owner. Existing audit blockers remain audit blockers after a successful deployment.
