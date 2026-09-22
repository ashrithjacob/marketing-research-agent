#!/usr/bin/env bash
# SessionStart. Answers, before they are asked, the three questions that open
# most sessions here: is it running, is it deployed, and what is half-done.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

local_health=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:8080/api/health 2>/dev/null)
[ -n "$local_health" ] || local_health=000
live_health=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 https://marketing.vanis.ai/api/health 2>/dev/null)
[ -n "$live_health" ] || live_health=000

dirty=$(git -C "$REPO" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
fe_src=$(git -C "$REPO" status --porcelain -- frontend/src 2>/dev/null | wc -l | tr -d ' ')
fe_dist=$(git -C "$REPO" status --porcelain -- frontend/dist 2>/dev/null | wc -l | tr -d ' ')
head_line=$(git -C "$REPO" log -1 --format='%h %s' 2>/dev/null)

stale="no"
[ "$fe_src" -gt 0 ] && [ "$fe_dist" -eq 0 ] && stale="YES — frontend/src changed, frontend/dist did not"

printf 'State of the research cockpit right now (measured, not remembered):\n'
printf -- '- local stack (http://localhost:8080/api/health): %s%s\n' "$local_health" \
  "$( [ "$local_health" = 200 ] && echo ' — up' || echo ' — not running; `mra up` starts it' )"
printf -- '- live (https://marketing.vanis.ai/api/health): %s\n' "$live_health"
printf -- '- uncommitted files: %s   (HEAD: %s)\n' "$dirty" "$head_line"
printf -- '- dist stale: %s\n' "$stale"
printf -- '- the gate is `mra check` (%s). Live being healthy does not mean your change is on it — only `deploy/vps/deploy.sh` does that.\n' \
  ".claude/skills/mra-control/bin/mra"
