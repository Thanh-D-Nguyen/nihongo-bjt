# Oracle Cloud parallel deployment

This environment runs beside GCP. Do not point production DNS at it until data backup, restore, functional tests, and cutover are approved.

## Free allowance and instance

- Home region: `ap-tokyo-1`; on-demand `VM.Standard.A1.Flex`, 4 OCPU, 24 GB RAM, Ubuntu 24.04 ARM64.
- A 31-day month uses 2,976 of 3,000 free OCPU-hours and 17,856 of 18,000 free GB-hours on the paid tenancy.
- Boot: 50 GB Balanced (10 VPU/GB). Data: 150 GB Lower Cost (0 VPU/GB). Total active volume storage: 200 of 200 GB.
- Two retained Gitea boot-volume backups and one each for the KotobaWork boot and data volumes use four of five free backup slots. Backups do not consume active volume capacity.
- OCI Console's rate-card estimate does not include tier unit pricing. Review actual Cost Analysis after telemetry arrives and keep the ¥100 budget alerts enabled.

## Runtime

The data volume is mounted by UUID at `/srv/kotobawork/data`. Docker and the app services require this mount, preventing startup against empty directories on the boot disk. The VM uses the existing `deploy/gcp/compose.infrastructure.yml` with `deploy/oci/compose.data.yml`, which moves every stateful service to the data volume. PostgreSQL, Redis, Meilisearch, MinIO, Keycloak and its database run in Docker. API, web and admin run as the `ubuntu` user under `kotobawork@api`, `kotobawork@web`, and `kotobawork@admin` systemd services. Caddy runs on the host.

`deploy/oci/Dockerfile.minio` builds the ARM64 MinIO Community binary from a pinned official source commit. The old `minio/minio` registry image is unavailable. The upstream community repository is archived; review this dependency before production cutover.

Infrastructure startup:

```bash
sudo docker build -t kotobawork-minio:7aac2a2 -f deploy/oci/Dockerfile.minio deploy/oci
sudo docker compose --env-file deploy/gcp/runtime/infrastructure.env \
  -f deploy/gcp/compose.infrastructure.yml -f deploy/oci/compose.data.yml up -d
sudo systemctl restart kotobawork@api kotobawork@web kotobawork@admin caddy
```

`deploy/gcp/prepare-runtime.sh` generated the VM's `.env`, Keycloak realm import, and infrastructure environment on first setup. **Do not rerun it on an existing deployment:** it generates new secrets. These files are stored only on the VM; `.env` and `infrastructure.env` have mode `600`.

The temporary TLS names are `app`, `admin`, `api`, `auth`, and `media` under the VM's `sslip.io` IP hostname. `deploy/oci/Caddyfile.template` routes them locally and restricts Keycloak `/admin*` to the operator IP. OCI and UFW allow public 80/443; SSH 22 is restricted to that IP. Database, cache, search and MinIO console ports bind to loopback only.

## Backups and checks

`kotobawork-backup.timer` runs `deploy/gcp/backup-postgres.sh` daily at 03:00 UTC. Its backup directory is linked to `/srv/kotobawork/data/backups/postgres`; dumps are mode `600` and retained seven days. Both databases were restored from these dumps in disposable databases. The separate OCI boot and data volume backups provide a recovery point outside the VM. Keep backup count at or below five and refresh them deliberately; the local dumps and one-time OCI snapshots are not a continuous off-volume backup schedule.

```bash
findmnt /srv/kotobawork/data
sudo docker compose --env-file deploy/gcp/runtime/infrastructure.env \
  -f deploy/gcp/compose.infrastructure.yml -f deploy/oci/compose.data.yml ps
systemctl is-active kotobawork@api kotobawork@web kotobawork@admin caddy
curl -fsS https://api.<IP-HOSTNAME>/api/health/ready
```

Do not run `prepare-runtime.sh` or seed scripts against migrated production data without reviewing their effects. OCI is currently a separate seeded environment.
