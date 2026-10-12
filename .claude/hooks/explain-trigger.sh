#!/usr/bin/env bash
# UserPromptSubmit. A prompt that starts with "explain to me" is routed to the
# explain skill, so the trigger does not depend on the model noticing it.
set -uo pipefail
prompt=$(jq -r '.prompt // empty')
shopt -s nocasematch
if [[ "$prompt" =~ ^[[:space:]]*explain[[:space:]]+(it[[:space:]]+)?to[[:space:]]+me ]]; then
  jq -nc '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:"The user asked to have something explained. Invoke the explain skill (Skill tool, skill: \"explain\") with the rest of their prompt as args, and follow it. If they named no topic, the subject is the latest change."}}'
fi
exit 0
