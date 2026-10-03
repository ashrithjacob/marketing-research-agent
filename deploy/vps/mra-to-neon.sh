#!/usr/bin/env bash
# One-time move of the research cockpit's store from research.db to Postgres on
# Neon. Run FROM THE LAPTOP, after deploy.sh has shipped an image that has the
# Postgres store (2026-10-03 or later):
#
#     bash deploy/vps/mra-to-neon.sh
#
# Refuses while a run is live. Stops mra (downtime starts), takes a consistent
# copy of research.db, copies it into the EMPTY database named by DATABASE_URL in
# the laptop's .env, proves every table digest for digest, then writes
# DATABASE_URL into ~/mra-compose/.env and starts mra on Neon. Any failure before
# that last step starts mra again on research.db, untouched.
#
# The way back: delete the DATABASE_URL line from ~/mra-compose/.env and
# `docker compose up -d`. research.db is as it was at the move, so anything
# written to Neon since is not in it.
set -euo pipefail

if [ "${1:-}" != remote ]; then
  cd "$(dirname "$0")/../.."
  REMOTE="${REMOTE:-owui}"
  URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | sed 's/sslmode=require/sslmode=verify-full/')"
  [ -n "$URL" ] || { echo "!! no DATABASE_URL in .env" >&2; exit 1; }
  case "$URL" in *'$'*) echo "!! DATABASE_URL holds a \$, which docker compose would mangle" >&2; exit 1 ;; esac
  rsync -az deploy/vps/mra-to-neon.sh "$REMOTE:mra-compose/"
  printf '%s\n' "$URL" | ssh "$REMOTE" 'bash ~/mra-compose/mra-to-neon.sh remote'
  exit
fi

read -r DATABASE_URL
export DATABASE_URL
cd ~/mra-compose
grep -q '^DATABASE_URL=.' .env && { echo "!! .env already sets DATABASE_URL: the store has moved already" >&2; exit 1; }

echo "==> refuse while a run is live"
LIVE=$(docker exec -w /app mra node -e '
  const D = require("better-sqlite3");
  const db = new D("/data/research.db", { readonly: true });
  console.log(db.prepare("SELECT COUNT(*) AS n FROM research_runs WHERE status IN (?, ?)").get("queued", "running").n);')
[ "$LIVE" = 0 ] || { echo "!! ${LIVE} run(s) live; move between runs" >&2; exit 1; }

echo "==> stop mra; downtime starts"
docker compose stop mra
restart_on_sqlite() { echo "!! the move failed; mra starts again on research.db" >&2; docker compose start mra; }
trap restart_on_sqlite ERR

echo "==> consistent copy of research.db"
docker run --rm -v mra_mra_data:/data --entrypoint node -w /app mra:latest -e '
  const D = require("better-sqlite3");
  require("fs").rmSync("/data/neon-copy.db", { force: true });
  const db = new D("/data/research.db");
  db.prepare("VACUUM INTO ?").run("/data/neon-copy.db");
  db.close();'

echo "==> copy into Neon and prove every table"
docker run --rm -v mra_mra_data:/data -e DATABASE_URL -e MRA_MODEL=copy-store --entrypoint node -w /app mra:latest \
  dist/copy-store.js /data/neon-copy.db

trap - ERR
echo "==> switch: DATABASE_URL into .env, start mra on Neon"
printf 'DATABASE_URL=%s\n' "$DATABASE_URL" >> .env
docker compose up -d mra
for _ in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' mra 2>/dev/null)" = healthy ] && break; sleep 2
done
docker compose ps
docker run --rm -v mra_mra_data:/data --entrypoint rm mra:latest -f /data/neon-copy.db
docker logs --since 2m mra 2>&1 | tail -5
