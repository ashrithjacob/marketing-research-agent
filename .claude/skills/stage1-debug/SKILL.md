---
name: stage1-debug
description: Debug a stage-1 research run from its outcome — what the consumer sees, what the agent does turn by turn, which sites it visits, the packet format, and a table mapping each observed outcome to its mechanism and where to look. Use when a run came back invalid/failed/odd, when explaining how stage 1 works, or when deciding what code to change based on what a run produced. Outcome dictates the code, not the other way round.
---

# Stage 1, outcome first

`workings.md` is the code-first account. This is its mirror: start from what a
run produced (or how it died) and work back to the code. Every number below is
measured from run `5368c5fa…`, brief "vitamin D tablets", whole stage 1,
2026-09-23: **20 LLM calls, 36 tool calls, 9m17s wall, 1.2M tokens (955k of
them cache reads), $0.0405 billed** — a normal, healthy run.

## What the consumer sees

1. **Start run** modal: product name (or a URL — a URL typed as the product is
   moved to `brief.url` by `Briefs.normalise()`), five market checkboxes
   (US/UK/AU/NZ/CA), free-text for others. No URL field on purpose: finding the
   product's site is the agent's job.
2. During the run: three lanes (search/fetch/other) filling with tool events,
   assistant text streaming as deltas, a **Tokens —** line, then **Calc cost**
   and **Billed** when done. Red rows are tool errors — the run continues.
3. At the end, the right-hand column shows the **packet**: sources, excerpts
   (voice of customer), measurements, attributes, gaps, and the stage rail's
   node statuses.

## What happens when Start run is clicked

Before the HTTP response even returns (`RunSupervisor.start()`):

1. Standing judgements and reject-kinds are loaded (defaults:
   `seo_listicle`, `review_roundup`, `ai_generated`).
2. A run row is written (`queued`), the model is looked up and priced from
   OpenRouter's live rates (unknown model → row is `failed`, endpoint 502).
3. The prompt is built: system prompt naming only the tools this run gets, and
   a user turn of rules → judgements → brief → output contract with a worked
   example packet (its product is invented; a packet about *it* is rejected as
   wrong-subject).
4. A pi-agent-core `Agent` runs in-process; its `streamFn` is wrapped so every
   LLM call is logged (`research_llm_calls`). Row becomes `running`, SSE opens,
   the browser follows `GET /runs/:id/events?after=0`.

## The agent loop, turn by turn

One **LLM call** = one turn: the whole transcript so far is sent, the model
answers with text, thinking, and/or tool calls, tools execute, results append
to the transcript, repeat — until the model stops calling tools or calls
`validate_packet` and then stops. In the measured run the context grew
6,160 → 45,782 tokens per call as pages piled up; ~80% of tokens were cache
reads, which is why a run this size costs $0.04 rather than $0.40.

Tool calls in the real run (36 total):

| Tool | Count | Where it actually went |
|---|---|---|
| `web_search` | 17 | SearXNG container → aggregates Google/Bing/DDG etc. |
| `web_fetch` | 13 | Firecrawl cloud API → brand/retailer/market-research pages |
| `amazon_find_product` | 3 | Apify actor → amazon.com (always .com, whatever the market) |
| `amazon_reviews` | 1 | Apify actor → amazon.com reviews |
| `validate_packet` | 2 | local — the same validator that settles the run |

The sites it visited, in order (from the event log): amazon.com (product
discovery), naturemade.com (the reference product's own page — a first-party
source), hollandandbarrett.com and vitabiotics.com (UK competitors),
thehealthpharmacy.co.uk, solgar.com, betteryou.com (oral spray — indirect
competitor), swisse.com.au (AU), mordorintelligence.com (market size for
category_data), naturesbest.co.uk, naturemade.com again for gummies (indirect
form). Note the pattern: **search first, fetch the product's own page, then
competitors across forms (tablet/softgel/spray/gummy), then market-level
sources** — that is the `competitors` direct/indirect rule (same active, same
vs different form) and saturation driving behaviour.

Each `web_fetch` body is archived to `/corpus/runs/<id>/sources/<sha256>` and
its hash becomes the `source_id` — so every excerpt in the packet cites bytes
that still exist on disk (`GET /runs/:id/sources/:sha` re-hashes and confirms).

## The response format

The deliverable is one JSON **packet** (`domain/packet.ts`), `.strict()` at
every object:

```
contract_version, stage: 1, run_id, brief,
sources[]          {id (sha256:…), url, title, kind, publisher, admitted,
                    admission_reason, node, …}
excerpts[]         verbatim voice-of-customer quotes, each citing a source_id
measurements[]     numeric facts with unit and source
attributes[]       product claims (e.g. dose, form) with source
competitor_reference + competitors[]   the §2.2 direct/indirect rows
saturation[]       "after N sources on this node, the last K added nothing"
nodes[]            per-node status: complete (needs saturation) or incomplete
gaps[]             REQUIRED, never empty — what could not be found and why
```

Measured packet: 11 sources, 1 excerpt, 4 measurements, 6 attributes, 2
saturation curves, 3 node entries, 6 gaps. All three nodes honestly
`incomplete` — **`completed` means the schema accepted the packet, not that
every node finished.** Honesty about saturation is the design; a node may call
itself complete only with a saturation curve behind it.

The model emits the packet either by calling `validate_packet` mid-run
(`packet.ready` fires with `via: "tool"` — the short path at settlement) or as
a final JSON block, which `PacketExtractor` pulls from the last balanced
`{ … }` with a `stage` key. Then seven cross-object rules run: brief echoes
the run's brief (no wrong-subject packets), cited source_ids exist, complete
nodes have saturation, competitor relations recomputed from forms, gaps
non-empty, scope respected.

## Outcome-first debug table

| You observed | Mechanism | Look at |
|---|---|---|
| `completed`, thin packet | Schema was satisfied; nodes may be `incomplete`, saturation never reached. Thin = agent stopped early or rejected most sources. | packet `nodes[].status`, `counts`, gaps list |
| `invalid` | The agent FINISHED; the schema refused the packet. Most informative failure there is. | `packet.invalid` payload names the field/rule; `output` on the run; `mra calls <id>` for the last turns |
| `failed` | A crash: stream died past 3 retries (deny-list retries, 2/4/8s ± jitter), bad model, restart killed it. | `error` on the run row; `run.resumed` count in events |
| `cancelled` | You pressed Stop, or a Stop landed in the ~30s billing window. | — |
| `completed` but `ended_early` | Packet validated mid-run, THEN the stream died. The packet stands. | `run.ended_early` payload |
| Lots of red tool rows | Firecrawl 4xx / SearXNG down / Apify 402 — handed to the model as errors, run continues. | `tool.completed` payloads with `error` |
| `succeeded`-looking run with wrong product | The model anchored on the worked example or a url-as-product mixup. | packet `brief.product` vs the run's brief (containment, letters+digits) |
| Zero excerpts | See `workings.md` §2 — excerpts aren't checked against archived bodies; zero means the agent didn't quote, which is a prompt/scope issue, not a validator one. | `mra watch` counts while live |
| Cost looks wrong | Calc (pi-ai × live rates, `usage.pricing.source`) vs Billed (`/generation` per `gen-…` id, 404s for ~4s after each turn; `billed.resolved < turns` = undercount). Apify is separate and never in either. | `usage` on the run, `/runs/<id>/logs` page |

A run costs real money. Scope debugging to one node (`mra run "X"
product_data`), and read the outcome with `mra watch` before touching code.
