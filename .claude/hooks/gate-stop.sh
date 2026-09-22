#!/usr/bin/env bash
# Stop hook. If code changed in this session, the gate has to pass before the
# turn can end.
#
# This is the piece that replaces "did you run the tests?" being asked out
# loud. It only runs when something it can judge actually changed, and it gives
# up after two blocks so a genuinely stuck failure cannot trap the session.
set -uo pipefail
input=$(cat)
session=$(printf '%s' "$input" | jq -r '.session_id // "nosession"')
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
counter="${TMPDIR:-/tmp}/mra-stopgate-$session"

changed=$(git -C "$REPO" status --porcelain -- server/src server/tests frontend/src docker-compose.yaml deploy 2>/dev/null | head -1)
[ -n "$changed" ] || exit 0

if output=$("$REPO/.claude/skills/mra-control/bin/mra" check --changed 2>&1); then
  rm -f "$counter"
  exit 0
fi

blocks=$(cat "$counter" 2>/dev/null || echo 0)
blocks=$((blocks + 1))
printf '%s' "$blocks" > "$counter"

if [ "$blocks" -gt 2 ]; then
  jq -nc --arg m "mra check is still failing after $((blocks - 1)) attempts. Not blocking again — say plainly what is still broken rather than leaving it unsaid." \
    '{systemMessage:$m}'
  exit 0
fi

jq -nc --arg r "\`mra check\` fails, and code changed in this session. Fix it before finishing — or, if it cannot be fixed now, say so explicitly and say what is broken.

$output" '{decision:"block", reason:$r}'
