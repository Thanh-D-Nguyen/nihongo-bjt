#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# BJT Production GCP Provisioning Script
# Creates VM, static IP, firewall rules, and snapshot policy
# Idempotent: safe to re-run without duplicating resources
# =============================================================================

# Configuration - can be overridden via environment variables
PROJECT_ID="${PROJECT_ID:-project-b21f8491-f2df-4f66-9b5}"
ZONE="${ZONE:-asia-southeast1-b}"
REGION="${REGION:-asia-southeast1}"

VM_NAME="${VM_NAME:-bjt-prod}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-standard-2}"
BOOT_DISK_SIZE="${BOOT_DISK_SIZE:-50GB}"
BOOT_DISK_TYPE="${BOOT_DISK_TYPE:-pd-balanced}"
IMAGE_FAMILY="${IMAGE_FAMILY:-ubuntu-2404-lts-amd64}"
IMAGE_PROJECT="${IMAGE_PROJECT:-ubuntu-os-cloud}"

ADDRESS_NAME="${ADDRESS_NAME:-bjt-static-ip}"
NETWORK_TAG="${NETWORK_TAG:-bjt-server}"
FIREWALL_WEB="${FIREWALL_WEB:-bjt-web}"
FIREWALL_IAP_SSH="${FIREWALL_IAP_SSH:-bjt-iap-ssh}"
SNAPSHOT_POLICY="${SNAPSHOT_POLICY:-bjt-daily-snapshots}"

# Gitea resources - DO NOT MODIFY
GITEA_VM="gitea-prod"
GITEA_IP="34.143.229.138"
GITEA_TAG="gitea-server"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

check_gcloud() {
  if ! command -v gcloud &>/dev/null; then
    log "ERROR: gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
    exit 1
  fi

  local current_project
  current_project=$(gcloud config get-value project 2>/dev/null || true)

  if [[ "$current_project" != "$PROJECT_ID" ]]; then
    log "ERROR: Wrong project. Current: $current_project, Expected: $PROJECT_ID"
    log "Run: gcloud config set project $PROJECT_ID"
    exit 1
  fi

  local account
  account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
  if [[ -z "$account" ]]; then
    log "ERROR: No active gcloud account. Run: gcloud auth login"
    exit 1
  fi

  log "✓ gcloud configured: project=$PROJECT_ID, account=$account"
}

check_gitea_intact() {
  log "Verifying Gitea resources are intact..."

  local gitea_status
  gitea_status=$(gcloud compute instances describe "$GITEA_VM" --zone="$ZONE" --format="value(status)" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$gitea_status" == "NOT_FOUND" ]]; then
    log "WARNING: Gitea VM not found (may be in different zone)"
  elif [[ "$gitea_status" != "RUNNING" ]]; then
    log "WARNING: Gitea VM status is $gitea_status (expected RUNNING)"
  else
    log "✓ Gitea VM is RUNNING"
  fi

  local gitea_ip_check
  gitea_ip_check=$(gcloud compute addresses describe "gitea-static-ip" --region="$REGION" --format="value(address)" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$gitea_ip_check" != "$GITEA_IP" ]]; then
    log "WARNING: Gitea static IP mismatch (expected $GITEA_IP, got $gitea_ip_check)"
  else
    log "✓ Gitea static IP intact: $GITEA_IP"
  fi
}

check_quota() {
  log "Checking quota..."

  local cpu_limit cpu_usage
  cpu_limit=$(gcloud compute regions describe "$REGION" --format="value(quotas.filter(metric:CPUS).limit)" 2>/dev/null | head -1)
  cpu_usage=$(gcloud compute regions describe "$REGION" --format="value(quotas.filter(metric:CPUS).usage)" 2>/dev/null | head -1)

  log "CPU quota: $cpu_usage / $cpu_limit"

  if [[ -n "$cpu_limit" && -n "$cpu_usage" ]]; then
    local available
    available=$((cpu_limit - cpu_usage))
    if [[ $available -lt 2 ]]; then
      log "ERROR: Insufficient CPU quota. Available: $available, Required: 2"
      exit 1
    fi
    log "✓ Sufficient CPU quota (available: $available)"
  fi
}

check_existing_vm() {
  log "Checking if VM already exists..."

  local vm_status
  vm_status=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(status)" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$vm_status" != "NOT_FOUND" ]]; then
    log "VM '$VM_NAME' already exists with status: $vm_status"
    if [[ "$vm_status" == "RUNNING" ]]; then
      log "✓ VM is ready for deployment"
      return 0
    fi
    log "VM exists but not running. You may need to start it or delete it first."
    exit 1
  fi

  log "VM does not exist, will create new one"
  return 1
}

