# Moving the cockpit to TanStack Start, Cloudflare, Convex, Better Auth and Autumn

Status: plan, 2026-10-04. Nothing built yet. Supersedes the Neon move
(`setup.md` §5a "The store") once phase 6 lands; until then Neon stays live.

## What has to move (measured 2026-10-04, live)

| Thing | Today | Measured |
|---|---|---|
| Server | Node + Hono, one container `mra` on the VPS | 256 files, 15,451 lines in `server/src`; 43 test files |
| UI | React 18 + Vite SPA, hand-rolled routing (`route.tsx`) | `frontend/src`, shipped as `dist` |
| Store | Postgres on Neon (SQLite fallback), 22 `research_*` tables | 46 MB; largest `research_events` 38,250 rows, `research_reviews` 2,429 |
| Files | corpus on the VPS disk | `/corpus` 21.8 MB |
| Auth | one password (`MRA_APP_PASSWORD_HASH`), JWT cookie | 1 account, 1 workspace |
| Live view | SSE from in-memory `LiveRuns`, Caddy `flush_interval -1` | |
| Run length | in-process agent loop | stage 1: median 776 s, max 2,319 s (39 min, n=11); stage 3: median 85 s, max 1,295 s (n=11) |

The run length decides the design. A 39-minute run cannot live inside one
request, and today it cannot survive a restart either (`recoverRunsKilledByRestart`
ends it `failed`). The move should fix that, not carry it over.

## The shape

```
browser ──► Cloudflare Worker: TanStack Start (SSR, server functions)
               │  Better Auth session (cookie) → Convex auth token
               ▼
            Convex: tables, live queries, mutations
               ├─ Better Auth component      (users, sessions, organizations)
               ├─ Autumn component           (plans, credits, check/track)
               └─ Workflow component         (the run engine)
                     └─ actions: pi-agent-core turns, Apify, Parallel, Firecrawl, OpenRouter
GitHub Actions: check on every PR → convex deploy, then wrangler deploy on main
```

### What Convex is

A hosted backend, a managed cloud service like Neon but covering more:

- **A database.** Tables and indexes, replacing the 22 `research_*` tables.
- **Server functions written in TypeScript and deployed to it.** *Queries* read
  data, and the browser subscribes to them, so the screen updates by itself when
  data changes. *Mutations* write data, each one a transaction. *Actions* call
  the outside world (OpenRouter, Apify, Parallel).
- **Background work.** A scheduler, and the Workflow component that runs the
  agent turn by turn.
- **File storage,** for the corpus.

Nothing of it runs on our machine: `npx convex deploy` pushes the code, and
Convex runs and scales it.

### Where it is hosted, and why not the VPS

`marketing.vanis.ai` → Cloudflare Worker (TanStack Start: pages, SSR, sign-in,
server functions) → Convex cloud (data, live updates, agent runs, files). The
VPS has no part in this app. It keeps serving agentchat (`chat.vanis.ai`),
unchanged; after cutover the `mra` container and Neon are retired.

- **Scale.** Today one container runs every agent loop in a single Node process
  on a box with no swap; more users means more memory, and the OOM killer may
  pick agentchat. On Workers and Convex each request and each turn runs in its
  own instance, so concurrent runs do not compete for one machine. The real
  ceiling becomes the outside services (Apify concurrency, OpenRouter rate
  limits), which bind the same way on any host.
- **Performance.** Pages render on Cloudflare close to the user; live updates
  come over Convex's websocket instead of SSE through Caddy.
- **Restarts and deploys stop killing runs,** because the workflow resumes from
  the last turn.
- **Watch:** a Worker runs near the user, but Convex lives in one region. For
  SSR pages that load data, the Worker → Convex trip is the main latency. Put
  Convex in the region nearest most users, and let live views load from the
  browser after the first render (the route table below does this).

### Decision 1: Convex runs the agent, Cloudflare serves the app

A run becomes a Convex **workflow**: one durable instance per run, one **step per
agent turn**. `pi-agent-core`'s `Agent` takes initial `messages` and has
`continue()` (`agent.d.ts`), so each step loads the transcript, runs one turn,
saves it, and returns. A deploy or crash mid-run resumes from the last turn
instead of killing the run.

Why Convex over Cloudflare Workflows, which also fit (unlimited wall clock per
step, 25,000 steps): the run's state, its events and the UI's live view are all
in Convex, so the engine writes them in the same transaction as the turn. On
Cloudflare every turn would cross to Convex over HTTP with a shared secret, and
"saved the turn but not the event" becomes a possible state.

