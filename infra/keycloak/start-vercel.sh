#!/bin/sh
set -eu
printf '%s\n' '[keycloak] validating runtime configuration'

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
  > /opt/keycloak/data/import/credit-intelligence-realm.json

export KC_DB_URL="jdbc:postgresql://${PGHOST_UNPOOLED:-${PGHOST}}/${PGDATABASE}?sslmode=require"
export KC_DB_USERNAME="${PGUSER}"
export KC_DB_PASSWORD="${PGPASSWORD}"
export KC_DB_POOL_INITIAL_SIZE=1 KC_DB_POOL_MIN_SIZE=1 KC_DB_POOL_MAX_SIZE=5
# Vercel instances have no shared memory or private cluster network. Keycloak
# stateless mode persists one-use OAuth codes and authentication sessions in SQL.
# Each independent instance is a separate cache cluster for DB invalidation.
export KC_CACHE_EMBEDDED_CLUSTER_NAME="credit-vercel-$(cat /proc/sys/kernel/random/uuid)"
printf '%s\n' '[keycloak] starting with persistent PostgreSQL (no credentials logged)'

exec /opt/keycloak/bin/startup-proxy /opt/keycloak/bin/kc.sh start \
  --optimized \
  --http-port=8081 \
  --hostname="${KC_HOSTNAME}" \
  --spi-user-sessions--infinispan--use-caches=false \
  --import-realm
