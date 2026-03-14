#!/usr/bin/env bash
set -euo pipefail

# ─── Manual deploy script ───
# Usage: ./scripts/deploy.sh [dev|test|prd]
# Default: dev

ENV="${1:-dev}"
COMPOSE_BASE="docker-compose.yml"

echo "=== Deploying legal-th-server ($ENV) ==="

# ─── Pull latest code ───
echo "→ git pull..."
git pull origin "$(git branch --show-current)"

# ─── Decrypt secrets (ถ้ามี .env.enc) ───
if [ -f .env.enc ]; then
  echo "→ Decrypting .env.enc..."
  sops --decrypt .env.enc > .env
else
  echo "→ No .env.enc found, using existing .env"
fi

# ─── Select compose override ───
case "$ENV" in
  dev)
    COMPOSE_CMD="docker compose -f $COMPOSE_BASE -f docker-compose.dev.yml"
    ;;
  test)
    COMPOSE_CMD="docker compose -f $COMPOSE_BASE -f docker-compose.prd.yml"
    ;;
  prd)
    COMPOSE_CMD="docker compose -f $COMPOSE_BASE -f docker-compose.prd.yml"
    ;;
  *)
    echo "Unknown environment: $ENV"
    echo "Usage: $0 [dev|test|prd]"
    exit 1
    ;;
esac

# ─── Build & Start ───
echo "→ Starting services ($ENV)..."
$COMPOSE_CMD up -d --build

# ─── Health check ───
echo "→ Waiting for health check..."
sleep 5
if curl -sf http://localhost:3000/health > /dev/null; then
  echo "✓ Health check passed"
else
  echo "✗ Health check failed!"
  $COMPOSE_CMD logs --tail=50 app
  exit 1
fi

echo "=== Deploy complete ($ENV) ==="