Consequences:
- **SSE, `LiveRuns`, the Caddy flush gotcha and `recoverRunsKilledByRestart` go away.**
  The UI subscribes to `events` with a Convex query; it updates by itself.
- **The 30-minute action limit binds a turn, not a run.** Measured on live
  2026-10-04: the longest LLM call that finished normally took 318 s (p95 155 s,
  n=423, `research_llm_calls.duration_ms`), the longest tool call 129 s
  (`web_fetch`, n=2,272, from `tool.started`/`tool.completed` events). The only
  calls over that were two runaway generations on 2026-09-29 (66 and 70 min,
  1.4 MB and 3 MB of output, `stop_reason: aborted`). So each LLM call gets an
  explicit timeout well below the action limit: a runaway then fails as the
  app's own error through `RunEnd`, not as a platform kill that the workflow
  retries.
- **A step can be retried, so a step that spends must be idempotent.** Apify
  pulls already land in `research_review_pulls` keyed by (platform, listing, band)
  and charges in `research_charges`; the step checks before it pulls. This is
  the one place a retry could bill twice, and it gets a test that retries a pull
  step and asserts one charge.
- `RunEnd` stays the only path to a final status (the convention keeps biting).
- `ReviewAnalyst.inFlight` and the other in-memory maps become workflow status
  rows, so "already running" is true across instances.

### Decision 2: the domain and the ports survive; the adapters change

`domain/ports.ts` is the seam. `ResearchStore` gets a Convex implementation;
`extract`, the prompts, the zod schemas, `ListingMatch`, `ReviewMiningOffer` and
the rest of the pure code move unchanged. The layer rules in
`architecture.test.ts` keep applying. `convex/` becomes the `http`/`main`
equivalent (wiring only), and `better-sqlite3`, `pg`, `hono` and the store
adapters are deleted at the end, not kept as fallbacks.

### Decision 3: a workspace is a Better Auth organization, and the Autumn customer

Better Auth with the organization plugin, through `@convex-dev/better-auth`.
`workspace_id` everywhere becomes the organization id. Autumn's `identify()`
returns the organization id, so a team shares one balance.

### Decision 4: billing meters what a run actually cost

The app already records the *billed* cost of every run: OpenRouter's
`/generation` plus `research_charges` (`workings.md` §2a). Autumn gets that
number, not an estimate:
- before a run: `check` against the plan's estimate (review mining already
  computes one in `ReviewMiningPlanner`; stages 1 and 2 need one), refuse if
  the balance cannot cover it
- in `RunEnd`: `track` the billed total

What a credit is worth and what the plans are is your call (see questions).

## Routes (TanStack Start)

| Route | SSR mode | Loader / data | Search params (zod-validated) |
|---|---|---|---|
| `/` landing, `/pricing` | full SSR | static; Autumn products | |
| `/login`, `/signup` | full SSR | Better Auth | `redirect` |
| `/_app` (layout, auth guard) | SSR | `beforeLoad` reads the session server-side, redirects | |
| `/_app/products` | SSR | Convex query prefetch | `q` |
| `/_app/products/$productId` | SSR | product + runs | `stage` |
| `/_app/runs/$runId` | SSR of the packet, then live query | packet, events tail | `tab`, `agent` |
| `/_app/runs/$runId/logs` | `ssr: false` | live events only; large, interactive | `turn` |
| `/_app/billing` | SSR | Autumn customer | |

Server functions, all behind the session check, never imported by client code:
`startRun` (Autumn `check` → Convex mutation that starts the workflow),
`reviewMiningPlan`, `analyseReviews`. Secrets (`OPENROUTER_API_KEY`,
`APIFY_TOKEN`, `PARALLEL_API_KEY`, `FIRECRAWL_API_KEY`) live in Convex env only,
because that is where the calls happen; the Worker holds the Better Auth secret
and the Convex URL.

## Phases

Each phase ends deployed to a staging subdomain and proved by a run, per rule 4.
The free test for anything stage-3: a review-mining run with only c2
NUTRAHARMONY ticked reuses five kept pulls and spends no Apify.

