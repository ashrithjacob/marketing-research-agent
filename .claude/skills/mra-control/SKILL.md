---
name: mra-control
description: Run, inspect and verify the marketing-research-agent cockpit through the `mra` CLI instead of improvised curl and docker commands. Use when starting or stopping the stack, starting or watching a research run, reading the LLM call log, checking whether something is deployed, diagnosing a screenshot or a bug report about the UI, or confirming a change works before calling it done.
---

# Controlling the cockpit

There is one way to drive this app, and it is `mra`. It lives at
`.claude/skills/mra-control/bin/mra`. Use it rather than writing a fresh curl
each time: the point is that two sessions a week apart produce comparable
evidence, and that the flags which matter here (a URL belongs in `product_url`,
never `product_name`; `invalid` is not `failed`) are already encoded rather than
re-remembered.

```
mra check [--changed]     the gate: conventions, typecheck, tests, frontend build
mra up | down | logs [n]  the local stack
mra health [local|live]
mra run "<product>"       start an analysis    mra watch [runId]   follow it
mra confirm [runId]       accept what it resolved and start the stages
mra calls [runId]         the LLM call log     mra trace [runId]   its trace file
mra deployed              what is live
```

## The gate

`mra check` is what "done" means here. Run it before saying a change works, and
before a deploy. It is also wired to the Stop hook, so a turn that changed code
and left the gate failing will be sent back — the hook gives up after two
attempts, at which point say plainly what is broken rather than going quiet.

A rule it enforces is not a suggestion. If one of them is wrong, fix the rule in
`server/scripts/check-conventions.mjs` and its test in
`server/tests/conventions.test.ts`; do not route around it.

## Verifying a change actually works

Tests passing is not the same as the thing working, and this app has had both
failure shapes. For anything user-visible:

```bash
mra up
mra run "https://mullevia.com/products/mullevia-mullein-drops"
mra watch          # stops at awaiting_confirmation
mra confirm        # or confirm in the cockpit, editing the competitors
mra watch
```

Then read the outcome rather than asserting it. `mra watch` prints each built
stage's status and summary, the competitors with their relationship, and the
cost. `invalid` means an agent finished and its submit was refused by the
schema or a code check (a source it never read, a url it never met) —
`mra calls` shows which turn, and the refusal names the field.

A run costs real money: OpenRouter per token, Parallel per search, Firecrawl per
page. Ask before starting one, and one run is enough to verify something.

## Diagnosing a bug report

Bug reports here arrive as screenshots. `FEATURE_MAP.md` maps every surface to
the component and the endpoint behind it, and lists what each known failure
looks like on screen — start there rather than guessing from the crop, then
confirm against `mra logs` or the call log.

## What `mra deployed` does and does not tell you

It reports live health, the image running on the VPS, and what is uncommitted
here. A healthy live site means the container is up. It does **not** mean your
change is on it. Only `bash deploy/vps/deploy.sh` does that, it builds locally
on purpose, and it ends any run in progress — so deploy between runs.
