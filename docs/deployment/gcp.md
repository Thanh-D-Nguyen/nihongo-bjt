# BJT Production GCP Deployment Guide

## Overview

This document describes the production deployment of BJT (Nihongo Business Japanese Test) platform on Google Cloud Platform.

## Architecture

### Infrastructure Stack
- **VM**: Google Compute Engine (e2-standard-2, 2 vCPU, 8GB RAM)
- **OS**: Ubuntu 24.04 LTS
- **Boot Disk**: 50GB pd-balanced with daily snapshots
- **Static IP**: Reserved regional address
- **Reverse Proxy**: Caddy (automatic HTTPS)

### Application Stack
- **API**: NestJS (Node.js 24, port 4000)
- **Web**: Next.js (port 3000)
- **Admin**: Next.js (port 3001)
- **Process Manager**: PM2

### Infrastructure Services (Docker)
- **Database**: PostgreSQL 17 (port 15432, bind 127.0.0.1)
- **Cache**: Redis 8 (port 6379, bind 127.0.0.1)
- **Search**: Meilisearch v1.13 (port 7700, bind 127.0.0.1)
- **Storage**: MinIO (port 9000/9001, bind 127.0.0.1)
- **Auth**: Keycloak 26.2.4 (port 8080, bind 127.0.0.1)

## GCP Resources

### Project Configuration
- **Project ID**: `project-b21f8491-f2df-4f66-9b5`
- **Region**: `asia-southeast1`
- **Zone**: `asia-southeast1-b`

### Compute Resources
- **VM Name**: `bjt-prod`
- **Machine Type**: `e2-standard-2` (2 vCPU, 8GB RAM)
- **Boot Disk**: 50GB pd-balanced
- **Image**: Ubuntu 24.04 LTS (ubuntu-os-cloud)
- **Shielded VM**: Secure boot enabled
- **Network Tag**: `bjt-server`

### Network Configuration
- **Static IP**: `bjt-static-ip` (regional, asia-southeast1)
- **Firewall Rules**:
  - `bjt-web`: Allow TCP 80, 443 from 0.0.0.0/0
  - `bjt-iap-ssh`: Allow TCP 22 from 35.235.240.0/20 (Google IAP only)

### Backup Configuration
- **Snapshot Policy**: `bjt-daily-snapshots`
- **Schedule**: Daily at 03:00
- **Retention**: 7 days
- **Storage Location**: asia

## Deployment Directory Structure

```
/opt/bjt/
├── apps/
│   ├── api/          # NestJS API
│   ├── web/          # Next.js learner app
│   └── admin/        # Next.js admin app
├── packages/
│   └── database/     # Prisma schema
├── deploy/
│   └── gcp/
│       ├── compose.infrastructure.yml
│       ├── ecosystem.config.cjs
│       ├── Caddyfile.template
│       └── runtime/  # Generated secrets (not in git)
└── .env              # Environment variables (not in git)
```

## Environment Variables

### Required Variables (in `.env`)

#### Application URLs
- `NODE_ENV` - production
- `API_PORT` - 4000
- `API_PUBLIC_URL` - https://api.{domain}
- `WEB_PUBLIC_URL` - https://app.{domain}
- `ADMIN_PUBLIC_URL` - https://admin.{domain}
- `CORS_ORIGINS` - Comma-separated allowed origins
- `NEXT_PUBLIC_API_URL` - Public API URL

#### Database
- `DATABASE_URL` - PostgreSQL connection string

#### Redis
- `REDIS_URL` - Redis connection string with password

#### Meilisearch
- `MEILI_HOST` - Meilisearch URL
- `MEILI_MASTER_KEY` - Master key

#### MinIO
- `MINIO_ENDPOINT` - Internal endpoint (127.0.0.1)
- `MINIO_PORT` - 9000
- `MINIO_ACCESS_KEY` - Access key
- `MINIO_SECRET_KEY` - Secret key
- `MINIO_BUCKET` - Bucket name
- `MINIO_USE_SSL` - false
- `MINIO_PUBLIC_ENDPOINT` - Public endpoint (media.{domain})
- `MINIO_PUBLIC_PORT` - 443
- `MINIO_PUBLIC_USE_SSL` - true

