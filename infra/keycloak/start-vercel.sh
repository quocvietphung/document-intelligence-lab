#!/bin/sh
set -eu

: "${FRONTEND_URL:?FRONTEND_URL is required}"
: "${KC_HOSTNAME:?KC_HOSTNAME is required}"
: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${KC_BOOTSTRAP_ADMIN_USERNAME:?KC_BOOTSTRAP_ADMIN_USERNAME is required}"
: "${KC_BOOTSTRAP_ADMIN_PASSWORD:?KC_BOOTSTRAP_ADMIN_PASSWORD is required}"

sed "s|__FRONTEND_URL__|${FRONTEND_URL}|g" \
  /opt/keycloak/data/import/credit-intelligence-production-realm.json.template \
  > /opt/keycloak/data/import/credit-intelligence-production-realm.json

export KC_DB_URL="jdbc:postgresql://${PGHOST}/${PGDATABASE}?sslmode=require"
export KC_DB_USERNAME="${PGUSER}"
export KC_DB_PASSWORD="${PGPASSWORD}"

exec /opt/keycloak/bin/kc.sh start \
  --optimized \
  --http-port="${PORT:-8080}" \
  --hostname="${KC_HOSTNAME}" \
  --import-realm
