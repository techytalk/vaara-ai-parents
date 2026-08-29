#!/usr/bin/env bash
# Deploy a backend service to Fly.io.
#   ./scripts/deploy-fly.sh realtime
#   ./scripts/deploy-fly.sh worker
# Prerequisite: flyctl auth login
set -euo pipefail

SERVICE="${1:-}"
case "$SERVICE" in
  realtime) APP_NAME="vaara-realtime" ;;
  worker)   APP_NAME="vaara-worker" ;;
  *)
    echo "Usage: $0 <realtime|worker>"
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.fly/bin:${PATH}"

if ! command -v flyctl >/dev/null 2>&1; then
  echo "flyctl not found. Install: curl -L https://fly.io/install.sh | sh"
  exit 1
fi

if ! flyctl auth whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: flyctl auth login"
  exit 1
fi

ENV_FILE="${ROOT}/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.local"
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  value="${value%"${value##*[![:space:]]}"}"
  export "$key"="$value"
done < "$ENV_FILE"

for var in DATABASE_URL REDIS_URL JWT_SECRET; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing $var in .env.local"
    exit 1
  fi
done

CONFIG="apps/${SERVICE}/fly.toml"

if ! flyctl status --app "$APP_NAME" >/dev/null 2>&1; then
  echo "→ Creating Fly app ${APP_NAME}…"
  flyctl apps create "$APP_NAME" --org personal
else
  echo "→ Using existing Fly app ${APP_NAME}"
fi

# --stage avoids a rolling restart here; the deploy below applies them
# together with any [env] changes from fly.toml.
echo "→ Staging secrets on ${APP_NAME}…"
flyctl secrets set \
  "DATABASE_URL=${DATABASE_URL}" \
  "REDIS_URL=${REDIS_URL}" \
  "JWT_SECRET=${JWT_SECRET}" \
  --stage \
  --app "$APP_NAME"

echo "→ Deploying (build context = repo root)…"
flyctl deploy . --config "$CONFIG" --app "$APP_NAME" --ha=false

echo ""
echo "Done. Health: https://${APP_NAME}.fly.dev/health"
if [[ "$SERVICE" == "realtime" ]]; then
  echo "WebSocket: wss://${APP_NAME}.fly.dev/ws"
fi
