#!/usr/bin/env bash
# PreToolUse on Bash. One rule, and it is the expensive one: never build on
# the VPS.
set -uo pipefail
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -n "$cmd" ] || exit 0

deny() {
  jq -nc --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# Heredoc bodies are data, not commands. A file being written with `cat <<EOF`
# may perfectly well contain the words this rule looks for — the documentation
# about this very rule does, which is how the first version of this hook
# blocked the commit that wrote it. Strip the bodies before matching anything.
scrubbed=$(printf '%s' "$cmd" | awk '
  BEGIN { skip = 0; term = "" }
  skip == 1 {
    stripped = $0
    sub(/\r$/, "", stripped)
    gsub(/^[ \t]+|[ \t]+$/, "", stripped)
    if (stripped == term) { skip = 0 }
    next
  }
  {
    line = $0
    if (match(line, /<<-?[ \t]*'"'"'?[A-Za-z_][A-Za-z0-9_]*'"'"'?/)) {
      term = substr(line, RSTART, RLENGTH)
      sub(/^<<-?[ \t]*/, "", term)
      gsub(/'"'"'/, "", term)
      gsub(/"/, "", term)
      skip = 1
    }
    print line
  }')

# Only remote invocations are caught. Building locally is the normal path and
# the one the deploy script itself uses.
remote_re='(^|[;&|[:space:]])ssh[[:space:]]'
build_re='docker[[:space:]]+(compose[[:space:]]+)?build|compose[[:space:]]+up[^\n]*--build|npm[[:space:]]+(ci|install|run[[:space:]]+build)'

if printf '%s' "$scrubbed" | grep -Eq "$remote_re"; then
  if printf '%s' "$scrubbed" | grep -Eq "$build_re"; then
    deny "Never build on the VPS. It has ~2.4 GiB free and no swap; installing
dependencies plus a native better-sqlite3 compile plus a vite build is enough
to wake the OOM killer, and the process it picks may be agentchat — a different
app, whose users would go down with it.

Build here and ship the image instead:
  bash deploy/vps/deploy.sh

That runs the tests, builds locally, preflights the image and ships it as a
saved image over the same connection."
  fi
fi
exit 0