#### Keycloak
- `KEYCLOAK_ISSUER_URL` - Issuer URL
- `KEYCLOAK_CLIENT_ID` - Client ID
- `KEYCLOAK_CLIENT_SECRET` - Client secret
- `WEB_KEYCLOAK_*` - Web app Keycloak config
- `ADMIN_KEYCLOAK_*` - Admin app Keycloak config
- `KEYCLOAK_PUBLIC_URL` - Public Keycloak URL

#### OAuth (Optional)
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

#### Image Generation (Optional)
- `IMAGE_PROVIDER` - openai | omniroute | pollinations | xkiro
- `IMAGE_API_KEY`
- `OPENAI_API_KEY`

## Deployment Procedures

### Initial Provisioning

#### Option 1: Using gcloud CLI (Recommended)

1. **Run provision script** (from local machine):
   ```bash
   ./infrastructure/gcp/provision.sh
   ```

2. **Wait for VM bootstrap** (2-3 minutes)

3. **SSH into VM via IAP**:
   ```bash
   gcloud compute ssh deploy@bjt-prod --zone=asia-southeast1-b --tunnel-through-iap
   ```

4. **Upload and run bootstrap script**:
   ```bash
   gcloud compute scp infrastructure/gcp/bootstrap.sh deploy@bjt-prod:/tmp/ --zone=asia-southeast1-b --tunnel-through-iap
   gcloud compute ssh deploy@bjt-prod --zone=asia-southeast1-b --tunnel-through-iap
   sudo bash /tmp/bootstrap.sh
   ```

#### Option 2: Using Google Cloud Console (Web UI)

**Step 1: Create Static IP**

