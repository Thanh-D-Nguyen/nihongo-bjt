#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
set -a
. deploy/gcp/runtime/infrastructure.env
set +a

container="gcp-keycloak-1"
kcadm="/opt/keycloak/bin/kcadm.sh"
realm="nihongo-bjt"
command="${1:-}"
username="${2:-}"

usage() {
  cat <<'EOF'
Usage:
  ./deploy/gcp/manage-keycloak-user.sh list
  ./deploy/gcp/manage-keycloak-user.sh create USERNAME EMAIL [ROLE]
  ./deploy/gcp/manage-keycloak-user.sh reset-password USERNAME
  ./deploy/gcp/manage-keycloak-user.sh disable USERNAME
  ./deploy/gcp/manage-keycloak-user.sh delete USERNAME

Set NEW_PASSWORD in the environment or enter it interactively for create and
reset-password. Do not put passwords on the command line.
EOF
}

login() {
  sudo docker exec "$container" "$kcadm" config credentials \
    --server http://127.0.0.1:8080 \
    --realm master \
    --user "$KEYCLOAK_ADMIN_USERNAME" \
    --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null
}

user_id() {
  sudo docker exec "$container" "$kcadm" get users \
    -r "$realm" \
    -q "username=$1" \
    --fields id \
    --format csv \
    --noquotes
}

password() {
  if [[ -n "${NEW_PASSWORD:-}" ]]; then
    printf '%s' "$NEW_PASSWORD"
    return
  fi
  read -r -s -p "New password: " value
  printf '\n' >&2
  printf '%s' "$value"
}

login

case "$command" in
  list)
    sudo docker exec "$container" "$kcadm" get users \
      -r "$realm" \
      --fields username,email,enabled \
      --format csv
    ;;
  create)
    email="${3:?email is required}"
    role="${4:-user}"
    value="$(password)"
    sudo docker exec "$container" "$kcadm" create users \
      -r "$realm" \
      -s "username=$username" \
      -s "email=$email" \
      -s emailVerified=true \
      -s enabled=true \
      -s "firstName=$username" \
      -s "lastName=operator" >/dev/null
    sudo docker exec "$container" "$kcadm" set-password \
      -r "$realm" \
      --username "$username" \
      --new-password "$value" >/dev/null
    sudo docker exec "$container" "$kcadm" add-roles \
      -r "$realm" \
      --uusername "$username" \
      --rolename "$role" >/dev/null
    printf 'Created %s with realm role %s\n' "$username" "$role"
    ;;
  reset-password)
    value="$(password)"
    sudo docker exec "$container" "$kcadm" set-password \
      -r "$realm" \
      --username "$username" \
      --new-password "$value" >/dev/null
    printf 'Reset password for %s\n' "$username"
    ;;
  disable)
    id="$(user_id "$username")"
    [[ -n "$id" ]] || { printf 'User not found: %s\n' "$username" >&2; exit 1; }
    sudo docker exec "$container" "$kcadm" update "users/$id" \
      -r "$realm" \
      -s enabled=false >/dev/null
    printf 'Disabled %s\n' "$username"
    ;;
  delete)
    id="$(user_id "$username")"
    [[ -n "$id" ]] || { printf 'User not found: %s\n' "$username" >&2; exit 1; }
    sudo docker exec "$container" "$kcadm" delete "users/$id" -r "$realm" >/dev/null
    printf 'Deleted %s\n' "$username"
    ;;
  *)
    usage
    exit 1
    ;;
esac
