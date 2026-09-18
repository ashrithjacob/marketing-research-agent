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
- Older specs (`spec.md`, `cockpit-spec.md`) still describe hermes as the engine.
  That is superseded by `pi-agent-core`. Trust `setup.md`.

## Checks before you call something done

```bash
cd server && npm test && npm run typecheck
cd frontend && npm run build        # tsc -b, then vite
```

- The frontend has no test runner. Its typecheck only runs as part of the build.
- `frontend/dist` is tracked on purpose, because the deploy ships it. A frontend
  change should commit a rebuilt `dist`.

## Deploying

From the laptop, repo root `agent-collection/`:

```bash
bash marketing-research-agent/deploy/vps/deploy.sh
```

This runs the tests, builds the image **locally**, preflights it, then ships it
with `docker save | ssh docker load`.

- Never build on the VPS. It has no swap, and the OOM killer may pick agentchat.
- A deploy ends any research run in progress. Deploy between runs.

## Things that will bite you

- **Server field names come from pi-ai and are camelCase** (`totalTokens`,
  `cacheRead`). `frontend/src/api.ts` mirrors them by hand. One snake_case name
  there left the cockpit stuck on "Tokens —": the field was optional, so `tsc`
  never complained.
- **pi-ai's model prices are a snapshot** frozen into the package. The runner
  overrides them with OpenRouter's live prices (`server/src/costs.ts`). The real
  charge comes from `/generation`, which 404s for about 4s after a turn ends.
  See `workings.md` §2a.
- **In tests, a text-only faux reply ends the agent loop after one turn.** For a
  multi-turn run, give the earlier turns a `fauxToolCall(...)` with
  `stopReason: "toolUse"`.
- **A server restart kills live runs.** `recover()` marks them failed, and any
  billed-cost lookups still pending are lost.
