# BJT GCP Deployment - Console Step-by-Step Guide

This guide walks you through creating the BJT production server using Google Cloud Console.

## Prerequisites

- Google Cloud account with billing enabled
- Project: `project-b21f8491-f2df-4f66-9b5`
- Access to Cloud Console

---

## Step 1: Create Static IP Address

1. Open [VPC Network > External IP addresses](https://console.cloud.google.com/networking/addresses/list?project=project-b21f8491-f2df-4f66-9b5)

2. Click **RESERVE EXTERNAL ADDRESS**

3. Fill in:
   - **Name**: `bjt-static-ip`
   - **Description**: `Static IP for BJT production server`
   - **Network Service Tier**: Premium (default)
   - **Region**: `asia-southeast1`
   - **IP version**: IPv4
   - **Type**: Static

4. Click **RESERVE**

5. **Note the IP address** (e.g., `34.xxx.xxx.xxx`) - you'll need this for DNS later

---

## Step 2: Create Firewall Rules

### Rule 1: bjt-web (HTTP/HTTPS)

1. Open [VPC Network > Firewall](https://console.cloud.google.com/networking/firewalls/list?project=project-b21f8491-f2df-4f66-9b5)

2. Click **CREATE FIREWALL RULE**

3. Fill in:
   - **Name**: `bjt-web`
   - **Description**: `Allow HTTP/HTTPS traffic to BJT server`
   - **Network**: `default`
   - **Priority**: `1000`
   - **Direction of traffic**: Ingress
   - **Action on match**: Allow
   - **Targets**: Specified target tags
   - **Target tags**: `bjt-server`
   - **Source filter**: IPv4 ranges
   - **Source IPv4 ranges**: `0.0.0.0/0`
   - **Protocols and ports**: 
     - Check `tcp`
     - Enter: `80, 443`

4. Click **CREATE**

### Rule 2: bjt-iap-ssh (SSH via IAP)

1. Click **CREATE FIREWALL RULE**

2. Fill in:
   - **Name**: `bjt-iap-ssh`
   - **Description**: `Allow SSH from Google IAP for BJT server`
   - **Network**: `default`
   - **Priority**: `1000`
   - **Direction of traffic**: Ingress
   - **Action on match**: Allow
   - **Targets**: Specified target tags
   - **Target tags**: `bjt-server`
   - **Source filter**: IPv4 ranges
   - **Source IPv4 ranges**: `35.235.240.0/20`
   - **Protocols and ports**:
     - Check `tcp`
     - Enter: `22`

3. Click **CREATE**

---

## Step 3: Create Snapshot Policy

1. Open [Compute Engine > Snapshots > Snapshot schedules](https://console.cloud.google.com/compute/snapshots?project=project-b21f8491-f2df-4f66-9b5&tab=snapshot_schedules)

2. Click **CREATE SNAPSHOT SCHEDULE**

3. Fill in:
   - **Name**: `bjt-daily-snapshots`
   - **Description**: `Daily snapshots for BJT production disk with 7-day retention`
   - **Region**: `asia-southeast1`
   - **Schedule frequency**: Daily
   - **Start time**: 3:00 AM
   - **Auto-delete snapshots after**: 7 days
   - **Deletion rule for auto snapshots on disk deletion**: Keep auto snapshots

4. Click **CREATE**

---

## Step 4: Create VM Instance

1. Open [Compute Engine > VM instances](https://console.cloud.google.com/compute/instances?project=project-b21f8491-f2df-4f66-9b5)

2. Click **CREATE INSTANCE**

3. **Basic configuration**:
   - **Name**: `bjt-prod`
   - **Region**: `asia-southeast1`
   - **Zone**: `asia-southeast1-b`

4. **Machine configuration**:
   - **Family**: General-purpose
   - **Series**: E2
   - **Machine type**: `e2-standard-2` (2 vCPU, 8 GB memory)

5. **Boot disk** (click **CHANGE**):
   - **Operating system**: Ubuntu
   - **Version**: Ubuntu 24.04 LTS (x86/64, amd64, noble)
   - **Boot disk type**: Balanced persistent disk
   - **Size**: 50 GB
   - Click **SELECT**

6. **Firewall**:
   - Check ✅ **Allow HTTP traffic**
   - Check ✅ **Allow HTTPS traffic**

7. Expand **Advanced options**

8. **Networking** section:
   - **Network tags**: Add `bjt-server`
   - **Network interfaces** (click the dropdown):
     - **Network**: default
     - **External IPv4 address**: Select your reserved `bjt-static-ip`
     - Click **DONE**

9. **Security** section:
   - Check ✅ **Turn on vTPM**
   - Check ✅ **Turn on Integrity Monitoring**
   - Check ✅ **Turn on Secure Boot**

10. **Management** section:
    - Copy the entire content from `infrastructure/gcp/startup-script.sh`
    - Paste into **Startup script** field

11. **Service account**:
    - Select: Compute Engine default service account
    - **Access scopes**: Allow default access

12. Click **CREATE**

---

## Step 5: Wait for VM to Bootstrap

1. Wait **2-3 minutes** for the VM to start and run the bootstrap script

2. Check VM status: Should show **Running** (green checkmark)

3. Click on the VM name `bjt-prod` to see details

4. Check the serial port output to see bootstrap progress:
   - Click **SERIAL PORT 1 (CONSOLE)**
   - Look for: `Bootstrap complete. Ready for deployment.`

---

## Step 6: SSH into VM

### Option A: Using Cloud Console (Easiest)

1. In the VM instances list, find `bjt-prod`

2. Click the **SSH** button next to it

3. A terminal window will open in your browser

### Option B: Using gcloud CLI (Recommended)

Open your local terminal and run:

```bash
gcloud compute ssh deploy@bjt-prod --zone=asia-southeast1-b --tunnel-through-iap
```

---

## Step 7: Deploy Application

Once you're SSH'd into the VM, run these commands:

```bash
# Switch to deploy user
sudo -u deploy -i

# Navigate to deployment directory
cd /opt/bjt

# Clone the repository
git clone https://github.com/thanhnguyen/nihongo-bjt.git .

# Set base domain (replace with your actual domain or use IP-based)
export BASE_DOMAIN="yourdomain.com"
# OR for testing: export BASE_DOMAIN="34.xxx.xxx.xxx.sslip.io"

# Generate runtime secrets and configuration
./deploy/gcp/prepare-runtime.sh

# Start infrastructure containers
docker compose -f deploy/gcp/compose.infrastructure.yml up -d

# Wait for containers to be healthy (about 30 seconds)
sleep 30
docker compose -f deploy/gcp/compose.infrastructure.yml ps

# Install dependencies
pnpm install --frozen-lockfile

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma

# Seed initial data
pnpm seed:bjt:official-mocks
pnpm seed:bjt-lessons

# Build applications
pnpm build

# Index search
pnpm search:index

# Install PM2 if not present
npm list -g pm2 || npm install -g pm2

# Setup PM2 to start on boot
pm2 startup systemd -u deploy --hp /home/deploy

# Start applications
pm2 start deploy/gcp/ecosystem.config.cjs
pm2 save

# Verify health
curl http://localhost:4000/api/health/ready

# Exit deploy user
exit
```

---

## Step 8: Configure Caddy Reverse Proxy

```bash
# Copy Caddyfile
sudo cp /opt/bjt/deploy/gcp/runtime/Caddyfile /etc/caddy/Caddyfile

# Reload Caddy
sudo systemctl reload caddy

# Check Caddy status
sudo systemctl status caddy
```

---

## Step 9: Verify Deployment

### Check Applications

```bash
# View PM2 status
sudo -u deploy pm2 status

# View logs
sudo -u deploy pm2 logs

# Test endpoints
curl http://localhost:3000  # Web app
curl http://localhost:3001  # Admin app
curl http://localhost:4000/api/health/ready  # API health
```

### Check Infrastructure

```bash
# View container status
docker compose -f /opt/bjt/deploy/gcp/compose.infrastructure.yml ps

# Check PostgreSQL
docker exec nihongo-bjt-postgres pg_isready -U postgres

# Check Redis
docker exec nihongo-bjt-redis redis-cli ping
```

---

## Step 10: Configure DNS

Add these DNS records pointing to your static IP:

```
Type    Name              Value
A       app.yourdomain.com    → YOUR_STATIC_IP
A       admin.yourdomain.com  → YOUR_STATIC_IP
A       api.yourdomain.com    → YOUR_STATIC_IP
A       auth.yourdomain.com   → YOUR_STATIC_IP
A       media.yourdomain.com  → YOUR_STATIC_IP
```

Caddy will automatically provision TLS certificates once DNS is configured.

---

## Verification Checklist

- [ ] VM status is RUNNING
- [ ] Static IP `bjt-static-ip` is attached to `bjt-prod`
- [ ] Firewall rules `bjt-web` and `bjt-iap-ssh` are active
- [ ] Snapshot policy `bjt-daily-snapshots` is attached
- [ ] SSH via IAP works
- [ ] All Docker containers are healthy
- [ ] PM2 applications are running
- [ ] API health check passes
- [ ] Caddy is serving traffic
- [ ] DNS records are configured (if using custom domain)
- [ ] Gitea server at 34.143.229.138 is unchanged

---

## Troubleshooting

### VM won't start
```bash
gcloud compute instances get-serial-port-output bjt-prod --zone=asia-southeast1-b
```

### Can't SSH
- Verify firewall rule `bjt-iap-ssh` exists
- Check VM has network tag `bjt-server`
- Try: `gcloud compute ssh deploy@bjt-prod --zone=asia-southeast1-b --tunnel-through-iap`

### Containers not starting
```bash
cd /opt/bjt
docker compose -f deploy/gcp/compose.infrastructure.yml logs
```

### Applications won't start
```bash
sudo -u deploy pm2 logs nihongo-api
sudo -u deploy pm2 logs nihongo-web
```

---

## Next Steps

1. Configure Google OAuth credentials if needed
2. Setup email notifications in Keycloak
3. Configure monitoring and alerting
4. Setup automated database backups (cron job)
5. Test full deployment workflow with `deploy-release.sh`

---

## Operations Commands

```bash
# SSH into VM
gcloud compute ssh deploy@bjt-prod --zone=asia-southeast1-b --tunnel-through-iap

# Deploy new release
cd /opt/bjt && ./deploy/gcp/deploy-release.sh

# View logs
sudo -u deploy pm2 logs

# Restart applications
sudo -u deploy pm2 restart all

# Restart infrastructure
docker compose -f /opt/bjt/deploy/gcp/compose.infrastructure.yml restart

# Backup database
cd /opt/bjt && ./deploy/gcp/backup-postgres.sh
```

---

## Cost Estimate

- **VM (e2-standard-2)**: ~$48/month
- **Boot disk (50GB pd-balanced)**: ~$5/month
- **Static IP**: ~$2/month (free when attached)
- **Snapshots**: ~$1-2/month
- **Network egress**: ~$0.12/GB after 10GB free tier

**Total**: ~$55-60/month (excluding network egress)