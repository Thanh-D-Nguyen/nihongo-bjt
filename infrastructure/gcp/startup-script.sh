#!/bin/bash
# BJT Production VM Bootstrap Script
# Paste this into the "Startup script" field when creating VM in Console
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