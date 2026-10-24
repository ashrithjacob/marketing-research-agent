#!/usr/bin/env bash
# Deploy the research cockpit to marketing.vanis.ai. Run FROM THE LAPTOP:
#
#     bash deploy/vps/deploy.sh
#
# Builds here and ships the image, rather than building on the VPS. The box
# has ~2.4 GiB free and no swap; `npm ci` plus a native better-sqlite3 compile
# plus a vite build is enough to wake the OOM killer, and the process it picks
# may well be agentchat. Laptop and VPS are both x86_64, so the image runs as-is.
#
# A restart ends any run in progress. Deploy between runs, not during one.
set -euo pipefail

cd "$(dirname "$0")/../.."
REMOTE="${REMOTE:-owui}"
REMOTE_DIR="mra-compose"

echo "==> tests"
(cd server && npm test --silent)

echo "==> build"
docker build -t mra:latest .

# Preflight the image, not just the code. /data must be writable by the
# runtime user on a *fresh* volume: a mount once shipped root-owned, which
# fails silently. Traces are written there.
echo "==> preflight: a fresh volume is writable by the runtime user"
PROBE="mra_preflight_$$"
trap 'docker volume rm -f "${PROBE}_data" >/dev/null 2>&1 || true' EXIT
docker run --rm -v "${PROBE}_data:/data" --entrypoint sh mra:latest \
  -c 'touch /data/.w' \
  || { echo "!! /data is not writable by the image's user — refusing to deploy" >&2; exit 1; }

echo "==> ship image (docker save | ssh docker load)"
docker save mra:latest | gzip -1 | ssh "$REMOTE" 'gunzip | docker load'

echo "==> sync compose files"
rsync -az deploy/vps/docker-compose.yaml deploy/vps/mra-users.sh deploy/vps/mra-snapshot.sh \
  "$REMOTE:$REMOTE_DIR/"
ssh "$REMOTE" "rm -f ~/$REMOTE_DIR/change-password.sh"
ssh "$REMOTE" "rm -rf ~/$REMOTE_DIR/searxng"

echo "==> up"
ssh "$REMOTE" "cd ~/$REMOTE_DIR && docker compose up -d --remove-orphans && \
  for _ in \$(seq 1 30); do \
    [ \"\$(docker inspect -f '{{.State.Health.Status}}' mra 2>/dev/null)\" = healthy ] && break; sleep 2; \
  done; docker compose ps"

echo "==> done"
