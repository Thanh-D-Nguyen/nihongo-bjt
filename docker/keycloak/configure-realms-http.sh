#!/usr/bin/env bash
# Dev-only: allow plain HTTP for Admin Console and app realms (fixes "HTTPS required"
# when using http:// without TLS — especially realm "master", which directory import does not touch).
set -euo pipefail

KEYCLOAK_SERVER="${KEYCLOAK_SERVER:-http://keycloak:8080}"
KC_ADMIN="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
KC_ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}"

for i in $(seq 1 40); do
  if /opt/keycloak/bin/kcadm.sh config credentials \
    --server "$KEYCLOAK_SERVER" --realm master \
    --user "$KC_ADMIN" --password "$KC_ADMIN_PASSWORD" 2>/dev/null; then
    break
  fi
  echo "configure-realms-http: waiting for Keycloak admin API (${i}/40)..."
  sleep 3
done

/opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE
if /opt/keycloak/bin/kcadm.sh get realms/nihongo-bjt &>/dev/null; then
  /opt/keycloak/bin/kcadm.sh update realms/nihongo-bjt -s sslRequired=NONE

  # OAuth 2.1 / FAPI-style client policies can attach executor "reject-ropc-grant" and block password grant
  # even when the client toggle "Direct access grants" is on. Dev realms: clear custom policies.
  tmp_cp="$(mktemp)"
  printf '%s' '{"policies":[]}' >"$tmp_cp"
  if /opt/keycloak/bin/kcadm.sh update client-policies/policies -r nihongo-bjt -f "$tmp_cp"; then
    echo "configure-realms-http: client-policies reset to [] (allows ROPC in dev)"
  else
    echo "configure-realms-http: warn: client-policies/policies update failed (Keycloak may use a different Admin API path)"
  fi
  rm -f "$tmp_cp"

  # Resource Owner Password grant (Next /api/auth/keycloak/password-login) needs Direct Access Grants
  # enabled on the OIDC client. Use CSV to read internal UUID (robust vs JSON field order / pretty-print).
  # kcadm --format csv --noquotes can omit a header row when only one field is requested; do not use `sed 1d`.
  json_id_field() {
    sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1 | tr -d '\r\n'
  }

  ensure_direct_access_grants() {
    local publicId="$1"
    local internalId
    internalId="$(
      /opt/keycloak/bin/kcadm.sh get clients -r nihongo-bjt -q "clientId=${publicId}" \
        --fields id 2>/dev/null | json_id_field
    )"
    if [[ -z "$internalId" ]]; then
      echo "configure-realms-http: warn: could not resolve client uuid for ${publicId} (skip DAG)"
      return 0
    fi
    echo "configure-realms-http: directAccessGrantsEnabled=true for ${publicId} (id=${internalId})"
    if ! /opt/keycloak/bin/kcadm.sh update "clients/${internalId}" -r nihongo-bjt -s directAccessGrantsEnabled=true; then
      echo "configure-realms-http: warn: kcadm update DAG failed for ${publicId}"
    fi
  }
  ensure_direct_access_grants nihongo-web
  ensure_direct_access_grants nihongo-admin

  # Realm import runs only once; a persisted DB may have a different testuser password than realm-export.json.
  reset_dev_password() {
    local uname="$1"
    local newpw="$2"
    local uid
    uid="$(
      /opt/keycloak/bin/kcadm.sh get users -r nihongo-bjt -q "username=${uname}" \
        --fields id 2>/dev/null | json_id_field
    )"
    if [[ -z "$uid" ]]; then
      echo "configure-realms-http: warn: no user ${uname} (skip password reset)"
      return 0
    fi
    if /opt/keycloak/bin/kcadm.sh set-password -r nihongo-bjt --userid "$uid" --new-password "$newpw" 2>/dev/null; then
      echo "configure-realms-http: password reset for ${uname} (dev seed)"
    else
      echo "configure-realms-http: warn: set-password failed for ${uname}"
    fi
  }
  reset_dev_password testuser 123456
  reset_dev_password localadmin admin
fi
echo "configure-realms-http: sslRequired=NONE applied (master + nihongo-bjt if present)."