create_static_ip() {
  log "Creating static IP: $ADDRESS_NAME..."

  local existing_ip
  existing_ip=$(gcloud compute addresses describe "$ADDRESS_NAME" --region="$REGION" --format="value(address)" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$existing_ip" != "NOT_FOUND" ]]; then
    log "✓ Static IP already exists: $existing_ip"
    echo "$existing_ip"
    return 0
  fi

  gcloud compute addresses create "$ADDRESS_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --description="Static IP for BJT production server"

  local new_ip
  new_ip=$(gcloud compute addresses describe "$ADDRESS_NAME" --region="$REGION" --format="value(address)")
  log "✓ Created static IP: $new_ip"
  echo "$new_ip"
}

create_firewall_web() {
  log "Creating firewall rule: $FIREWALL_WEB..."

  local existing_fw
  existing_fw=$(gcloud compute firewall-rules describe "$FIREWALL_WEB" --format="value(name)" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$existing_fw" != "NOT_FOUND" ]]; then
    log "✓ Firewall rule already exists: $FIREWALL_WEB"
    return 0
  fi

  gcloud compute firewall-rules create "$FIREWALL_WEB" \
    --project="$PROJECT_ID" \
    --network=default \
    --action=ALLOW \
    --rules=tcp:80,tcp:443 \
    --source-ranges=0.0.0.0/0 \
    --target-tags="$NETWORK_TAG" \
    --description="Allow HTTP/HTTPS traffic to BJT server"

  log "✓ Created firewall rule: $FIREWALL_WEB"
}

create_firewall_iap_ssh() {
  log "Creating firewall rule: $FIREWALL_IAP_SSH..."

  local existing_fw
  existing_fw=$(gcloud compute firewall-rules describe "$FIREWALL_IAP_SSH" --format="value(name)" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$existing_fw" != "NOT_FOUND" ]]; then
    log "✓ Firewall rule already exists: $FIREWALL_IAP_SSH"
    return 0
  fi

  gcloud compute firewall-rules create "$FIREWALL_IAP_SSH" \
    --project="$PROJECT_ID" \
    --network=default \
    --action=ALLOW \
    --rules=tcp:22 \
    --source-ranges=35.235.240.0/20 \
    --target-tags="$NETWORK_TAG" \
    --description="Allow SSH from Google IAP for BJT server"

  log "✓ Created firewall rule: $FIREWALL_IAP_SSH"
}

create_snapshot_policy() {
  log "Creating snapshot policy: $SNAPSHOT_POLICY..."

  local existing_policy
  existing_policy=$(gcloud compute resource-policies describe "$SNAPSHOT_POLICY" --region="$REGION" --format="value(name)" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$existing_policy" != "NOT_FOUND" ]]; then
    log "✓ Snapshot policy already exists: $SNAPSHOT_POLICY"
    return 0
  fi

  gcloud compute resource-policies create snapshot-schedule "$SNAPSHOT_POLICY" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --on-source-disk-delete=keep-auto-snapshots \
    --daily-schedule \
    --start-time="03:00" \
    --storage-location=asia \
    --retention-policy-duration=7d \
    --description="Daily snapshots for BJT production disk with 7-day retention"

  log "✓ Created snapshot policy: $SNAPSHOT_POLICY"
}

create_vm() {
  local static_ip="$1"
  log "Creating VM: $VM_NAME..."

  local startup_script
  startup_script=$(cat <<'STARTUP_EOF'
#!/bin/bash
# BJT Production VM Bootstrap Script
set -euo pipefail

log() {
  logger -t bjt-bootstrap "$*"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "Starting BJT bootstrap..."

# Update system
apt-get update
apt-get upgrade -y

# Install essential tools
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  jq \
  unzip \
  software-properties-common

# Install Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Configure Docker
systemctl enable docker
systemctl start docker

# Create deploy user
if ! id -u deploy &>/dev/null; then
  useradd -m -s /bin/bash -G docker deploy
  log "Created deploy user"
fi

# Setup deployment directory
mkdir -p /opt/bjt
chown deploy:deploy /opt/bjt
chmod 755 /opt/bjt

# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@10

# Install Caddy
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

# Enable Caddy service
systemctl enable caddy
systemctl start caddy

# Configure log rotation
cat > /etc/logrotate.d/bjt <<EOF
/opt/bjt/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        systemctl reload caddy || true
    endscript
}
EOF

# Configure Docker to restart after reboot
cat > /etc/docker/daemon.json <<EOF
{
  "live-restore": true,
  "storage-driver": "overlay2"
}
EOF
systemctl restart docker

log "Bootstrap complete. Ready for deployment."
STARTUP_EOF
)

  gcloud compute instances create "$VM_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --network-interface="network=default,address=$static_ip" \
    --tags="$NETWORK_TAG" \
    --image-family="$IMAGE_FAMILY" \
    --image-project="$IMAGE_PROJECT" \
    --boot-disk-size="$BOOT_DISK_SIZE" \
    --boot-disk-type="$BOOT_DISK_TYPE" \
    --shielded-secure-boot \
    --metadata-from-file="startup-script=<(echo '$startup_script')" \
    --scopes="cloud-platform" \
    --service-account="$(gcloud compute project-info describe --format='value(defaultServiceAccount)')" \
    --description="BJT production server"

  log "✓ Created VM: $VM_NAME"
}

attach_snapshot_policy() {
  log "Attaching snapshot policy to VM disk..."

  gcloud compute disks add-resource-policies "$VM_NAME" \
    --zone="$ZONE" \
    --resource-policies="$SNAPSHOT_POLICY" \
    --project="$PROJECT_ID" || log "Note: Snapshot policy may already be attached"

  log "✓ Snapshot policy attached"
}

print_summary() {
  local static_ip="$1"

  echo ""
  echo "============================================================"
  echo "BJT Production Provisioning Complete"
  echo "============================================================"
  echo ""
  echo "Project:     $PROJECT_ID"
  echo "Zone:        $ZONE"
  echo "VM Name:     $VM_NAME"
  echo "Machine:     $MACHINE_TYPE"
  echo "Static IP:   $static_ip"
  echo "Network Tag: $NETWORK_TAG"
  echo ""
  echo "Firewall Rules:"
  echo "  - $FIREWALL_WEB (80, 443 from 0.0.0.0/0)"
  echo "  - $FIREWALL_IAP_SSH (22 from IAP only)"
  echo ""
  echo "Snapshot Policy: $SNAPSHOT_POLICY (daily, 7-day retention)"
  echo ""
  echo "Next Steps:"
  echo "  1. Wait 2-3 minutes for VM bootstrap to complete"
  echo "  2. SSH via IAP: gcloud compute ssh deploy@$VM_NAME --zone=$ZONE --tunnel-through-iap"
  echo "  3. Clone repo and run deployment"
  echo ""
  echo "Gitea Status: UNCHANGED (IP: $GITEA_IP)"
  echo "============================================================"
}

main() {
  log "Starting BJT GCP provisioning..."

  check_gcloud
  check_gitea_intact
  check_quota

  if check_existing_vm; then
    local existing_ip
    existing_ip=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null)
    print_summary "$existing_ip"
    exit 0
  fi

  local static_ip
  static_ip=$(create_static_ip)

  create_firewall_web
  create_firewall_iap_ssh
  create_snapshot_policy
  create_vm "$static_ip"

  sleep 10
  attach_snapshot_policy

  print_summary "$static_ip"
}

main "$@"