#!/usr/bin/env bash
# PreToolUse on Write|Edit. Refuses the edits that are always a mistake here,
# so they cost a sentence instead of a review.
#
# A rule only belongs here when the *correct* action is something else
# entirely — not when the edit is merely unusual.
set -uo pipefail
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0

deny() {
  jq -nc --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

case "$file" in
  */frontend/dist/*)
    deny "frontend/dist is build output, not source. Editing it by hand puts the
tracked bundle out of step with frontend/src, and the next build silently
reverts you. Change frontend/src and run: cd frontend && npm run build" ;;
  */server/dist/*)
    deny "server/dist is build output and is gitignored. Change server/src." ;;
  */node_modules/*)
    deny "node_modules is not ours to edit. If a dependency is wrong, pin or
patch it in package.json." ;;
  */.env)
    deny "This repo keeps secrets out of tracked files, and .env is the file
that holds them — OPENROUTER_API_KEY, FIRECRAWL_API_KEY, APIFY_TOKEN,
MRA_JWT_SECRET. Edit it yourself, or change .env.example (placeholders only)
and say which value needs setting." ;;
esac
exit 0
