# marketing-research-agent

The research cockpit: a stage-1 market-research agent and the UI you watch it
from. The parent `../CLAUDE.md` rules (verify, don't assert; keep `setup.md`
true; no secrets in tracked files) apply here too. That file's deployment and
deploy steps are about **agentchat**, a different app. Use the ones below.

## Where it runs

- **https://marketing.vanis.ai**, not chat.vanis.ai. It shares the Hetzner VPS
  (`ssh owui`) and Caddy with agentchat and nothing else.
- Container `mra` (app and agent in one process) plus `mra-searxng`, compose
  stack `~/mra-compose`, on its own `edge` network.
- The agent runs in-process through `pi-agent-core`. No hermes.
- Ops: `../setup.md` §5a. How a run works, end to end: `workings.md`.
  What is on the screen and what it calls: `FEATURE_MAP.md`.
- Older specs (`spec.md`, `cockpit-spec.md`) still describe hermes as the engine.
  That is superseded by `pi-agent-core`. Trust `setup.md`.

## The one command

```bash
.claude/skills/mra-control/bin/mra check
```

Conventions, server typecheck, server tests, frontend build. That is what
"done" means here — not "the tests I ran pass", not "it should work". It takes
about sixteen seconds, and the Stop hook runs it for you, so a turn that leaves
it failing gets sent back.

`mra` is also how the app is driven: `up`, `down`, `logs`, `health`, `run`,
`watch`, `calls`, `deployed`. Use it instead of improvising a curl, so evidence
from two sessions a week apart is comparable. `mra help`, or the `mra-control`
skill.

## Four rules that are not about code

These are the corrections that have had to be given most often here. They are
in this file because no lint rule can catch them.

**1. Explain the mechanism, not the name of the mechanism.** "The packet was
rejected" is not an answer. "The agent wrote a `finding` field, and the stage-1
schema is `.strict()` with no field a conclusion can go in, so the run ends
`invalid`" — with the file and line — is. Spell out every abbreviation the
first time it appears. When a number appears, say where it came from and how it
was measured; numbers here get quoted back.

**2. Fix the design, not the symptom.** The question is not "what is the
smallest change that makes this case pass" but "what shape makes this class of
thing impossible". A workaround with a comment explaining it is the worst
outcome, because it spreads. If a patch really is the right call for now, say
which design change it defers.

**3. Prefer what the libraries already do.** `pi-agent-core` and `pi-ai` cover
more than they look like they do — retries, backoff, pattern plugins. Look for
existing support before writing a bespoke version, and say what you found
either way.

**4. Never report a fix you have not watched work.** "That should be fixed now"
and "it is deployed" are claims, and both have been wrong here. Tests passing
is not the feature working: run it (`mra run`, `mra watch`), read the outcome,
quote it. A healthy `/api/health` on the live site means the container is up —
it does not mean your change is on it. Only `deploy/vps/deploy.sh` does that.

## Architecture

`server/tests/architecture.test.ts` is the rulebook. If a rule below and that
file disagree, the file wins — change it on purpose, never to get a change
through.

The conversion to this shape is done: every server module is governed. The
`LEGACY` list that staged it is empty and stays empty — adding to it weakens
every rule in that file at once.

| Layer | Holds | May import |
|---|---|---|
| `domain` | Types, zod schemas, `interface` ports. No I/O. | nothing (owns `zod`) |
| `config` | `Settings`, the only reader of `process.env` | nothing |
| `extract` | Packet parsing and validation. Pure. | `domain` |
| `adapters` | Apify, Firecrawl, SearXNG, OpenRouter prices, SQLite, corpus | `domain`, `config` |
| `agent` | Prompt building, tools, the run loop | `domain`, `config`, `extract`, `adapters` |
| `http` | Routes, auth, app wiring | everything above |
| `main.ts` | Entry point. Wiring only. | everything |

Package ownership, enforced: `apify-client` and `better-sqlite3` belong to
`adapters`, `hono` to `http`, `pi-agent-core` and `pi-ai` to `agent`.

The class diagram lives in `docs/class-diagram.md`. Regenerate it with
`node server/scripts/class-diagram.mjs` whenever classes or relationships change.

## Code rules

- **Everything is a class.** No module-level functions outside `main.ts` and
  `hashpw.ts`. A helper is a method, or a `static` on the class that needs it.
- **One responsibility per class; modules stay under 150 lines.** If describing a
  class needs "and", split it.
- **Boundaries are interfaces in `domain/ports.ts`; adapters implement them.**
  The run loop depends on `ReviewSource`, never on `ApifyClient`.
- **Dependencies arrive through the constructor** and are held `private readonly`.
  No globals, no singletons, no `process.env` outside `config`.
- **Composition over inheritance.** Inherit only to implement an interface.
- **No comments.** Names carry the meaning; a one-line docstring is the only prose
  allowed. A measured fact goes in a spec, and the code keeps only the value.
