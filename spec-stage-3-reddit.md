# Stage 3 — Reddit conversations: the plan

**No code yet.** This document is the agreed design for the third collection
stage. Anything in it that names a price or an actor's fields is marked
**verify** — those claims come from the current `actors.ts` constants and
prior usage, not from a live probe, and stage 3 work starts by measuring them.

## What stage 3 collects

Reddit is where buyers talk to each other without a star rating attached:
"has anyone tried X for Y", "switching from X to Y", "X gave me hives",
"is X worth it over Z". That is the voice-of-customer material stages 1 and 2
cannot reach:

- stage 1 reads what sellers say (product pages, listicles, category data),
- stage 2 reads what customers say *in review form* (Amazon, Trustpilot),
- stage 3 reads what customers say *in conversation* — objections,
  workarounds, side-effects, competitor comparisons, and the words people
  actually use for the problem.

The output of a stage-3 run is a packet of verbatim Reddit excerpts —
posts and comments with permalinks, subreddit, score and date — organised by
theme, with the same source discipline stage 2 has: every quote archived in
the corpus, hashed, and citeable; gaps recorded as gaps.

## The pipeline shape (mirrors stage 2)

Stage 2 is: stage-1 packet → roster of targets → human approves plan + cost →
run. Stage 3 keeps that shape:

```
stage-1 packet (or stage-2 packet) → subject + keywords
        │
        ▼
stage3/plan — reddit_search (SearXNG, free) proposes threads and subreddits
        │    with a cost estimate
        ▼
human approves the thread list and the spend
        │
        ▼
stage-3 run — Apify scrapes the approved threads (posts + comments),
        │    the agent mines them into themes, archives verbatim excerpts,
        │    packet-check, settle
        ▼
ledger — every excerpt keyed by permalink, so a repeat run costs the delta
```

### Step 1 — discovery is free

Finding the conversations must not cost money. `web_search` already exists,
is already offered to every run, and answers
`"<product>" reddit`, `site:reddit.com "<active ingredient>"`,
`reddit <product> vs <competitor>` well enough. The planner step is a search
pass whose results become the **thread roster**: subreddit, title, permalink,
comment count. The human approves it exactly like the stage-2 roster —
this is where junk threads (astroturfed subreddits, off-topic hits) get cut
before a cent is spent.

### Step 2 — Apify scrapes only approved threads

A Reddit scraper actor takes the approved thread URLs and returns the post
body plus the comment tree. This is the only paid step, and it is bounded the
same way stage 2 is:

- one new actor id + unit price in `adapters/apify/actors.ts`, next to
  `AMAZON_REVIEWS_ACTOR` and `TRUSTPILOT_ACTOR` — **verify the actor choice
  and its unit price against the Apify store before implementing**;
- `Spend.capFor(actor, items)` already sizes the `maxTotalChargeUsd` cap, so
  cost control comes for free;
- a new `MRA_APIFY_MAX_REDDIT_ITEMS` setting next to `apifyMaxReviews`, so
  the server — not the agent — bounds each call.

Two actor-input questions must be answered by a probe before writing the
adapter (**verify**): how the actor takes threads (a `startUrls` list is the
common shape), and how comments paginate, because a 5 000-comment thread
needs a per-thread comment cap or the spend stops being predictable.

### Step 3 — dedup rides the ledger from day one

The review ledger from stage 2 already keys excerpts by `(band_key, locator)`
with `INSERT OR IGNORE`. Reddit fits it directly:

- locator = the **permalink** of the post or comment (stable, unique);
- band key = `reddit|<thread id or search topic>` — a repeated run against
  the same thread asks only for the delta, and the newest-first comment
  ordering Reddit already provides plays the same role as `sort: "recent"`
  on Amazon;
- a re-run whose roster is unchanged and fully cached costs **zero** — the
  same guarantee stage 2 just gained.

## Where each piece lives (the layered shape)

| Piece | Layer | New? |
|---|---|---|
| `RedditExcerpt`, `ThreadRef` (subreddit, title, permalink, comments) | `domain/` | new types |
| `STAGES` grows to `[1, 2, 3]`, `STAGE_NODES[3] = ["reddit_conversations"]` | `domain/nodes.ts` | edit |
| stage-3 packet schema (themes with verbatim excerpts + permalinks) | `domain/packet.ts` or a `stage-three.ts` | new |
| `RedditThreads` adapter — maps actor rows to excerpts | `adapters/apify/reddit-threads.ts` | new |
| ledger band keys for Reddit (`ReviewPull.redditKey`) | `agent/tools/review-pull.ts` | edit |
| `RedditThreadsTool` — `reddit_threads(thread_urls, max_items)` | `agent/tools/review-tools.ts` (or a sibling) | new |
| thread roster from search hits | `extract/` | new |
| `StageThreePlanner` — cost estimate from approved threads | `agent/` (mirror of `stage-two-plan.ts`) | new |
| `POST /api/research/stage3/plan` | `http/` (mirror of `stage-two-routes.ts`) | new |
| plan UI + "Stage 3" in the rail | `frontend/` (`StageThreePlan.tsx`, `StageRail.tsx`) | new |
| stage-3 prompt text | `agent/prompt/text/` (data-only module) | new |

Wiring lands in `run-agent-factory.ts` the same way stage 2's did:
`reviewTools: nodes.includes("review_mining")` gets a sibling flag, and the
toolset offers the Reddit tool only to runs whose nodes cover stage 3.

## Open questions to resolve before any code

1. **Actor choice and price** (**verify**): which Reddit actor on the Apify
   store is pay-per-result, what it returns per row, and its unit price.
   This decides the estimate arithmetic in the planner.
2. **Comment depth**: cap per thread (`maxComments`) or by date window
   ("comments newer than the last ledger entry")? The ledger makes the date
   window cheap; the cap is simpler to explain.
3. **Handoff source**: stage 3's subject can come from a stage-1 packet like
   stage 2 does, but Reddit mining is often more useful *after* stage 2,
   because stage 2's packet knows the actives and the complaints that search
   queries should echo. The handoff should accept either.
4. **Packet contract**: one flat `reddit_conversations` node with themes, or
   several small nodes? One node keeps `Stages` and the frontend rail simple;
   themes belong inside the packet, not in the stage taxonomy.

## Sequencing

1. Probe the chosen actor with one real thread (a few cents) to fix its
   input/output shape and unit price — answer questions 1 and 2.
2. Domain types + `STAGES`/node + packet schema + validator expectations.
3. Adapter + tool + ledger keys, with `apify.test.ts`-style mapping tests.
4. Planner + `/stage3/plan` route + roster extraction from search hits.
5. Prompt text, packet-check rules, settlement.
6. Frontend: plan card, rail entry, packet rendering.
7. `mra check`, regenerate `docs/class-diagram.md`, deploy between runs.

Each step lands behind the gate independently; steps 1–3 are enough to mine
threads from a manually supplied list, so discovery UI (step 4–6) can lag the
mining core without blocking it.
