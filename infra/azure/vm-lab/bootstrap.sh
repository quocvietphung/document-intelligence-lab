#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/credit-lab
backend_host="${1:?Backend hostname required}"
frontend_url="${2:?Frontend HTTPS URL required}"
if [[ ! "$backend_host" =~ ^[a-z0-9-]+\.[a-z0-9-]+\.cloudapp\.azure\.com$ ]] || [[ ! "$frontend_url" =~ ^https://[a-z0-9.-]+$ ]]; then
  echo "Invalid deployment origin" >&2; exit 1
fi
install -d -m 700 secrets
if [[ ! -f secrets/runtime.env ]]; then
  BACKEND_HOST="$backend_host" FRONTEND_URL="$frontend_url" python3 - <<'PY'
import os, secrets, json
from pathlib import Path
values = {key: secrets.token_hex(32) for key in ('CASE_PASSWORD','IDENTITY_PASSWORD','ADMIN_PASSWORD','ADVISOR_PASSWORD')}
values.update(BACKEND_HOST=os.environ['BACKEND_HOST'], FRONTEND_URL=os.environ['FRONTEND_URL'])
env = Path('secrets/runtime.env')
env.write_text(''.join(f'{k}={v}\n' for k,v in values.items()))
env.chmod(0o600)
realm = json.loads(Path('realm-template.json').read_text().replace('__FRONTEND_URL__', values['FRONTEND_URL']))
realm['users'][0]['credentials'][0]['value'] = values['ADVISOR_PASSWORD']
output = Path('secrets/realm.json')
output.write_text(json.dumps(realm))
output.chmod(0o640)
os.chown(output, 1000, 0)
PY
else
  # Existing identities/volumes are retained. Never rotate passwords implicitly.
  if ! grep -Fxq "BACKEND_HOST=$backend_host" secrets/runtime.env || ! grep -Fxq "FRONTEND_URL=$frontend_url" secrets/runtime.env; then
    echo "Origin changed: update the realm and private config explicitly before deploying." >&2; exit 1
  fi
fi
docker compose --env-file secrets/runtime.env -f compose.yml config --quiet
docker compose --progress quiet --env-file secrets/runtime.env -f compose.yml build
docker compose --progress quiet --env-file secrets/runtime.env -f compose.yml up -d --wait --wait-timeout 1200
docker compose --env-file secrets/runtime.env -f compose.yml ps
