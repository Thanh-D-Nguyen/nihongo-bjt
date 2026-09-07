#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# BJT Production Bootstrap Script
# Run on the VM after provisioning to setup application environment
# Idempotent: safe to re-run
# =============================================================================

DEPLOY_DIR="${DEPLOY_DIR:-/opt/bjt}"
REPO_URL="${REPO_URL:-https://github.com/thanhnguyen/nihongo-bjt.git}"
BRANCH="${BRANCH:-main}"
BASE_DOMAIN="${BASE_DOMAIN:-}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

check_root() {
  if [[ $EUID -ne 0 ]]; then
    log "ERROR: This script must be run as root"
    exit 1
  fi
}

check_dependencies() {
  log "Checking dependencies..."

  local missing=()
  for cmd in git docker node pnpm caddy; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    log "ERROR: Missing dependencies: ${missing[*]}"
    log "Run provision.sh first to install all dependencies"
    exit 1
  fi

  log "✓ All dependencies present"
}

setup_deploy_user() {
  log "Setting up deploy user..."

  if ! id -u deploy &>/dev/null; then
    useradd -m -s /bin/bash deploy
    log "Created deploy user"
  fi

  # Add deploy to docker group
  usermod -aG docker deploy || true

  # Setup SSH directory
  mkdir -p /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  chown deploy:deploy /home/deploy/.ssh

  log "✓ Deploy user configured"
}

clone_repository() {
  log "Cloning repository to $DEPLOY_DIR..."

  mkdir -p "$(dirname "$DEPLOY_DIR")"

  if [[ -d "$DEPLOY_DIR/.git" ]]; then
    log "Repository already exists, updating..."
    cd "$DEPLOY_DIR"
    sudo -u deploy git fetch origin
    sudo -u deploy git reset --hard "origin/$BRANCH"
  else
    # Clone as deploy user
    sudo -u deploy git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
  fi

  log "✓ Repository ready at $DEPLOY_DIR"
}

setup_infrastructure() {
  log "Starting infrastructure containers..."

  cd "$DEPLOY_DIR"

  # Generate runtime secrets if not exists
  if [[ ! -f "deploy/gcp/runtime/infrastructure.env" ]]; then
    log "Generating runtime secrets..."
    if [[ -z "$BASE_DOMAIN" ]]; then
      # Use IP-based domain for initial setup
      local vm_ip
      vm_ip=$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H "Metadata-Flavor: Google")
      BASE_DOMAIN="${vm_ip}.sslip.io"
    fi

    BASE_DOMAIN="$BASE_DOMAIN" ./deploy/gcp/prepare-runtime.sh
  fi

  # Start infrastructure containers
  log "Starting infrastructure containers..."
  docker compose -f deploy/gcp/compose.infrastructure.yml up -d

  # Wait for services to be healthy
  log "Waiting for services to be healthy..."
  local retries=30
  local count=0
  while [[ $count -lt $retries ]]; do
    if docker compose -f deploy/gcp/compose.infrastructure.yml ps | grep -q "healthy"; then
      log "✓ Infrastructure containers healthy"
      break
    fi
    sleep 10
    ((count++))
  done

  if [[ $count -ge $retries ]]; then
    log "WARNING: Some containers may not be healthy yet"
  fi
}

setup_caddy() {
  log "Configuring Caddy reverse proxy..."

  local caddy_source="$DEPLOY_DIR/deploy/gcp/runtime/Caddyfile"
  local caddy_target="/etc/caddy/Caddyfile"

  if [[ -f "$caddy_source" ]]; then
    cp "$caddy_source" "$caddy_target"
    systemctl reload caddy
    log "✓ Caddy configured"
  else
    log "WARNING: Caddyfile not generated yet. Run with BASE_DOMAIN set."
  fi
}

install_dependencies() {
  log "Installing application dependencies..."

  cd "$DEPLOY_DIR"
  sudo -u deploy pnpm install --frozen-lockfile

  log "✓ Dependencies installed"
}

setup_database() {
  log "Setting up database..."

  cd "$DEPLOY_DIR"

  # Generate Prisma client
  sudo -u deploy pnpm prisma:generate

  # Run migrations
  log "Running database migrations..."
  sudo -u deploy pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma

  log "✓ Database ready"
}

build_applications() {
  log "Building applications..."

  cd "$DEPLOY_DIR"
  sudo -u deploy pnpm build

  log "✓ Applications built"
}

start_applications() {
  log "Starting applications with PM2..."

  cd "$DEPLOY_DIR"

  # Install PM2 globally
  if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
  fi

  # Setup PM2 to start on boot
  sudo -u deploy pm2 startup systemd -u deploy --hp /home/deploy || true

  # Start applications
  sudo -u deploy pm2 start deploy/gcp/ecosystem.config.cjs
  sudo -u deploy pm2 save

  log "✓ Applications started"
}

verify_health() {
  log "Verifying application health..."

  local retries=12
  local count=0
  local healthy=false

  while [[ $count -lt $retries ]]; do
    if curl --fail --silent --show-error http://localhost:4000/api/health/ready &>/dev/null; then
      healthy=true
      break
    fi
    sleep 5
    ((count++))
  done

  if [[ "$healthy" == "true" ]]; then
    log "✓ API health check passed"
  else
    log "WARNING: API health check failed"
    log "Check logs: sudo -u deploy pm2 logs nihongo-api"
  fi
}

print_summary() {
  echo ""
  echo "============================================================"
  echo "BJT Production Bootstrap Complete"
  echo "============================================================"
  echo ""
  echo "Deployment Directory: $DEPLOY_DIR"
  echo "Base Domain:          $BASE_DOMAIN"
  echo ""
  echo "Services:"
  echo "  - API:    http://localhost:4000"
  echo "  - Web:    http://localhost:3000"
  echo "  - Admin:  http://localhost:3001"
  echo "  - Auth:   http://localhost:8080"
  echo "  - Media:  http://localhost:9000"
  echo ""
  echo "Useful Commands:"
  echo "  View logs:        sudo -u deploy pm2 logs"
  echo "  Restart apps:     sudo -u deploy pm2 restart all"
  echo "  Stop apps:        sudo -u deploy pm2 stop all"
  echo "  View containers:  docker compose -f deploy/gcp/compose.infrastructure.yml ps"
  echo ""
  echo "Next Steps:"
  echo "  1. Configure DNS records pointing to your static IP"
  echo "  2. Update BASE_DOMAIN and re-run if needed"
  echo "  3. Setup Google OAuth and Keycloak IdP"
  echo ""
  echo "============================================================"
}

main() {
  log "Starting BJT production bootstrap..."

  check_root
  check_dependencies
  setup_deploy_user
  clone_repository
  setup_infrastructure
  setup_caddy
  install_dependencies
  setup_database
  build_applications
  start_applications

  sleep 10
  verify_health

  print_summary
}

main "$@"