0. **Spikes (de-risk before building).**
   - `pi-agent-core` + `pi-ai` inside a Convex action: one turn against
     OpenRouter, transcript saved and `continue()`d in a second action.
   - `Trace`'s `AsyncLocalStorage` inside a Convex action. If unsupported, the
     run id is passed explicitly, and that is a rule change in `CLAUDE.md`.
   - Convex action limits for the runtime we pick (the 30-minute limit from
     2026-07-17 is stated for the Convex runtime; Node runtime is unconfirmed).
     Step-per-turn makes this a soft limit either way.
   - TanStack Start + `@convex-dev/better-auth` SSR on a Worker
     (`noExternal: ['@convex-dev/better-auth']`, `expectAuth: true`).
1. **Skeleton.** New `app/` (TanStack Start, `@cloudflare/vite-plugin`,
   `wrangler`), `convex/`, Better Auth sign-in, one protected route, CI pipeline
   green, deployed to staging.
2. **Data.** Convex schema for the 22 tables (events, findings and reviews get
   indexes by run). `ConvexStore` implements `ResearchStore`; the existing store
   tests run against it with `convex-test`. Importer: Neon → JSONL per table →
   `npx convex import`, then counts compared table by table, the way
   `copy-store` proves the Neon move. Corpus files → Convex file storage.
3. **Run engine.** Workflow per run, step per turn, idempotent spending steps,
   events written in the turn's transaction. Stage 3 first (no LLM in mining,
   shortest), then stage 2, then stage 1 with its four parallel roles.
4. **UI.** Port the views into the routes above. The components move mostly
   intact; `api.ts` fetching becomes Convex queries. The camelCase/snake_case
   field check in `check-conventions.mjs` is retargeted at the Convex schema.
5. **Billing.** Autumn products, `check` before start, `track` in `RunEnd`, a
   billing page, a refused-for-balance path with a test.
6. **Cutover.** Deploy freeze, final import, counts verified, then DNS.
   `vanis.ai` uses Porkbun's nameservers (`*.ns.porkbun.com`, checked
   2026-10-04), and `marketing.vanis.ai` and `chat.vanis.ai` both point at
   159.69.208.172. A Worker can only serve a custom domain from a zone that runs
   on Cloudflare, so:
   1. Add `vanis.ai` to Cloudflare and re-create every existing record there
      first, with `chat.vanis.ai` as **DNS-only** (grey cloud) to the VPS, so
      agentchat and its Caddy TLS are untouched.
   2. Switch the nameservers at Porkbun to Cloudflare's. The domain stays
      registered at Porkbun. Confirm with `dig +short NS vanis.ai` and
      `dig +short chat.vanis.ai`.
   3. Attach `marketing.vanis.ai` to the Worker as a custom domain.

   The VPS container stays up read-only for two weeks; rollback is pointing the
   `marketing.vanis.ai` record back at the VPS. Then delete the container, Neon, and the dead adapters, and
   rewrite `setup.md` §5a and this repo's `CLAUDE.md` "Where it runs" in the same
   change.

## CI/CD (GitHub Actions)

- **Every PR:** install, the `mra check` equivalent (tests incl. `convex-test`,
  typecheck, conventions, build); a Convex preview deployment plus
  `wrangler versions upload` gives a preview URL per PR.
- **main:** `npx convex deploy` first, then `wrangler deploy`. Convex goes first
  so the Worker never calls a function that does not exist yet; schema changes are
  therefore additive in one release and destructive only in the next.
- Secrets in GitHub: `CONVEX_DEPLOY_KEY`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`. The VPS deploy script and its "never build on the VPS"
  hook retire with the VPS.

## Open questions (yours)

1. **Pricing.** Subscription with monthly credits, pure prepaid credits, or both?
   What is one credit worth relative to billed cost (pass-through, or a markup)?
2. **Sign-up.** Open, waitlist, or invite-only?
3. **Teams.** Do you need more than one user per workspace now, or later?
4. **Region.** Neon was Frankfurt; should Convex be in its EU region?

## Sources

- Convex 30-minute actions: https://ship.convex.dev/changelog/item-237-longer-running-actions
- Convex Workflow component: https://app.unpkg.com/@convex-dev/workflow@0.4.4/files/README.md
- Cloudflare Workflows limits: https://developers.cloudflare.com/workflows/reference/limits
- TanStack Start hosting: https://tanstack.com/start/v0/docs/framework/react/guide/hosting
- Autumn + Convex: https://cdn.jsdelivr.net/npm/@useautumn/convex@0.0.23/README.md