- **No workarounds.** A hack, with or without a comment explaining it, spreads.
  Fix the cause or record it as a gap and stop.
- Every behavioural fix gets a regression test next to the thing it fixes.

The frontend is exempt from the class rule — React function components are its
paved path. It keeps: no comments, components under 250 lines, fetching and
shaping in `api.ts`. See the `oop-design` skill.

## Checks before you call something done

```bash
.claude/skills/mra-control/bin/mra check     # all of the below, in one command

cd server && npm test && npm run typecheck
cd frontend && npm run build                 # tsc -b, then vite
node server/scripts/check-conventions.mjs    # the house rules
```

- The frontend has no test runner. Its typecheck only runs as part of the build.
- `frontend/dist` is tracked on purpose, because the deploy ships it. A frontend
  change should commit a rebuilt `dist` — and `check` fails if it does not.

## Deploying

From the laptop, repo root `agent-collection/`:

```bash
bash marketing-research-agent/deploy/vps/deploy.sh
```

This runs the tests, builds the image **locally**, preflights it, then ships it
as a saved image over the same connection.

- Never build on the VPS. It has no swap, and the OOM killer may pick agentchat.
  A hook refuses a build issued remotely.
- A deploy ends any research run in progress. Deploy between runs.

## Things that will bite you

The first five are enforced by `server/scripts/check-conventions.mjs`, each with
a test in `server/tests/conventions.test.ts` proving the rule still bites. When
you find yourself giving the same correction twice, the second one belongs in
that file rather than in this list.

- **Server field names come from pi-ai and are camelCase** (`totalTokens`,
  `cacheRead`), while most of the rest of the API is honestly snake_case out of
  SQLite. `frontend/src/api.ts` mirrors them by hand. One snake_case name there
  left the cockpit stuck on "Tokens —": the field was optional, so `tsc` never
  complained. *Enforced: every field the client declares must exist somewhere in
  `server/src`.*
- **`CREATE TABLE IF NOT EXISTS` does not alter an existing table.** A new
  column needs a migration, and the failure shows up at the first INSERT on the
  VPS, not at startup. *Enforced: a column new since HEAD needs its ALTER TABLE.*
- **`frontend/dist` is what deploys**, not `frontend/src`. *Enforced.*
- **Docker's own iptables rules bypass ufw**, so a published port on the VPS is
  open to the internet whatever the firewall says. *Enforced: `expose:` there,
  loopback-bound only locally.*
- **Every env var this service reads is declared in `settings.ts`.** *Enforced
  both directions: no `process.env` elsewhere, and nothing handed to the
  container that settings.ts does not read.*

Still only written down, because no rule catches them:

- **pi-ai's model prices are a snapshot** frozen into the package. The runner
  overrides them with OpenRouter's live prices (`server/src/agent/pricing.ts`).
  The real charge comes from `/generation`, which 404s for about 4s after a
  turn ends. See `workings.md` §2a.
- **In tests, a text-only faux reply ends the agent loop after one turn.** For a
  multi-turn run, give the earlier turns a `fauxToolCall(...)` with
  `stopReason: "toolUse"`.
- **A server restart kills live runs.** `recover()` marks them failed, and any
  billed-cost lookups still pending are lost.
- **A URL in the brief belongs in `brief.url`, never `brief.product`.** An agent
  handed `https://…` as a product name searches for that literal string and
  comes back confidently wrong. This is the bug behind "why does it always go
  for magnesium".
- **`npm run hashpw` separates its hash with `:`, not `$`.** The value lands in a
  `.env` read by `docker compose`, which interpolates `$...` and would mangle it
  silently.
- **`invalid` is not `failed`.** `failed` is a crash; `invalid` means the agent
  finished and produced something the schema refused, which is the most
  informative failure this app has. Do not collapse them.

## What is set up in this repo

| Layer | Where | Catches |
|---|---|---|
| Hard rules | `server/scripts/check-conventions.mjs` (+ its tests) | the five bugs above, at `mra check` time |
| The gate | `.claude/hooks/gate-stop.sh` | a turn ending with the gate red |
| Guards | `.claude/hooks/guard-edit.sh`, `guard-bash.sh` | hand-editing `dist`, writing `.env`, building on the VPS |
| Orientation | `.claude/hooks/session-brief.sh` | "is it running?", "is it deployed?" asked out loud |
| Control | `.claude/skills/mra-control/` | improvised curl; claims that something works |
| Memory | `FEATURE_MAP.md` | guessing at a screenshot |
| House style | `.claude/skills/client-doc/` | the client-document rewrite loop |
| Shape | `server/tests/architecture.test.ts` | layers, module size, comments, stray functions |
| Design | `.claude/skills/oop-design/` | guessing where a class goes |
| Corrections | `.claude/skills/gardener/` | the same correction being needed twice |