1. Go to [VPC Network > External IP addresses](https://console.cloud.google.com/networking/addresses/list?project=project-b21f8491-f2df-4f66-9b5)
2. Click **Reserve External Address**
3. Configure:
   - Name: `bjt-static-ip`
   - Description: `Static IP for BJT production server`
   - Region: `asia-southeast1`
   - IP version: `IPv4`
   - Type: `Static`
4. Click **Reserve**
5. Note the IP address (e.g., `34.xxx.xxx.xxx`)

**Step 2: Create Firewall Rules**

Create `bjt-web` rule:
1. Go to [VPC Network > Firewall](https://console.cloud.google.com/networking/firewalls/list?project=project-b21f8491-f2df-4f66-9b5)
2. Click **Create Firewall Rule**
3. Configure:
   - Name: `bjt-web`
   - Description: `Allow HTTP/HTTPS traffic to BJT server`
   - Network: `default`
   - Priority: `1000`
   - Direction: `Ingress`
   - Action: `Allow`
   - Targets: `Specified target tags`
   - Target tags: `bjt-server`
   - Source filter: `IPv4 ranges`
   - Source IPv4 ranges: `0.0.0.0/0`
   - Protocols and ports: Check `tcp` and enter `80, 443`
4. Click **Create**

Create `bjt-iap-ssh` rule:
1. Click **Create Firewall Rule**
2. Configure:
   - Name: `bjt-iap-ssh`
   - Description: `Allow SSH from Google IAP for BJT server`
   - Network: `default`
   - Priority: `1000`
   - Direction: `Ingress`
   - Action: `Allow`
   - Targets: `Specified target tags`
   - Target tags: `bjt-server`
   - Source filter: `IPv4 ranges`
   - Source IPv4 ranges: `35.235.240.0/20`
   - Protocols and ports: Check `tcp` and enter `22`
3. Click **Create**

**Step 3: Create VM Instance**

1. Go to [Compute Engine > VM instances](https://console.cloud.google.com/compute/instances?project=project-b21f8491-f2df-4f66-9b5)
2. Click **Create Instance**
3. Configure:
   - **Name**: `bjt-prod`
   - **Region**: `asia-southeast1`
   - **Zone**: `asia-southeast1-b`
   - **Machine configuration**:
     - Family: `General-purpose`
     - Series: `E2`
     - Machine type: `e2-standard-2` (2 vCPU, 8 GB memory)
   - **Boot disk**: Click **Change**
     - Operating system: `Ubuntu`
     - Version: `Ubuntu 24.04 LTS (x86/64, amd64, noble)`
     - Boot disk type: `Balanced persistent disk`
     - Size: `50 GB`
     - Click **Select**
   - **Identity and API access**:
     - Service account: `Compute Engine default service account`
     - Access scopes: `Allow default access` (or customize if needed)
   - **Firewall**: Check `Allow HTTP traffic` and `Allow HTTPS traffic`
   - **Advanced options** > **Networking**:
     - Network tags: Add `bjt-server`
     - Network interfaces: Click the default interface
       - External IPv4 address: Select your reserved `bjt-static-ip`
       - Click **Done**
   - **Advanced options** > **Security**:
     - Check `Turn on vTPM`
     - Check `Turn on Integrity Monitoring`
     - Check `Turn on Secure Boot`
   - **Advanced options** > **Management**:
     - Add startup script (copy from `infrastructure/gcp/provision.sh` line 163-211, the `startup_script` variable)
4. Click **Create**

**Step 4: Wait for Bootstrap**

1. Wait 2-3 minutes for the VM to start and run the bootstrap script
2. Check VM status: Should show **Running**
3. Click on the VM name to see details
4. Check the serial port output for bootstrap progress

**Step 5: Deploy Application**

1. Click **SSH** button next to the VM to open Cloud Shell SSH
2. Or use IAP tunnel from your terminal:
   ```bash
   gcloud compute ssh deploy@bjt-prod --zone=asia-southeast1-b --tunnel-through-iap
   ```
3. Once connected, run the bootstrap script (see below)

### Deploy New Release

1. **SSH into VM**:
   ```bash
   gcloud compute ssh deploy@bjt-prod --zone=asia-southeast1-b --tunnel-through-iap
   ```

2. **Run deployment**:
   ```bash
   cd /opt/bjt
   ./deploy/gcp/deploy-release.sh
   ```

### Rollback Procedure

1. **SSH into VM**

2. **Check available snapshots**:
   ```bash
   gcloud compute snapshots list --filter="sourceDisk:bjt-prod"
   ```

3. **Create new disk from snapshot**:
   ```bash
   gcloud compute disks create bjt-prod-rollback \
     --zone=asia-southeast1-b \
     --source-snapshot={snapshot-name}
   ```

4. **Stop VM and swap disk** (via Console or gcloud)

### Update Configuration

1. **Edit `.env`**:
   ```bash
   sudo nano /opt/bjt/.env
   ```

2. **Restart services**:
   ```bash
   cd /opt/bjt
   sudo -u deploy pm2 restart all
   ```

## Operations Commands

### Application Management
```bash
# View logs
sudo -u deploy pm2 logs

# Restart all apps
sudo -u deploy pm2 restart all

# Stop all apps
sudo -u deploy pm2 stop all

# View status
sudo -u deploy pm2 status
```

### Infrastructure Management
```bash
# View containers
docker compose -f deploy/gcp/compose.infrastructure.yml ps

# Restart containers
docker compose -f deploy/gcp/compose.infrastructure.yml restart

# View container logs
docker compose -f deploy/gcp/compose.infrastructure.yml logs -f

# Stop infrastructure
docker compose -f deploy/gcp/compose.infrastructure.yml down
```

### Database Operations
```bash
# Backup database
./deploy/gcp/backup-postgres.sh

# Run migrations
sudo -u deploy pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma

# Check migration status
sudo -u deploy pnpm exec prisma migrate status --schema packages/database/prisma/schema.prisma
```

## Health Verification

### Application Health
```bash
# API health check
curl http://localhost:4000/api/health/ready

# Web health check
curl -I http://localhost:3000

# Admin health check
curl -I http://localhost:3001
```

### Infrastructure Health
```bash
# Check container status
docker compose -f deploy/gcp/compose.infrastructure.yml ps

# Check PostgreSQL
docker exec nihongo-bjt-postgres pg_isready -U postgres

# Check Redis
docker exec nihongo-bjt-redis redis-cli -a $REDIS_PASSWORD ping
```

## Backup and Restore

### Automated Backups
- **Disk Snapshots**: Daily at 03:00, 7-day retention
- **Database**: Run `./deploy/gcp/backup-postgres.sh` manually or via cron

### Manual Database Backup
```bash
cd /opt/bjt
./deploy/gcp/backup-postgres.sh
# Creates: /opt/bjt/backups/postgres-{timestamp}.sql.gz
```

### Restore from Snapshot
1. Stop VM
2. Create new disk from snapshot
3. Detach old disk, attach new disk
4. Start VM

### Restore Database
```bash
gunzip -c backup.sql.gz | docker exec -i nihongo-bjt-postgres psql -U postgres -d nihongo_bjt
```

## Security Controls

### Network Security
- SSH only via Google IAP (35.235.240.0/20)
- No public database/cache ports
- All infrastructure services bind to 127.0.0.1
- HTTPS enforced via Caddy

### Access Control
- OS Login enabled
- Deploy user with limited privileges
- Docker group membership for deploy user

### Secrets Management
- Runtime secrets generated by `prepare-runtime.sh`
- Stored in `/opt/bjt/deploy/gcp/runtime/` (not in git)
- `.env` file with 0600 permissions
- No secrets in repository

### Service Account
- Default compute service account with minimal scopes
- No Editor/Owner roles

## Estimated Monthly Cost

### Compute Engine
- **VM (e2-standard-2)**: ~$48/month (sustained use discount)
- **Boot disk (50GB pd-balanced)**: ~$5/month
- **Static IP**: ~$2/month (if unused, free when attached)

### Storage
- **Snapshots**: ~$1-2/month (depends on disk changes)

### Network
- **Egress**: ~$0.12/GB after 10GB free tier

### Total Estimate
**~$55-60/month** (excluding network egress)

## DNS Configuration

After deployment, configure DNS records:

```
A     app.{domain}      → {static-ip}
A     admin.{domain}    → {static-ip}
A     api.{domain}      → {static-ip}
A     auth.{domain}     → {static-ip}
A     media.{domain}    → {static-ip}
```

Caddy will automatically provision TLS certificates via Let's Encrypt.

## Unconfigured Features

The following features require additional configuration:

### Google OAuth
1. Create OAuth credentials in Google Cloud Console
2. Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`
3. Configure Keycloak Google IdP:
   ```bash
   ./deploy/gcp/configure-keycloak-google-idp.sh
   ```

### Email Notifications
- Configure SMTP settings in Keycloak

### Monitoring
- Setup Google Cloud Monitoring
- Configure alerting policies

### CDN
- Consider Google Cloud CDN for static assets
- Configure MinIO public endpoint with CDN

## Troubleshooting

### VM Won't Start
```bash
# Check serial console
gcloud compute instances get-serial-port-output bjt-prod --zone=asia-southeast1-b
```

### Application Won't Start
```bash
# Check PM2 logs
sudo -u deploy pm2 logs nihongo-api
sudo -u deploy pm2 logs nihongo-web

# Check container logs
docker compose -f deploy/gcp/compose.infrastructure.yml logs
```

### Database Connection Issues
```bash
# Test connection
docker exec -it nihongo-bjt-postgres psql -U postgres -d nihongo_bjt

# Check PostgreSQL logs
docker logs nihongo-bjt-postgres
```

### Caddy Certificate Issues
```bash
# Check Caddy logs
journalctl -u caddy -f

# Reload Caddy
systemctl reload caddy
```

## Support

For issues not covered in this document:
1. Check application logs: `sudo -u deploy pm2 logs`
2. Check infrastructure logs: `docker compose -f deploy/gcp/compose.infrastructure.yml logs`
3. Review GCP Console for resource status
4. Verify firewall rules and network configuration